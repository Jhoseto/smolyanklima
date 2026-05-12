"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  Plus, FileText, ChevronRight, Download,
  ClipboardCheck, Wrench, CheckCircle, Loader2, Search, ArrowLeft, Trash2, CloudOff,
} from "lucide-react";
import { ProtocolFormWizard } from "./ProtocolFormWizard";
import { ProtocolPreview } from "./ProtocolPreview";
import type { AdminRole } from "@/lib/admin/db";
import { listCachedDocuments, type CachedDocument } from "@/lib/offline/db";
import { isLocalId } from "@/lib/offline/offlineFetch";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { useOfflineQueue } from "@/lib/hooks/useOfflineQueue";

type ProtocolStatus = "prepared" | "in_progress" | "signed";

interface Protocol {
  id: string;
  protocol_number: string;
  date: string;
  client_name: string | null;
  ac_model: string | null;
  address: string | null;
  status: ProtocolStatus;
  created_at: string;
  /** true → записът е в IndexedDB и още не е стигнал до сървъра. */
  pendingSync?: boolean;
}

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
    ac_model:        (d.ac_model as string) ?? null,
    address:         (d.address as string) ?? null,
    status:          ((d.status as ProtocolStatus) ?? "prepared"),
    created_at:      new Date(doc.updatedAt).toISOString(),
    pendingSync:     isOffline,
  };
}

// Жизнен цикъл на протокола:
//   prepared    — офисът е въвел клиентските данни и чака сервизен екип.
//   in_progress — сервизният екип на място попълва, но не е финализирал.
//   signed      — завършен и подписан от двете страни.
const STATUS_CONFIG: Record<ProtocolStatus, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  prepared:    { label: "Подготвен",            icon: ClipboardCheck, cls: "bg-amber-100  text-amber-700"  },
  in_progress: { label: "В процес на изпълнение", icon: Wrench,         cls: "bg-blue-100   text-blue-700"   },
  signed:      { label: "Подписан",             icon: CheckCircle,    cls: "bg-emerald-100 text-emerald-700"},
};

interface Props {
  role: AdminRole;
}

export function DocumentsClient({ role }: Props) {
  const [protocols, setProtocols]     = useState<Protocol[]>([]);
  const [offlineRows, setOfflineRows] = useState<Protocol[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [openForm, setOpenForm]       = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [preview, setPreview]         = useState<Protocol | null>(null);
  const [deletingId, setDeletingId]   = useState<string | null>(null);
  const [errorMsg, setErrorMsg]       = useState<string | null>(null);
  const online = useOnlineStatus();
  const { pendingCount } = useOfflineQueue();
  const perPage = 20;

  // Изтриването е разрешено САМО за главен администратор. API също го
  // налага сървърно (403 за всички останали роли), но скриваме бутона от
  // UI, за да не подвеждаме другите роли. Виж DELETE handler-а в
  // backend/app/api/admin/service/protocols/[id]/route.ts.
  const canDelete = role === "master_admin";

  // Зарежда cached/offline протоколи от IndexedDB.
  // Тези записи се показват винаги — независимо дали сме online или offline —
  // за да може екипът да види своите чернови, които още чакат качване.
  const loadOfflineRows = useCallback(async () => {
    try {
      const cached = await listCachedDocuments<Record<string, unknown>>("acceptance");
      // Показваме само записи, които или нямат server id (local-...),
      // или са маркирани като dirty (имат неизпратени промени).
      const rows = cached
        .filter(c => isLocalId(c.key) || c.dirty)
        .map(cachedToProtocol);
      setOfflineRows(rows);
    } catch {
      // IDB не е достъпен (private mode, SSR…) → продължаваме без offline rows.
      setOfflineRows([]);
    }
  }, []);

  const load = useCallback(async (p = 1, q = "") => {
    setLoading(true);
    try {
      // Винаги опитваме API; ако сме офлайн, тръгваме на cache fallback.
      const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
      if (isOnline) {
        const params = new URLSearchParams({ page: String(p), perPage: String(perPage) });
        if (q) params.set("q", q);
        const res = await fetch(`/api/admin/service/protocols?${params}`, { credentials: "include" });
        if (res.ok) {
          const json = await res.json();
          const rows: Protocol[] = json.data ?? [];
          setProtocols(prev => (p === 1 ? rows : [...prev, ...rows]));
          setTotal(json.meta?.total ?? 0);
        }
      } else if (p === 1) {
        // Офлайн: показваме само това, което е в cache (offlineRows ще съдържат всичко).
        setProtocols([]);
        setTotal(0);
      }
      await loadOfflineRows();
    } finally {
      setLoading(false);
    }
  }, [loadOfflineRows]);

  useEffect(() => { load(1, search); }, [load, search]);

  // Презареждаме offline rows при промяна на броя pending mutations
  // (т.е. след auto-sync — изчистваме маркираните като качени).
  useEffect(() => { void loadOfflineRows(); }, [pendingCount, loadOfflineRows]);

  // P13: При възстановяване на мрежа след офлайн → ре-зареждаме целия списък.
  // Refs гарантират, че не правим double load на mount (когато online стартира true).
  const initialOnlineRef = useRef(online);
  useEffect(() => {
    if (online && !initialOnlineRef.current) {
      // Бил offline → стана online → ре-fetch.
      void load(1, search);
    }
    initialOnlineRef.current = online;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };

  const handleNew = () => { setPreview(null); setEditId(null); setOpenForm(true); };
  const openPreview = (p: Protocol) => { setPreview(p); };
  const openEdit = (id: string) => { setPreview(null); setEditId(id); setOpenForm(true); };

  const handleSaved = (id: string) => {
    setEditId(id);
    load(1, search);
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

  // Рендер на един ред в списъка. `isOffline` маркира визуално неизпратените записи.
  const renderProtocolRow = (p: Protocol, isOffline: boolean) => {
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
          isOffline ? "bg-amber-100" : "bg-blue-50"
        }`}>
          {isOffline ? <CloudOff className="w-5 h-5 text-amber-700" /> : <FileText className="w-5 h-5 text-blue-600" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-sm font-bold text-slate-900 truncate">{p.protocol_number}</p>
            <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>
              <Icon className="w-3 h-3" />
              {st.label}
            </span>
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
      <ProtocolFormWizard
        protocolId={editId ?? undefined}
        onClose={() => { setOpenForm(false); load(1, search); }}
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

        {/* Търсене */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Търси по клиент, модел, номер..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all"
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

        {/* Offline-only записи (чернови, които още не са качени към сървъра) */}
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
                onClick={() => { const p = page + 1; setPage(p); load(p, search); }}
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

      {/* ── Плаващ бутон (mobile) ── */}
      <button
        onClick={handleNew}
        className="fixed bottom-6 right-5 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center active:bg-blue-700 z-20 md:hidden"
        aria-label="Нов протокол"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
