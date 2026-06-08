"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, ExternalLink } from "lucide-react";
import { Button, Table, Th, Td, AdminPhoneLink } from "../ui";
import { ProductQuickViewButton } from "../ProductQuickView";
import { useAdminBackHandler } from "@/lib/admin/useAdminBackHandler";
import { inquiryServiceTypeLabel } from "@/lib/inquiry/serviceTypeLabels";
import {
  contactHistoryEventTitle,
  contactHistoryTypeBadgeClass,
  contactHistoryTypeLabel,
} from "@/lib/admin/contactHistoryLabels";
import { canonicalPhoneDigits } from "@/lib/admin/phoneSearchPattern";

export type ContactHistoryTarget = {
  contactId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
};

type ContactSummary = {
  id: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  contact_kind?: string | null;
};

type ContactHistoryRow = {
  id: string;
  source?: "work_item" | "inquiry";
  event_code?: string | null;
  type: string;
  status: "planned" | "in_progress" | "done" | "cancelled" | "new" | "spam";
  title: string;
  due_date?: string | null;
  total_amount?: number | null;
  created_at: string;
  products?: { id?: string; name?: string; slug?: string } | null;
  service_type?: string | null;
};

function fmtEuro(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `€${Number(n).toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadgeClass(status: ContactHistoryRow["status"]): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap border";
  if (status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (status === "in_progress") return `${base} bg-brand-blue-100 border-brand-blue-200 text-brand-blue-700`;
  if (status === "planned") return `${base} bg-amber-100 border-amber-200 text-amber-800`;
  if (status === "new") return `${base} bg-violet-100 border-violet-200 text-violet-800`;
  if (status === "spam") return `${base} bg-red-100 border-red-200 text-red-800`;
  return `${base} bg-slate-100 border-slate-200 text-slate-600`;
}

function statusLabel(status: ContactHistoryRow["status"]): string {
  if (status === "planned") return "Чака";
  if (status === "in_progress") return "В процес";
  if (status === "done") return "Изпълнена";
  if (status === "new") return "Ново";
  if (status === "spam") return "Спам";
  if (status === "cancelled") return "Отказана";
  return status;
}

async function resolveContactId(target: ContactHistoryTarget): Promise<string | null> {
  if (target.contactId) return target.contactId;

  const phone = (target.customerPhone ?? "").trim();
  if (phone) {
    const res = await fetch(
      `/api/admin/contacts?kind=client&q=${encodeURIComponent(phone)}&perPage=20`,
      { credentials: "include" },
    );
    const json = (await res.json().catch(() => ({}))) as {
      data?: Array<{ id: string; phone?: string | null; full_name?: string | null }>;
    };
    if (res.ok && json.data?.length) {
      const canon = canonicalPhoneDigits(phone);
      const exact = json.data.find((c) => canonicalPhoneDigits(c.phone) === canon);
      if (exact) return exact.id;
      const loose = json.data.find((c) => (c.phone ?? "").trim() === phone);
      if (loose) return loose.id;
      if (json.data.length === 1) return json.data[0]!.id;
    }
  }

  const name = (target.customerName ?? "").trim();
  if (name.length >= 2) {
    const res = await fetch(
      `/api/admin/contacts?kind=client&q=${encodeURIComponent(name)}&perPage=20`,
      { credentials: "include" },
    );
    const json = (await res.json().catch(() => ({}))) as {
      data?: Array<{ id: string; full_name?: string | null }>;
    };
    if (res.ok && json.data?.length) {
      const lower = name.toLowerCase();
      const exact = json.data.find((c) => (c.full_name ?? "").trim().toLowerCase() === lower);
      if (exact) return exact.id;
      if (json.data.length === 1) return json.data[0]!.id;
    }
  }

  return null;
}

export function ContactNameButton({
  name,
  contactId,
  customerPhone,
  onOpen,
  className = "",
}: {
  name?: string | null;
  contactId?: string | null;
  customerPhone?: string | null;
  onOpen: (target: ContactHistoryTarget) => void;
  className?: string;
}) {
  const display = (name ?? "").trim() || "—";
  if (display === "—") {
    return <span className={className}>—</span>;
  }
  return (
    <button
      type="button"
      className={`max-w-full truncate text-left font-medium text-brand-blue-700 hover:text-brand-blue-900 hover:underline cursor-pointer ${className}`}
      title={`История: ${display}`}
      onClick={() => onOpen({ contactId, customerName: name, customerPhone })}
    >
      {display}
    </button>
  );
}

export function ContactHistoryModal({
  target,
  onClose,
}: {
  target: ContactHistoryTarget | null;
  onClose: () => void;
}) {
  const open = Boolean(target);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contact, setContact] = useState<ContactSummary | null>(null);
  const [history, setHistory] = useState<ContactHistoryRow[]>([]);

  useAdminBackHandler(open, onClose, contact?.id ? `contact-history-${contact.id}` : "contact-history");

  useEffect(() => {
    if (!target) {
      setContact(null);
      setHistory([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setContact(null);
    setHistory([]);

    void (async () => {
      try {
        const contactId = await resolveContactId(target);
        if (cancelled) return;
        if (!contactId) {
          setError("Контактът не е намерен в адресника. Добавете го от „Контакти“, за да виждате пълна история.");
          return;
        }

        const res = await fetch(`/api/admin/contacts/${contactId}`, { credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as {
          error?: string;
          data?: { contact?: ContactSummary; history?: ContactHistoryRow[] };
        };
        if (!res.ok) throw new Error(json.error || "Грешка при зареждане");
        if (cancelled) return;
        setContact(json.data?.contact ?? null);
        setHistory(json.data?.history ?? []);
      } catch (e: unknown) {
        if (!cancelled) setError(String(e instanceof Error ? e.message : e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [target]);

  if (!open) return null;

  const title = contact?.full_name ?? target?.customerName ?? "Контакт";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-950/55 p-0 md:p-4 backdrop-blur-md"
      data-admin-overlay="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92dvh] md:max-h-[90vh] overflow-hidden rounded-t-3xl md:rounded-2xl border border-white/20 bg-white shadow-2xl flex flex-col pb-safe md:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 shrink-0">
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-widest text-brand-blue-700">История на контакт</div>
            <h2 className="text-lg font-black text-slate-900 leading-tight mt-0.5 truncate">{title}</h2>
            {(contact?.phone || target?.customerPhone) && (
              <AdminPhoneLink
                phone={contact?.phone ?? target?.customerPhone}
                showIcon={false}
                className="text-xs font-medium mt-1 block"
              />
            )}
          </div>
          <button
            type="button"
            className="shrink-0 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
            onClick={onClose}
            aria-label="Затвори"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin" />
              Зареждане…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error}</div>
          )}

          {!loading && !error && contact && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {contact.email && <span className="text-xs text-slate-600">{contact.email}</span>}
                {contact.address && (
                  <span className="text-xs text-slate-500 truncate max-w-full" title={contact.address}>
                    {contact.address}
                  </span>
                )}
                <Link
                  href={`/admin/contacts?kind=${contact.contact_kind === "supplier" ? "supplier" : "client"}`}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-bold text-brand-blue-700 hover:underline"
                >
                  Отвори в контакти
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>

              <div className="hidden md:block border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm">
                <Table>
                  <thead>
                    <tr>
                      <Th>Тип</Th>
                      <Th>Събитие</Th>
                      <Th>Статус</Th>
                      <Th>Продукт</Th>
                      <Th>Сума</Th>
                      <Th>Дата</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                        <Td>
                          <span className={contactHistoryTypeBadgeClass(r)}>
                            {contactHistoryTypeLabel(r)}
                          </span>
                        </Td>
                        <Td className="font-medium text-slate-900">
                          {r.source === "inquiry"
                            ? `Запитване${r.service_type ? ` — ${inquiryServiceTypeLabel(r.service_type)}` : ""}`
                            : contactHistoryEventTitle(r)}
                        </Td>
                        <Td>
                          <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                        </Td>
                        <Td>
                          {r.products?.name ? (
                            <ProductQuickViewButton productId={r.products.id} productName={r.products.name} />
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td className="font-semibold tabular-nums">{fmtEuro(r.total_amount)}</Td>
                        <Td className="text-xs">{new Date(r.due_date || r.created_at).toLocaleString("bg-BG")}</Td>
                      </tr>
                    ))}
                    {history.length === 0 && (
                      <tr>
                        <Td colSpan={6} className="text-center py-8 text-slate-500">
                          Няма събития за този контакт.
                        </Td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>

              <div className="md:hidden space-y-2">
                {history.length === 0 && (
                  <div className="text-center py-6 text-slate-500 text-sm">Няма събития за този контакт.</div>
                )}
                {history.map((r) => (
                  <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="font-semibold text-slate-900 text-sm leading-snug">
                        {r.source === "inquiry"
                          ? `Запитване${r.service_type ? ` — ${inquiryServiceTypeLabel(r.service_type)}` : ""}`
                          : contactHistoryEventTitle(r)}
                      </div>
                      {r.total_amount != null && (
                        <span className="font-black text-slate-900 text-sm shrink-0 tabular-nums">{fmtEuro(r.total_amount)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`${contactHistoryTypeBadgeClass(r)} text-[10px]`}>
                        {contactHistoryTypeLabel(r)}
                      </span>
                      <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                      {r.products?.name && (
                        <ProductQuickViewButton productId={r.products.id} productName={r.products.name} />
                      )}
                      <span className="text-[10px] text-slate-400 ml-auto">
                        {new Date(r.due_date || r.created_at).toLocaleDateString("bg-BG")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="border-t border-slate-100 px-5 py-3 shrink-0 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Затвори
          </Button>
        </div>
      </div>
    </div>
  );
}
