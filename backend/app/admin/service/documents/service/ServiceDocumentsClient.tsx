"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Plus, FileText, ChevronRight, Download,
  ClipboardCheck, Wrench, CheckCircle, Loader2, Search, ArrowLeft, Trash2, CloudOff, Star,
  AlertTriangle, RefreshCcw,
} from "lucide-react";
import { ServiceProtocolFormWizard } from "./ServiceProtocolFormWizard";
import { ServiceProtocolPreview } from "./ServiceProtocolPreview";
import type { AdminRole } from "@/lib/admin/db";
import { listCachedDocuments, type CachedDocument } from "@/lib/offline/db";
import { isLocalId } from "@/lib/offline/offlineFetch";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { useOfflineQueue } from "@/lib/hooks/useOfflineQueue";

type ProtocolStatus = "prepared" | "in_progress" | "signed";

interface RepairProtocol {
  id: string;
  protocol_number: string;
  date: string;
  client_name: string | null;
  ac_model: string | null;
  address: string | null;
  status: ProtocolStatus;
  service_rating: number | null;
  created_at: string;
  /** true → записът е в IndexedDB и още не е стигнал до сървъра. */
  pendingSync?: boolean;
}

/**
 * Превръща cache документ в RepairProtocol row, подходящ за списъка.
 * Cache форматът съдържа raw payload, който изпращахме към API → има
 * същите полета.
 */
function cachedToProtocol(doc: CachedDocument<Record<string, unknown>>): RepairProtocol {
  const d = doc.data ?? {};
  const isOffline = isLocalId(doc.key) || doc.dirty;
  return {
    id:              doc.key,
    protocol_number: (d.protocol_number as string) || (isOffline ? "Чернова (офлайн)" : "—"),
    date:            (d.date as string) || new Date(doc.updatedAt).toISOString().slice(0, 10),
    client_name:     (d.client_name as string) ?? null,
    ac_model:        (d.ac_model as string) ?? null,
    address:         (d.address as string) ?? null,
    status:          ((d.status as ProtocolStatus) ?? "prepared"),
    service_rating:  (d.service_rating as number) ?? null,
    created_at:      new Date(doc.updatedAt).toISOString(),
    pendingSync:     isOffline,
  };
}

const STATUS_CONFIG: Record<ProtocolStatus, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  prepared:    { label: "Подготвен",              icon: ClipboardCheck, cls: "bg-amber-100  text-amber-700"  },
  in_progress: { label: "В процес на изпълнение", icon: Wrench,         cls: "bg-blue-100   text-blue-700"   },
  signed:      { label: "Подписан",               icon: CheckCircle,    cls: "bg-emerald-100 text-emerald-700"},
};

interface Props {
  role: AdminRole;
}

export function ServiceDocumentsClient({ role }: Props) {
  const [protocols, setProtocols]     = useState<RepairProtocol[]>([]);
  const [offlineRows, setOfflineRows] = useState<RepairProtocol[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [openForm, setOpenForm]       = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [preview, setPreview]         = useState<RepairProtocol | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const online = useOnlineStatus();
  const { pendingCount, isSyncing, syncNow, lastResult } = useOfflineQueue();
  const perPage = 20;

  // Ако сме онлайн, но имаме pending записи → backend проблем (не липса
  // на интернет). Най-чести причини: мигр. 0041 не е изпълнена в Supabase,
  // 401/403 от endpoint-а, валидация. Показваме предупреждение + бутон
  // „Опитай отново“ който вика syncNow().
  const hasStuckQueue = online && pendingCount > 0;

  // Изтриването е разрешено САМО за master_admin (UI guard; API също го налага сървърно).
  const canDelete = role === "master_admin";

  /**
   * Cache на сервизните протоколи в IndexedDB. Ползваме `service_protocol`
   * като DocKind (вече е дефиниран в lib/offline/db.ts).
   */
  const loadOfflineRows = useCallback(async () => {
    try {
      const cached = await listCachedDocuments<Record<string, unknown>>("service_protocol");
      const rows = cached
        .filter(c => isLocalId(c.key) || c.dirty)
        .map(cachedToProtocol);
      setOfflineRows(rows);
    } catch {
      setOfflineRows([]);
    }
  }, []);

  const load = useCallback(async (p = 1, q = "") => {
    setLoading(true);
    try {
      const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
      if (isOnline) {
        const params = new URLSearchParams({ page: String(p), perPage: String(perPage) });
        if (q) params.set("q", q);
        const res = await fetch(`/api/admin/service/repair-protocols?${params}`, { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          const rows: RepairProtocol[] = json.data ?? [];
          setProtocols(prev => (p === 1 ? rows : [...prev, ...rows]));
          setTotal(json.meta?.total ?? 0);
        }
      } else if (p === 1) {
        setProtocols([]);
        setTotal(0);
      }
      await loadOfflineRows();
    } finally {
      setLoading(false);
    }
  }, [loadOfflineRows]);

  useEffect(() => { load(1, search); }, [load, search]);

  useEffect(() => { void loadOfflineRows(); }, [pendingCount, loadOfflineRows]);

  // При възстановяване на мрежа след офлайн → re-fetch.
  const initialOnlineRef = useRef(online);
  useEffect(() => {
    if (online && !initialOnlineRef.current) {
      void load(1, search);
    }
    initialOnlineRef.current = online;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleNew = () => { setPreview(null); setEditId(null); setOpenForm(true); };
  const openPreview = (p: RepairProtocol) => { setPreview(p); };
  const openEdit = (id: string) => { setPreview(null); setEditId(id); setOpenForm(true); };

  const handleSaved = (id: string) => {
    setEditId(id);
    load(1, search);
  };

  const downloadPdf = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    window.open(`/api/admin/service/repair-protocols/${id}/pdf`, "_blank");
  };

  const handleDelete = async (e: React.MouseEvent, p: RepairProtocol) => {
    e.stopPropagation();
    if (!canDelete || deletingId) return;
    const label = p.protocol_number || "този протокол";
    const ok = window.confirm(
      `Да изтрия „${label}“?\n\nДействието е НЕОБРАТИМО — изтриват се и всички данни и подписи.`,
    );
    if (!ok) return;
    setDeletingId(p.id);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/admin/service/repair-protocols/${p.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok && res.status !== 204) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || "Грешка при изтриване");
      }
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

  const renderProtocolRow = (p: RepairProtocol, isOffline: boolean) => {
    const st = STATUS_CONFIG[p.status];
    const Icon = st.icon;
    return (
      <div
        key={p.id}
        onClick={() => isOffline ? openEdit(p.id) : openPreview(p)}
        className={`rounded-2xl p-4 flex items-center gap-3 cursor-pointer shadow-sm transition-colors ${
          isOffline
            ? "bg-amber-50 border-2 border-dashed border-amber-300 active:bg-amber-100"
            : "bg-white border border-slate-100 active:bg-slate-50"
        }`}
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
          isOffline ? "bg-amber-100" : "bg-emerald-50"
        }`}>
          {isOffline ? <CloudOff className="w-5 h-5 text-amber-700" /> : <Wrench className="w-5 h-5 text-emerald-600" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-bold text-slate-900 truncate">{p.protocol_number}</p>
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>
              <Icon className="w-3 h-3" />
              {st.label}
            </span>
            {p.service_rating != null && (
              <span className="flex items-center gap-0.5 text-xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded shrink-0">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {p.service_rating}/5
              </span>
            )}
            {isOffline && (
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-200 px-1.5 py-0.5 rounded">
                Чака мрежа
              </span>
            )}
          </div>
          <p className="text-xs text-slate-600 truncate">
            {p.client_name ?? "—"}{p.ac_model ? ` · ${p.ac_model}` : ""}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{formatDate(p.date)}</p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {!isOffline && (
            <button
              onClick={e => downloadPdf(e, p.id)}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-lg transition-colors"
              title="Свали PDF"
            >
              <Download className="w-4 h-4" />
            </button>
          )}
          {canDelete && !isOffline && (
            <button
              onClick={(e) => handleDelete(e, p)}
              disabled={deletingId === p.id}
              className="p-2 text-rose-400 hover:text-rose-700 hover:bg-rose-50 active:bg-rose-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
              title="Изтрий протокола"
            >
              {deletingId === p.id
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Trash2 className="w-4 h-4" />}
            </button>
          )}
          <ChevronRight className="w-4 h-4 text-slate-300" />
        </div>
      </div>
    );
  };

  if (openForm) {
    return (
      <ServiceProtocolFormWizard
        protocolId={editId ?? undefined}
        onClose={() => { setOpenForm(false); load(1, search); }}
        onSaved={handleSaved}
      />
    );
  }

  if (preview) {
    return (
      <ServiceProtocolPreview
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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Хедър ── */}
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/admin/service/documents"
              className="shrink-0 p-2 -ml-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200"
              title="Назад към документи"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-slate-900 truncate">Сервизни протоколи</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {total > 0 ? `${total} протокола` : "Няма протоколи"}
              </p>
            </div>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm active:bg-emerald-700 shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Нов
          </button>
        </div>

        {/* Търсене */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Търси по клиент, модел, номер..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all"
          />
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

        {/* Сигнал за „заседнала“ синхронизация: имаме мрежа, но queue не се
            изпразва → проблемът е сървърен (липсваща миграция, валидация, RLS). */}
        {hasStuckQueue && (
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-bold text-amber-900">
                  {pendingCount} {pendingCount === 1 ? "запис" : "записа"} не се качват
                </p>
                <p className="text-xs text-amber-800 leading-snug mt-0.5">
                  Има мрежа, но сървърът отказва записа. Често причина е, че миграция
                  <code className="mx-1 px-1 bg-amber-100 rounded font-mono">0041_service_repair_protocols.sql</code>
                  не е изпълнена в Supabase.
                </p>
                {lastResult?.failed ? (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Последна синхронизация: {lastResult.flushed} успешни, {lastResult.failed} неуспешни.
                  </p>
                ) : null}
              </div>
            </div>
            <button
              onClick={() => void syncNow()}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-white text-xs font-semibold disabled:opacity-60 shrink-0 self-start sm:self-auto"
            >
              {isSyncing
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <RefreshCcw className="w-3.5 h-3.5" />}
              Опитай отново
            </button>
          </div>
        )}

        {offlineRows.length > 0 && (
          <div className="mb-4">
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
                  : "Създайте нов протокол при следваща профилактика или ремонт"}
              </p>
            </div>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-xl font-semibold text-sm"
            >
              <Plus className="w-5 h-5" />
              Нов протокол
            </button>
          </div>
        ) : protocols.length > 0 ? (
          <div className="space-y-2">
            {protocols.map(p => renderProtocolRow(p, false))}
            {protocols.length < total && (
              <button
                onClick={() => { const p = page + 1; setPage(p); load(p, search); }}
                disabled={loading}
                className="w-full py-3 text-sm text-emerald-600 font-semibold flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Зареди още
              </button>
            )}
          </div>
        ) : null}
      </div>

      {/* ── Плаващ бутон (mobile) ── */}
      <button
        onClick={handleNew}
        className="fixed bottom-6 right-5 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center active:bg-emerald-700 z-20 md:hidden"
        aria-label="Нов протокол"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
