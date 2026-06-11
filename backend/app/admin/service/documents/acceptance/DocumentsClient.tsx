"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Plus, FileText, ChevronRight, Download,
  ClipboardCheck, Wrench, CheckCircle, Loader2, Search, ArrowLeft, Trash2, CloudOff,
  SlidersHorizontal,
} from "lucide-react";
import { Select } from "../../../ui";
import { ProtocolFormWizard } from "./ProtocolFormWizard";
import { ProtocolPreview } from "./ProtocolPreview";
import type { AdminRole } from "@/lib/admin/db";
import { listCachedDocuments, type CachedDocument } from "@/lib/offline/db";
import { isLocalId } from "@/lib/offline/offlineFetch";
import { resolveServerId } from "@/lib/offline/queue";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { useOfflineQueue } from "@/lib/hooks/useOfflineQueue";

type ProtocolStatus = "prepared" | "in_progress" | "signed";
type StatusFilter = "" | ProtocolStatus;
type SortOption = "created-desc" | "created-asc" | "date-desc" | "date-asc" | "client-asc" | "client-desc";

interface Protocol {
  id: string;
  protocol_number: string;
  date: string;
  client_name: string | null;
  client_phone: string | null;
  ac_model: string | null;
  address: string | null;
  paid_amount: number | null;
  status: ProtocolStatus;
  created_at: string;
  /** true → записът е в IndexedDB и още не е стигнал до сървъра. */
  pendingSync?: boolean;
}

const COMPACT_SELECT = "!py-1 !px-2 !text-xs !rounded-md min-w-0 !pr-6";

const SORT_OPTIONS: Array<{ value: SortOption; label: string }> = [
  { value: "created-desc", label: "Най-нови" },
  { value: "created-asc", label: "Най-стари" },
  { value: "date-desc", label: "Дата ↓" },
  { value: "date-asc", label: "Дата ↑" },
  { value: "client-asc", label: "Клиент А→Я" },
  { value: "client-desc", label: "Клиент Я→А" },
];

/**
 * Превръща cache документ в Protocol row, подходящ за списъка.
 * Cache форматът съдържа raw payload, който изпращахме към API → има същите полета.
 */
function cachedToProtocol(doc: CachedDocument<Record<string, unknown>>): Protocol {
  const d = doc.data ?? {};
  const isOffline = isLocalId(doc.key) || doc.dirty;
  return {
    id:              doc.key,
    protocol_number: (d.protocol_number as string) || (isOffline ? "Чернова (офлайн)" : "—"),
    date:            (d.date as string) || new Date(doc.updatedAt).toISOString().slice(0, 10),
    client_name:     (d.client_name as string) ?? null,
    client_phone:    (d.client_phone as string) ?? null,
    ac_model:        (d.ac_model as string) ?? null,
    address:         (d.address as string) ?? null,
    paid_amount:     typeof d.paid_amount === "number" ? d.paid_amount : null,
    status:          ((d.status as ProtocolStatus) ?? "prepared"),
    created_at:      new Date(doc.updatedAt).toISOString(),
    pendingSync:     isOffline,
  };
}

// Жизнен цикъл: prepared → in_progress → signed
const STATUS_LIST_LABEL: Record<ProtocolStatus, string> = {
  prepared: "Подготвен",
  in_progress: "В процес",
  signed: "Подписан",
};

const STATUS_CONFIG: Record<ProtocolStatus, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  prepared:    { label: "Подготвен",            icon: ClipboardCheck, cls: "bg-amber-100  text-amber-700"  },
  in_progress: { label: "В процес на изпълнение", icon: Wrench,         cls: "bg-blue-100   text-blue-700"   },
  signed:      { label: "Подписан",             icon: CheckCircle,    cls: "bg-emerald-100 text-emerald-700"},
};

interface Props {
  role: AdminRole;
}

export function DocumentsClient({ role }: Props) {
  const searchParams = useSearchParams();
  const [protocols, setProtocols]     = useState<Protocol[]>([]);
  const [offlineRows, setOfflineRows] = useState<Protocol[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [sort, setSort]                 = useState<SortOption>("created-desc");
  const [filtersOpen, setFiltersOpen]   = useState(false);
  const [openForm, setOpenForm]       = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [preview, setPreview]         = useState<Protocol | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const online = useOnlineStatus();
  const { pendingCount, syncNow, isSyncing, pendingSampleError, lastError, refreshQueueState } = useOfflineQueue();
  const perPage = 20;

  // Изтриването е разрешено САМО за главен администратор. API също го
  // налага сървърно (403 за всички останали роли), но скриваме бутона от
  // UI, за да не подвеждаме другите роли. Виж DELETE handler-а в
  // backend/app/api/admin/service/protocols/[id]/route.ts.
  const canDelete = role === "master_admin";

  // Зарежда cached/offline протоколи от IndexedDB.
  // Тези записи се показват винаги — независимо дали сме online или offline —
  // за да може екипът да види своите чернови, които още чакат качване.
  const loadOfflineRows = useCallback(async (serverIds?: Set<string>) => {
    try {
      const cached = await listCachedDocuments<Record<string, unknown>>("acceptance");
      const rows: Protocol[] = [];
      for (const c of cached) {
        if (!isLocalId(c.key) && !c.dirty) continue;
        if (isLocalId(c.key)) {
          const sid = await resolveServerId(c.key);
          if (sid && serverIds?.has(sid)) continue;
        }
        rows.push(cachedToProtocol(c));
      }
      setOfflineRows(rows);
    } catch {
      // IDB не е достъпен (private mode, SSR…) → продължаваме без offline rows.
      setOfflineRows([]);
    }
  }, []);

  const load = useCallback(async (p = 1, q = "", status: StatusFilter = "", sortBy: SortOption = "created-desc") => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({
        page: String(p),
        perPage: String(perPage),
        sort: sortBy,
      });
      if (q) params.set("q", q);
      if (status) params.set("status", status);

      let serverIds: Set<string> | undefined;
      try {
        const res = await fetch(`/api/admin/service/protocols?${params}`, { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          const rows: Protocol[] = json.data ?? [];
          setProtocols((prev) => (p === 1 ? rows : [...prev, ...rows]));
          setTotal(json.meta?.total ?? 0);
          serverIds = new Set(rows.map((r) => r.id));
        } else if (p === 1) {
          const json = await res.json().catch(() => ({}));
          setProtocols([]);
          setTotal(0);
          setErrorMsg(
            (json as { error?: string }).error ||
              `Грешка при зареждане (${res.status}). Опитайте отново.`,
          );
        }
      } catch {
        if (p === 1) {
          setProtocols([]);
          setTotal(0);
          if (!navigator.onLine) {
            setErrorMsg("Няма връзка. Показваме само чернови от устройството, ако има такива.");
          } else {
            setErrorMsg("Грешка при зареждане на протоколите. Проверете връзката и опитайте отново.");
          }
        }
      }

      await loadOfflineRows(serverIds);
    } finally {
      setLoading(false);
    }
  }, [loadOfflineRows, perPage]);

  useEffect(() => { load(1, search, statusFilter, sort); }, [load, search, statusFilter, sort]);

  // Презареждаме offline rows и сървърния списък след sync.
  const prevPendingRef = useRef(pendingCount);
  useEffect(() => {
    void loadOfflineRows();
    if (prevPendingRef.current > 0 && pendingCount === 0 && online) {
      void load(1, search, statusFilter, sort);
    }
    prevPendingRef.current = pendingCount;
  }, [pendingCount, loadOfflineRows, online, load, search, statusFilter, sort]);

  const handleSyncPending = async () => {
    await refreshQueueState();
    await syncNow();
    await load(1, search, statusFilter, sort);
  };

  // P13: При възстановяване на мрежа след офлайн → ре-зареждаме целия списък.
  // Refs гарантират, че не правим double load на mount (когато online стартира true).
  const initialOnlineRef = useRef(online);
  useEffect(() => {
    if (online && !initialOnlineRef.current) {
      // Бил offline → стана online → ре-fetch.
      void load(1, search, statusFilter, sort);
    }
    initialOnlineRef.current = online;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const patchFilters = (patch: { status?: StatusFilter; sort?: SortOption }) => {
    setPage(1);
    if (patch.status !== undefined) setStatusFilter(patch.status);
    if (patch.sort !== undefined) setSort(patch.sort);
  };

  const hasActiveFilters = statusFilter !== "" || sort !== "created-desc";

  const handleNew = () => { setPreview(null); setEditId(null); setOpenForm(true); };
  const openPreview = (p: Protocol) => { setPreview(p); };
  const openEdit = (id: string) => { setPreview(null); setEditId(id); setOpenForm(true); };

  useEffect(() => {
    const editFromUrl = searchParams.get("edit")?.trim();
    if (!editFromUrl || loading) return;
    openEdit(editFromUrl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loading]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void load(1, search, statusFilter, sort);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load, search, statusFilter, sort]);

  const handleSaved = (id: string) => {
    setEditId(id);
    load(1, search, statusFilter, sort);
  };

  const downloadPdf = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    window.open(`/api/admin/service/protocols/${id}/pdf`, "_blank");
  };

  // Изтрива един протокол след явно потвърждение. Само master_admin вижда
  // бутона; API също валидира ролята и връща 403 за останалите.
  const handleDelete = async (e: React.MouseEvent, p: Protocol) => {
    e.stopPropagation();
    if (!canDelete || deletingId) return;
    const label = p.protocol_number || "този протокол";
    const ok = window.confirm(
      `Да изтрия „${label}“?\n\nДействието е НЕОБРАТИМО — изтриват се и подписите и материалите към него.`,
    );
    if (!ok) return;
    setDeletingId(p.id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/service/protocols/${p.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || "Грешка при изтриване");
      }
      // Оптимистично махам реда от списъка и презареждам броячите.
      setProtocols((prev) => prev.filter((x) => x.id !== p.id));
      setTotal((t) => Math.max(0, t - 1));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Грешка при изтриване");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });

  const formatPaid = (n: number | null | undefined) => {
    if (n == null || !Number.isFinite(Number(n))) return null;
    return `€${Number(n).toLocaleString("bg-BG", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };

  // Рендер на един ред в списъка. `isOffline` маркира визуално неизпратените записи.
  const renderProtocolRow = (p: Protocol, isOffline: boolean) => {
    const st = STATUS_CONFIG[p.status];
    const Icon = st.icon;
    const paidLabel = formatPaid(p.paid_amount);
    const detailParts = [
      p.client_name?.trim(),
      p.client_phone?.trim(),
      p.ac_model?.trim(),
      p.address?.trim(),
    ].filter(Boolean);

    return (
      <div
        key={p.id}
        onClick={() => isOffline || p.status !== "signed" ? openEdit(p.id) : openPreview(p)}
        className={`rounded-xl px-3 py-2.5 flex items-center gap-2.5 cursor-pointer shadow-sm transition-colors ${
          isOffline
            ? "bg-amber-50 border-2 border-dashed border-amber-300 active:bg-amber-100"
            : "bg-white border border-slate-100 active:bg-slate-50"
        }`}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
          isOffline ? "bg-amber-100" : "bg-blue-50"
        }`}>
          {isOffline ? <CloudOff className="w-4 h-4 text-amber-700" /> : <FileText className="w-4 h-4 text-blue-600" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate min-w-0">{p.protocol_number}</p>
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${st.cls}`}>
              <Icon className="w-2.5 h-2.5" />
              {STATUS_LIST_LABEL[p.status]}
            </span>
            {isOffline && (
              <span className="text-[9px] font-extrabold uppercase tracking-wide text-amber-700 bg-amber-200 px-1 py-0.5 rounded shrink-0">
                Офлайн
              </span>
            )}
            <span className="ml-auto pl-2 text-[11px] text-slate-400 whitespace-nowrap shrink-0 tabular-nums">
              {formatDate(p.date)}
              {paidLabel ? ` · ${paidLabel}` : ""}
            </span>
          </div>

          {detailParts.length > 0 && (
            <p className="text-xs text-slate-600 truncate mt-0.5">
              {detailParts.join(" · ")}
            </p>
          )}
        </div>

        <div className="flex items-center shrink-0 -mr-0.5">
          {!isOffline && (
            <button
              onClick={e => downloadPdf(e, p.id)}
              className="p-2 min-h-11 min-w-11 flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-lg transition-colors"
              title="Свали PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          {canDelete && !isOffline && (
            <button
              onClick={(e) => handleDelete(e, p)}
              disabled={deletingId === p.id}
              className="p-2 min-h-11 min-w-11 flex items-center justify-center text-rose-400 hover:text-rose-700 hover:bg-rose-50 active:bg-rose-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
              title="Изтрий протокола"
            >
              {deletingId === p.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Trash2 className="w-4 h-4" />}
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-slate-300 ml-0.5" />
        </div>
      </div>
    );
  };

  if (openForm) {
    return (
      <ProtocolFormWizard
        protocolId={editId ?? undefined}
        onClose={() => { setOpenForm(false); load(1, search, statusFilter, sort); }}
        onSaved={handleSaved}
      />
    );
  }

  if (preview) {
    return (
      <ProtocolPreview
        protocolId={preview.id}
        protocolNumber={preview.protocol_number}
        clientLabel={[preview.client_name, preview.ac_model].filter(Boolean).join(" · ") || "—"}
        dateLabel={formatDate(preview.date)}
        role={role}
        onClose={() => setPreview(null)}
        onEdit={() => openEdit(preview.id)}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-50">

      {/* ── Хедър ── */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/admin/service/documents"
              prefetch={false}
              className="shrink-0 p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200"
              title="Назад към документи"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate">Приемно-предавателни протоколи</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {total > 0 ? `${total} протокола` : "Няма протоколи"}
              </p>
            </div>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm active:bg-blue-700 shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Нов
          </button>
        </div>

        {/* Търсене + филтри */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Клиент, телефон, адрес, модел, №..."
              className="w-full pl-9 pr-4 py-2 bg-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFiltersOpen(v => !v)}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {filtersOpen ? "Скрий" : "Филтри"}
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => patchFilters({ status: "", sort: "created-desc" })}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600"
              >
                Изчисти
              </button>
            )}
            {!filtersOpen && (
              <div className="flex flex-wrap items-center gap-1.5 min-w-0 flex-1">
                <Select
                  className={`w-full max-w-[7rem] sm:w-[6.5rem] ${COMPACT_SELECT}`}
                  value={sort}
                  onChange={(e) => patchFilters({ sort: e.target.value as SortOption })}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
                <Select
                  className={`w-full max-w-[6.5rem] sm:w-[6rem] ${COMPACT_SELECT}`}
                  value={statusFilter}
                  onChange={(e) => patchFilters({ status: e.target.value as StatusFilter })}
                >
                  <option value="">Всички</option>
                  <option value="prepared">Подготвен</option>
                  <option value="in_progress">В процес</option>
                  <option value="signed">Подписан</option>
                </Select>
              </div>
            )}
          </div>

          {filtersOpen && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 px-2 py-2">
              <label className="inline-flex items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">Сортиране</span>
                <Select
                  className={`w-[6.5rem] ${COMPACT_SELECT}`}
                  value={sort}
                  onChange={(e) => patchFilters({ sort: e.target.value as SortOption })}
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </label>
              <label className="inline-flex items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">Статус</span>
                <Select
                  className={`w-[6rem] ${COMPACT_SELECT}`}
                  value={statusFilter}
                  onChange={(e) => patchFilters({ status: e.target.value as StatusFilter })}
                >
                  <option value="">Всички</option>
                  <option value="prepared">Подготвен</option>
                  <option value="in_progress">В процес</option>
                  <option value="signed">Подписан</option>
                </Select>
              </label>
            </div>
          )}
        </div>
      </div>

      {/* ── Списък ── */}
      <div className="flex-1 p-4">
        {errorMsg && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-3 py-2 text-sm flex items-center justify-between gap-3">
            <span className="font-medium">{errorMsg}</span>
            <button
              onClick={() => setErrorMsg(null)}
              className="text-rose-600 hover:text-rose-900 font-bold"
              title="Скрий"
            >
              ✕
            </button>
          </div>
        )}

        {/* Offline-only записи (чернови, които още не са качени към сървъра) */}
        {offlineRows.length > 0 && (
          <div className="mb-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 mb-2 text-sm text-amber-950">
              <p className="font-semibold">
                {offlineRows.length === 1
                  ? "1 протокол е само на това устройство"
                  : `${offlineRows.length} протокола са само на това устройство`}
              </p>
              <p className="text-xs text-amber-800 mt-1">
                Другите компютри виждат само качените в системата протоколи. Натиснете „Качи сега“, докато имате интернет.
              </p>
              {(pendingSampleError || lastError) && (
                <p className="text-xs text-rose-700 mt-1 font-medium">
                  {pendingSampleError || lastError}
                </p>
              )}
              {online && (
                <button
                  type="button"
                  onClick={() => void handleSyncPending()}
                  disabled={isSyncing}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudOff className="w-3.5 h-3.5" />}
                  {isSyncing ? "Качване…" : "Качи сега"}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 mb-2 px-1">
              <CloudOff className="w-3.5 h-3.5 text-slate-500" />
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                Чакат качване ({offlineRows.length})
              </p>
            </div>
            <div className="space-y-2">
              {offlineRows.map(p => renderProtocolRow(p, true))}
            </div>
          </div>
        )}

        {loading && protocols.length === 0 && offlineRows.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
          </div>
        ) : protocols.length === 0 && offlineRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center">
              <FileText className="w-7 h-7 text-slate-300" />
            </div>
            <div>
              <p className="font-bold text-slate-700">Няма протоколи</p>
              <p className="text-sm text-slate-400 mt-1">
                {!online
                  ? "В офлайн режим. Създайте нов — ще се качи автоматично при възстановяване на връзката."
                  : "Създайте нов протокол при следващ монтаж"}
              </p>
            </div>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm"
            >
              <Plus className="w-5 h-5" />
              Нов протокол
            </button>
          </div>
        ) : protocols.length > 0 ? (
          <div className="space-y-2">
            {protocols.map(p => renderProtocolRow(p, false))}

            {/* Зареди още */}
            {protocols.length < total && (
              <button
                onClick={() => { const p = page + 1; setPage(p); load(p, search, statusFilter, sort); }}
                disabled={loading}
                className="w-full py-3 text-sm text-blue-600 font-semibold flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Зареди още
              </button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
