"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Plus, FileText, ChevronRight, Download,
  Clock, CheckCircle, Send, Loader2, Search,
} from "lucide-react";
import { ProtocolFormWizard } from "./ProtocolFormWizard";
import { ProtocolPreview } from "./ProtocolPreview";
import type { AdminRole } from "@/lib/admin/db";

type ProtocolStatus = "draft" | "signed" | "sent";

interface Protocol {
  id: string;
  protocol_number: string;
  date: string;
  client_name: string | null;
  ac_model: string | null;
  address: string | null;
  status: ProtocolStatus;
  created_at: string;
}

const STATUS_CONFIG: Record<ProtocolStatus, { label: string; icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  draft:  { label: "Чернова",  icon: Clock,         cls: "bg-amber-100 text-amber-700" },
  signed: { label: "Подписан", icon: CheckCircle,   cls: "bg-green-100 text-green-700" },
  sent:   { label: "Изпратен", icon: Send,           cls: "bg-blue-100  text-blue-700"  },
};

interface Props {
  role: AdminRole;
}

export function DocumentsClient({ role }: Props) {
  const [protocols, setProtocols]     = useState<Protocol[]>([]);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [openForm, setOpenForm]       = useState(false);
  const [editId, setEditId]           = useState<string | null>(null);
  const [preview, setPreview]         = useState<Protocol | null>(null);
  const perPage = 20;

  const load = useCallback(async (p = 1, q = "") => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), perPage: String(perPage) });
      if (q) params.set("q", q);
      const res = await fetch(`/api/admin/service/protocols?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      const rows = json.data ?? [];
      setProtocols(prev => (p === 1 ? rows : [...prev, ...rows]));
      setTotal(json.meta?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1, search); }, [load, search]);

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

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });

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
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-base font-bold text-slate-900">Протоколи</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {total > 0 ? `${total} протокола` : "Няма протоколи"}
            </p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-semibold text-sm active:bg-blue-700 shadow-sm"
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

        {loading && protocols.length === 0 ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
          </div>
        ) : protocols.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white border-2 border-dashed border-slate-200 flex items-center justify-center">
              <FileText className="w-7 h-7 text-slate-300" />
            </div>
            <div>
              <p className="font-bold text-slate-700">Няма протоколи</p>
              <p className="text-sm text-slate-400 mt-1">Създайте нов протокол при следващ монтаж</p>
            </div>
            <button
              onClick={handleNew}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold text-sm"
            >
              <Plus className="w-5 h-5" />
              Нов протокол
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {protocols.map(p => {
              const st = STATUS_CONFIG[p.status];
              const Icon = st.icon;
              return (
                <div
                  key={p.id}
                  onClick={() => openPreview(p)}
                  className="bg-white rounded-2xl border border-slate-100 p-4 flex items-center gap-3 cursor-pointer active:bg-slate-50 shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-bold text-slate-900 truncate">{p.protocol_number}</p>
                      <span className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${st.cls}`}>
                        <Icon className="w-3 h-3" />
                        {st.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 truncate">
                      {p.client_name ?? "—"}{p.ac_model ? ` · ${p.ac_model}` : ""}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(p.date)}</p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={e => downloadPdf(e, p.id)}
                      className="p-2 text-slate-400 active:text-slate-700 active:bg-slate-100 rounded-lg"
                      title="Свали PDF"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              );
            })}

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
        )}
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
