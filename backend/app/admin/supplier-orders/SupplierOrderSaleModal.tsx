"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  ADMIN_MODAL_PANEL,
  AdminModalBackdrop,
  AdminModalDragHandle,
  AdminContactSuggestRow,
} from "../ui";
import { assertNoContactPrimaryPhoneDuplicate } from "@/lib/admin/contactPhoneConflictClient";
import { canRecordProductSale, recordProductSale } from "@/lib/admin/recordProductSale";
import type { NormalizedSupplierOrderRow } from "@/lib/admin/supplierOrderRow";

type ContactChoice = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
};

function defaultNextMountDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function emptyForm(order: NormalizedSupplierOrderRow) {
  const c = order.contacts;
  return {
    contactId: order.contact_id ?? c?.id ?? "",
    customerName: order.customer_name ?? c?.full_name ?? "",
    customerPhone: order.customer_phone ?? c?.phone ?? "",
    customerAddress: order.customer_address ?? c?.address ?? "",
    customerEmail: c?.email ?? "",
    notes: order.notes ?? "",
    includeMount: true,
    mountDate: defaultNextMountDate(),
    mountTimeFrom: "09:00",
    mountTimeTo: "13:00",
  };
}

export function SupplierOrderSaleModal({
  order,
  onClose,
  onSuccess,
}: {
  order: NormalizedSupplierOrderRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const dp = order.delivered_product;
  const [form, setForm] = useState(() => emptyForm(order));
  const [contactQuery, setContactQuery] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactResults, setContactResults] = useState<ContactChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const productName = dp?.name ?? order.products?.name ?? order.title;

  useEffect(() => {
    if (!contactQuery.trim()) {
      setContactResults([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setContactLoading(true);
      try {
        const res = await fetch(
          `/api/admin/contacts?q=${encodeURIComponent(contactQuery.trim())}&perPage=8`,
          { credentials: "include" },
        );
        const json = await res.json().catch(() => ({}));
        if (res.ok) setContactResults((json as { data?: ContactChoice[] }).data ?? []);
      } finally {
        setContactLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [contactQuery]);

  async function createContactInline() {
    if (!form.customerName.trim() || !form.customerPhone.trim()) return;
    await assertNoContactPrimaryPhoneDuplicate(form.customerPhone.trim());
    const res = await fetch("/api/admin/contacts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.customerName.trim(),
        phone: form.customerPhone.trim(),
        email: form.customerEmail.trim() || null,
        address: form.customerAddress.trim() || null,
        notes: form.notes.trim() || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка при създаване на контакт");
    const c = (json as { data: ContactChoice }).data;
    setForm((s) => ({ ...s, contactId: c.id }));
    setContactQuery(`${c.full_name} (${c.phone})`);
    setContactResults([]);
  }

  async function submit() {
    if (!dp) {
      setError("Липсва доставена бройка за продажба.");
      return;
    }
    if (!form.customerName.trim() || !form.customerPhone.trim()) {
      setError("Въведете име и телефон на клиента.");
      return;
    }
    if (!canRecordProductSale(dp.stock_status)) {
      setError("Продажбата не е възможна — бройката не е в наличност.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const withInstallation = form.includeMount;
      await recordProductSale(
        {
          id: dp.id,
          name: dp.name,
          price: Number(dp.price ?? order.unit_price ?? 0),
          model_code: dp.model_code,
          stock_status: dp.stock_status,
          stock_quantity: dp.stock_quantity,
          sold_quantity: dp.sold_quantity,
          brand_id: dp.brand_id,
        },
        {
          id: form.contactId || undefined,
          name: form.customerName.trim(),
          phone: form.customerPhone.trim(),
          address: form.customerAddress.trim(),
          email: form.customerEmail.trim(),
          notes: form.notes.trim(),
        },
        withInstallation
          ? {
              date: form.mountDate,
              timeFrom: form.mountTimeFrom,
              timeTo: form.mountTimeTo,
            }
          : null,
        { withInstallation },
      );
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminModalBackdrop open onClose={onClose} busy={busy} layerId="supplier-order-sale">
      <div
        className={`${ADMIN_MODAL_PANEL} max-w-3xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <AdminModalDragHandle />
        <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e6f9fd_0,#ffffff_42%,#fff3ed_100%)] px-4 py-4 md:px-6 md:py-5 shrink-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand-blue-700">Продажба след доставка</div>
          <div className="mt-1 text-lg md:text-2xl font-black leading-tight text-slate-950">{productName}</div>
          <div className="mt-1 text-sm font-medium text-slate-500 hidden sm:block">
            Клиентът от поръчката е попълнен по подразбиране. Може да изберете продажба с или без монтаж.
          </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="shrink-0 mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 overflow-y-auto p-4 md:p-6 md:grid-cols-2">
          <div className="col-span-full relative">
            <Input
              value={contactQuery}
              onChange={(e) => {
                setContactQuery(e.target.value);
                setForm((s) => ({ ...s, contactId: "" }));
              }}
              placeholder="Търси контакт (име/телефон)..."
            />
            {(contactLoading || contactResults.length > 0) && (
              <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-32 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
                {contactLoading ? (
                  <div className="p-3 text-center text-sm text-slate-500">Търсене...</div>
                ) : (
                  contactResults.map((c) => (
                    <AdminContactSuggestRow
                      key={c.id}
                      name={c.full_name}
                      phone={c.phone}
                      email={c.email}
                      onSelect={() => {
                        setForm((s) => ({
                          ...s,
                          contactId: c.id,
                          customerName: c.full_name || "",
                          customerPhone: c.phone || "",
                          customerAddress: c.address || "",
                          customerEmail: c.email || "",
                        }));
                        setContactQuery(`${c.full_name} (${c.phone})`);
                        setContactResults([]);
                      }}
                    />
                  ))
                )}
              </div>
            )}
          </div>
          <Input
            value={form.customerName}
            onChange={(e) => setForm((s) => ({ ...s, customerName: e.target.value }))}
            placeholder="Контактно лице*"
          />
          <Input
            value={form.customerPhone}
            onChange={(e) => setForm((s) => ({ ...s, customerPhone: e.target.value }))}
            placeholder="Телефон*"
          />
          <Input
            value={form.customerEmail}
            onChange={(e) => setForm((s) => ({ ...s, customerEmail: e.target.value }))}
            placeholder="Имейл"
          />
          <Input
            value={form.customerAddress}
            onChange={(e) => setForm((s) => ({ ...s, customerAddress: e.target.value }))}
            placeholder="Адрес"
            className="md:col-span-2"
          />
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Бележки"
            rows={2}
            className="md:col-span-2 min-h-[2.75rem]"
          />

          <div className="col-span-full border-t border-slate-100 pt-3 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <input
                type="checkbox"
                checked={form.includeMount}
                onChange={(e) => setForm((s) => ({ ...s, includeMount: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-blue-600 focus:ring-brand-blue-500"
              />
              <span className="text-sm text-slate-700 leading-snug">
                <span className="font-bold text-slate-900">С монтаж</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Изключете за продажба само на уред — без насрочване в календара.
                </span>
              </span>
            </label>
            {form.includeMount ? (
              <>
                <div className="text-xs font-black uppercase tracking-wide text-brand-blue-700">Монтаж</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-slate-600">Дата *</span>
                    <Input type="date" value={form.mountDate} onChange={(e) => setForm((s) => ({ ...s, mountDate: e.target.value }))} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-slate-600">Час от</span>
                    <Input type="time" value={form.mountTimeFrom} onChange={(e) => setForm((s) => ({ ...s, mountTimeFrom: e.target.value }))} />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-xs font-bold text-slate-600">Час до</span>
                    <Input type="time" value={form.mountTimeTo} onChange={(e) => setForm((s) => ({ ...s, mountTimeTo: e.target.value }))} />
                  </label>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2">
                Продажбата ще бъде записана като <strong className="text-slate-700">завършена</strong> в панела „Продажби“.
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-6 mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <span className="text-sm font-bold text-slate-700">
            €{Number(dp?.price ?? order.unit_price ?? 0).toLocaleString()}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => createContactInline().catch((e) => setError(String(e)))}>
              + Нов контакт
            </Button>
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              Отказ
            </Button>
            <Button variant="primary" disabled={busy} onClick={() => void submit()}>
              {busy ? "Запис..." : "Запиши продажба"}
            </Button>
          </div>
        </div>
      </div>
    </AdminModalBackdrop>
  );
}
