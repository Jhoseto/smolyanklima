"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, RefreshCw, Search, Download, Link2, Pencil, Trash2, Eye, FileText, Check,
} from "lucide-react";
import {
  Button, Input, Card,
  ADMIN_MODAL_BACKDROP, ADMIN_MODAL_PANEL, AdminModalDragHandle, useAdminBackHandler,
} from "../../../ui";
import {
  OfferEditor, emptyOfferEditor, offerToEditor, editorToPayload, validateOfferEditor, type OfferEditorValue,
} from "./OfferEditor";
import { formatOfferMoney } from "@/lib/offers/calcTotals";
import { publicOfferPageUrl } from "@/lib/publicCatalogUrl";

type OfferListRow = {
  id: string;
  offer_number: string;
  client_name: string | null;
  title: string | null;
  valid_until: string | null;
  total_incl_vat: number;
  currency: string;
  public_token: string;
  public_enabled: boolean;
  created_at: string;
};

function fmtDate(v: string | null): string {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("bg-BG");
  } catch {
    return v;
  }
}

function publicOfferUrl(token: string): string {
  return publicOfferPageUrl(token);
}

export function OffersClient() {
  const [rows, setRows] = useState<OfferListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editor, setEditor] = useState<OfferEditorValue>(emptyOfferEditor());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<OfferListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useAdminBackHandler(Boolean(deleteTarget || (editorOpen && editorMode === "edit")), () => {
    if (deleteTarget) setDeleteTarget(null);
    else setEditorOpen(false);
  }, "offers-modal");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    sp.set("perPage", "100");
    return sp.toString();
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/service/offers?${qs}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка при зареждане");
      setRows((json as { data?: OfferListRow[] }).data ?? []);
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [qs]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditorMode("create");
    setEditingId(null);
    setEditor(emptyOfferEditor());
    setSaveError(null);
    setEditorOpen(true);
  }

  async function openEdit(row: OfferListRow) {
    setSaveError(null);
    setEditorMode("edit");
    setEditingId(row.id);
    try {
      const res = await fetch(`/api/admin/service/offers/${row.id}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка");
      setEditor(offerToEditor((json as { data: Parameters<typeof offerToEditor>[0] }).data));
      setEditorOpen(true);
    } catch (e: unknown) {
      setToast(String(e instanceof Error ? e.message : e));
    }
  }

  async function saveEditor() {
    setSaving(true);
    setSaveError(null);
    try {
      const payload = editorToPayload(editor);
      const validationError = validateOfferEditor(editor);
      if (validationError) throw new Error(validationError);
      const url = editorMode === "create" ? "/api/admin/service/offers" : `/api/admin/service/offers/${editingId}`;
      const method = editorMode === "create" ? "POST" : "PUT";
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка при запис");
      setEditorOpen(false);
      setToast(editorMode === "create" ? "Офертата е създадена" : "Запазено");
      void load();
    } catch (e: unknown) {
      setSaveError(String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  }

  async function downloadPdf(row: OfferListRow) {
    try {
      const res = await fetch(`/api/admin/service/offers/${row.id}/pdf`, { credentials: "include" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error((json as { error?: string }).error || "Грешка при PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cd = res.headers.get("Content-Disposition") || "";
      const utf8Match = /filename\*=UTF-8''([^;\n]+)/i.exec(cd);
      const asciiMatch = /filename="([^"]+)"/i.exec(cd);
      const fromHeader = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : asciiMatch
          ? asciiMatch[1]
          : null;
      const client = (row.client_name || "klient").replace(/[^\wа-яА-Я\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 40);
      const datePart = row.created_at ? new Date(row.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
      a.download = fromHeader || `oferta-${client || "klient"}-${datePart}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setToast(String(e instanceof Error ? e.message : e));
    }
  }

  async function copyLink(row: OfferListRow) {
    const url = publicOfferUrl(row.public_token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId(null), 1500);
      setToast("Линкът е копиран");
    } catch {
      setToast(url);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/service/offers/${deleteTarget.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка");
      setDeleteTarget(null);
      setToast("Изтрита");
      void load();
    } catch (e: unknown) {
      setToast(String(e instanceof Error ? e.message : e));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="w-full space-y-3 p-3 md:p-4 max-w-5xl mx-auto">
      {toast && (
        <div className="fixed top-3 right-3 z-50 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800 shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-slate-900 md:text-xl">Оферти</h1>
          <p className="text-xs text-slate-500">Професионални оферти към клиенти — PDF и споделяем линк</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Нова оферта
          </Button>
          <Button variant="secondary" onClick={() => void load()} className="gap-2">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card className="p-2.5 md:p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Търсене…" className="pl-9" />
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
          <RefreshCw className="h-4 w-4 animate-spin" /> Зареждане…
        </div>
      )}
      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {!loading && !error && (
        <div className="space-y-2">
          {rows.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center">
              <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">Няма оферти. Създайте първата.</p>
            </div>
          )}
          {rows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-black text-slate-900">{row.offer_number}</div>
                  <div className="mt-0.5 text-sm font-semibold text-slate-800 truncate">
                    {row.client_name || "—"}
                    {row.title ? ` · ${row.title}` : ""}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {fmtDate(row.created_at)}
                    {row.valid_until ? ` · валидна до ${fmtDate(row.valid_until)}` : ""}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-black tabular-nums text-brand-orange-600">
                    {formatOfferMoney(Number(row.total_incl_vat), row.currency)}
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">с ДДС</div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Button variant="secondary" size="sm" onClick={() => void openEdit(row)} title="Редактирай">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void downloadPdf(row)} title="PDF">
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="secondary" size="sm" onClick={() => void copyLink(row)} title="Копирай линк">
                  {copiedId === row.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Link2 className="h-3.5 w-3.5" />}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open(publicOfferUrl(row.public_token), "_blank")}
                  title="Отвори линк"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button variant="danger" size="sm" onClick={() => setDeleteTarget(row)} title="Изтрий">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editorOpen && (
        <div
          className={ADMIN_MODAL_BACKDROP}
          onClick={editorMode === "edit" && !saving ? () => setEditorOpen(false) : undefined}
        >
          <div
            className={`${ADMIN_MODAL_PANEL} md:max-w-none md:w-[min(96vw,1400px)] md:h-[92vh]`}
            onClick={(e) => e.stopPropagation()}
          >
            <AdminModalDragHandle />
            <OfferEditor
              value={editor}
              onChange={setEditor}
              onClose={() => setEditorOpen(false)}
              onSave={() => void saveEditor()}
              saving={saving}
              error={saveError}
              mode={editorMode}
            />
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className={ADMIN_MODAL_BACKDROP} onClick={() => !deleting && setDeleteTarget(null)}>
          <div className={`${ADMIN_MODAL_PANEL} md:max-w-md`} onClick={(e) => e.stopPropagation()}>
            <AdminModalDragHandle />
            <div className="border-b border-slate-100 px-5 py-4 text-base font-bold">
              Изтриване на {deleteTarget.offer_number}?
            </div>
            <div className="px-5 py-4 text-sm text-slate-600">Действието е необратимо.</div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <Button variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Отказ
              </Button>
              <Button variant="danger" onClick={() => void confirmDelete()} disabled={deleting}>
                {deleting ? "Изтривам…" : "Изтрий"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
