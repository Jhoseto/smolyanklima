"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import Link from "next/link";
import {
  Plus, FileText, ChevronRight, Download,
  ClipboardCheck, Wrench, CheckCircle, Loader2, Search, ArrowLeft, Trash2, Star, FilterX,
} from "lucide-react";
import { ServiceProtocolFormWizard } from "./ServiceProtocolFormWizard";
import { ServiceProtocolPreview } from "./ServiceProtocolPreview";
import { AdminTableLoading } from "../../../ui";
import type { AdminRole } from "@/lib/admin/db";
import { FREON_CHARGE_LABEL, SERVICE_KIND_LABEL, type FreonChargeMethod, type RepairServiceKind } from "@/lib/repair-protocol-fields";

type ProtocolStatus = "prepared" | "in_progress" | "signed";
type KindFilter = "" | RepairServiceKind;

interface RepairProtocol {
  id: string;
  protocol_number: string;
  date: string;
  ac_brand: string | null;
  ac_model: string | null;
  serial_number: string | null;
  address: string | null;
  client_name: string | null;
  is_japanese_brand: boolean | null;
  freon_charge_method: FreonChargeMethod | null;
  status: ProtocolStatus;
  service_kind?: RepairServiceKind | null;
  service_rating: number | null;
  created_at: string;
}

const STATUS_CONFIG: Record<ProtocolStatus, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  prepared:    { label: "Подготвен",              icon: ClipboardCheck, cls: "bg-brand-orange-100  text-brand-orange-900"  },
  in_progress: { label: "В процес на изпълнение", icon: Wrench,         cls: "bg-brand-blue-100   text-brand-blue-900"   },
  signed:      { label: "Подписан",               icon: CheckCircle,    cls: "bg-brand-blue-100 text-brand-blue-900"},
};

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: "", label: "Всички" },
  { value: "client", label: "За клиент" },
  { value: "recycle", label: "Рециклиране" },
];

interface Props {
  role: AdminRole;
}

interface ListFilters {
  q: string;
  kind: KindFilter;
  dateFrom: string;
  dateTo: string;
}

export function ServiceDocumentsClient({ role }: Props) {
  const [protocols, setProtocols] = useState<RepairProtocol[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState<KindFilter>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const isFirstRender = useRef(true);
  const [openForm, setOpenForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [preview, setPreview] = useState<RepairProtocol | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const perPage = 20;

  const canDelete = role === "master_admin";
  const hasActiveFilters = Boolean(kindFilter || dateFrom || dateTo || debouncedSearch.trim());

  const load = useCallback(async (p = 1, filters: ListFilters) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({ page: String(p), perPage: String(perPage) });
      if (filters.q) params.set("q", filters.q);
      if (filters.kind) params.set("kind", filters.kind);
      if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.set("dateTo", filters.dateTo);
      const res = await fetch(`/api/admin/service/repair-protocols?${params}`, { credentials: "include" });
      if (res.ok) {
        const json = await res.json();
        const rows: RepairProtocol[] = json.data ?? [];
        setProtocols((prev) => (p === 1 ? rows : [...prev, ...rows]));
        setTotal(json.meta?.total ?? 0);
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
        setErrorMsg("Грешка при зареждане на протоколите. Проверете връзката.");
      }
    } finally {
      setLoading(false);
    }
  }, [perPage]);

  const currentFilters = useCallback((): ListFilters => ({
    q: debouncedSearch,
    kind: kindFilter,
    dateFrom,
    dateTo,
  }), [debouncedSearch, kindFilter, dateFrom, dateTo]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      void load(1, currentFilters());
      return;
    }
    setPage(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
    void load(1, currentFilters());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, debouncedSearch, kindFilter, dateFrom, dateTo]);

  const handleSearch = (v: string) => { setSearch(v); };
  const clearFilters = () => {
    setSearch("");
    setKindFilter("");
    setDateFrom("");
    setDateTo("");
  };
  const handleNew = () => { setPreview(null); setEditId(null); setOpenForm(true); };
  const openPreview = (p: RepairProtocol) => { setPreview(p); };
  const openEdit = (id: string) => { setPreview(null); setEditId(id); setOpenForm(true); };

  const handleSaved = (id: string) => {
    setEditId(id);
    void load(1, { q: search, kind: kindFilter, dateFrom, dateTo });
  };

  const downloadPdf = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const url = `/api/admin/service/repair-protocols/${id}/pdf`;
    try {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) { setErrorMsg("Грешка при генериране на PDF. Опитайте отново."); return; }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      const cd = res.headers.get("Content-Disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `servizen-protokol-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(objectUrl); }, 1000);
    } catch { setErrorMsg("Неуспешно сваляне на PDF. Проверете връзката."); }
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

  const listRowMetaParts = (p: RepairProtocol): string[] => {
    const parts: string[] = [];
    const sn = p.serial_number?.trim();
    if (sn) parts.push(`S/N ${sn}`);
    if (p.is_japanese_brand === true) parts.push("Японски");
    if (p.freon_charge_method) {
      const fl = FREON_CHARGE_LABEL[p.freon_charge_method];
      if (fl) parts.push(`Фреон: ${fl}`);
    }
    const addr = p.address?.trim();
    if (addr) parts.push(addr);
    return parts;
  };

  const renderProtocolRow = (p: RepairProtocol) => {
    const st = STATUS_CONFIG[p.status];
    const Icon = st.icon;
    const brandModel = [p.ac_brand, p.ac_model].filter(Boolean).join(" ").trim();
    const kind = p.service_kind === "recycle" ? "recycle" : "client";
    const title =
      kind === "recycle"
        ? (brandModel || "Рециклиране")
        : (p.client_name?.trim() || brandModel || "—");
    const subtitleParts: string[] = [];
    if (kind === "client" && p.client_name?.trim() && brandModel) subtitleParts.push(brandModel);
    if (kind === "recycle" && brandModel && title !== brandModel) subtitleParts.push(brandModel);
    subtitleParts.push(formatDate(p.date));
    const meta = listRowMetaParts(p);
    return (
      <div
        key={p.id}
        onClick={() => openPreview(p)}
        className="rounded-2xl p-4 flex items-center gap-3 cursor-pointer shadow-sm transition-colors bg-white border border-slate-100 active:bg-slate-50"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-brand-blue-50">
          <Wrench className="w-5 h-5 text-brand-blue-700" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[15px] sm:text-base font-bold text-slate-900 leading-snug">
            <span className="break-words">{title}</span>
            <span className="text-slate-600 font-semibold"> · {subtitleParts.join(" · ")}</span>
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] font-mono text-slate-500 tabular-nums shrink-0" title="Номер на протокол">
              № {p.protocol_number}
            </span>
            <span
              className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                kind === "recycle"
                  ? "bg-brand-orange-100 text-brand-orange-900"
                  : "bg-slate-100 text-slate-700"
              }`}
            >
              {SERVICE_KIND_LABEL[kind]}
            </span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>
              <Icon className="w-3 h-3" />
              {st.label}
            </span>
            {p.service_rating != null && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-brand-orange-800 bg-brand-orange-50 px-1.5 py-0.5 rounded shrink-0">
                <Star className="w-3 h-3 fill-brand-orange-500 text-brand-orange-500" />
                {p.service_rating}/5
              </span>
            )}
          </div>
          {meta.length > 0 ? (
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug line-clamp-2">
              {meta.join(" · ")}
            </p>
          ) : null}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={e => downloadPdf(e, p.id)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 active:bg-slate-200 rounded-lg transition-colors"
            title="Свали PDF"
          >
            <Download className="w-4 h-4" />
          </button>
          {canDelete && (
            <button
              onClick={(e) => handleDelete(e, p)}
              disabled={deletingId === p.id}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-rose-400 hover:text-rose-700 hover:bg-rose-50 active:bg-rose-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-wait"
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
        role={role}
        onClose={() => {
          setOpenForm(false);
          void load(1, { q: search, kind: kindFilter, dateFrom, dateTo });
        }}
        onSaved={handleSaved}
      />
    );
  }

  if (preview) {
    return (
      <ServiceProtocolPreview
        protocolId={preview.id}
        protocolNumber={preview.protocol_number}
        clientLabel={
          (() => {
            const brandModel = [preview.ac_brand, preview.ac_model].filter(Boolean).join(" ");
            if (preview.service_kind === "recycle") {
              return [SERVICE_KIND_LABEL.recycle, brandModel].filter(Boolean).join(" · ") || "—";
            }
            return [preview.client_name, brandModel].filter(Boolean).join(" · ") || "—";
          })()
        }
        dateLabel={formatDate(preview.date)}
        role={role}
        onClose={() => setPreview(null)}
        onEdit={() => openEdit(preview.id)}
      />
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-slate-50">
      <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-10 safe-top">
        <div className="flex items-center justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/admin/service/documents"
              className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200"
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
            className="flex items-center gap-1.5 bg-brand-blue-700 text-white px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-brand-blue-800 active:bg-brand-blue-900 shadow-sm shrink-0"
          >
            <Plus className="w-4 h-4" />
            Нов
          </button>
        </div>

        <div className="space-y-2.5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={e => handleSearch(e.target.value)}
              placeholder="Клиент, телефон, марка, модел, SR-номер, сериен №…"
              autoComplete="off"
              spellCheck={false}
              className="w-full pl-9 pr-4 py-2.5 bg-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-400 transition-all"
            />
          </div>
          <p className="text-[11px] text-slate-500 leading-snug px-0.5">
            Без значение от главни/малки букви, интервали и символи. Примери:{" "}
            <span className="text-slate-600">panasonic563</span>,{" "}
            <span className="text-slate-600">563/Panasonic</span>,{" "}
            <span className="text-slate-600">0887123456</span>
          </p>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
            {KIND_FILTERS.map((opt) => {
              const active = kindFilter === opt.value;
              return (
                <button
                  key={opt.value || "all"}
                  type="button"
                  onClick={() => setKindFilter(opt.value)}
                  className={`shrink-0 min-h-[40px] px-3 rounded-xl text-sm font-semibold transition-colors ${
                    active
                      ? "bg-brand-blue-700 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 min-h-[40px] inline-flex items-center justify-center gap-1 px-3 rounded-xl text-sm font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200"
                title="Изчисти филтрите"
              >
                <FilterX className="w-4 h-4" />
                Изчисти
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">От дата</span>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-400"
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold text-slate-500 mb-1">До дата</span>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-slate-100 rounded-xl text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-400"
              />
            </label>
          </div>
        </div>
      </div>

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

        {loading && protocols.length === 0 ? (
          <AdminTableLoading />
        ) : protocols.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center">
              <FileText className="w-7 h-7 text-slate-300" />
            </div>
            <div>
              <p className="font-bold text-slate-700">
                {hasActiveFilters ? "Няма резултати" : "Няма протоколи"}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {hasActiveFilters
                  ? "Променете филтрите или търсенето"
                  : "Създайте нов протокол при следваща профилактика или ремонт"}
              </p>
            </div>
            {hasActiveFilters ? (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold text-sm"
              >
                <FilterX className="w-5 h-5" />
                Изчисти филтрите
              </button>
            ) : (
              <button
                onClick={handleNew}
                className="flex items-center gap-2 bg-brand-blue-700 hover:bg-brand-blue-800 text-white px-6 py-3 rounded-xl font-semibold text-sm"
              >
                <Plus className="w-5 h-5" />
                Нов протокол
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {protocols.map(p => renderProtocolRow(p))}
            {protocols.length < total && (
              <button
                onClick={() => {
                  const p = page + 1;
                  setPage(p);
                  void load(p, currentFilters());
                }}
                disabled={loading}
                className="w-full py-3 text-sm text-brand-blue-700 font-semibold flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Зареди още
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
