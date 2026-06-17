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
import { formatAdminPriceEuro } from "@/lib/admin/formatEuro";

type ContactChoice = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
};

export type ProductReservationTarget = {
  id: string;
  name: string;
  price: number;
  model_code?: string | null;
  brands?: { name?: string | null } | null;
};

type ReservationForm = {
  reservationDate: string;
  agreedPrice: string;
  contactId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerEmail: string;
  notes: string;
};

function productLabel(p: ProductReservationTarget): string {
  const parts = [p.brands?.name, p.name, p.model_code ? `(${p.model_code})` : null].filter(Boolean);
  return parts.join(" ") || p.name;
}

function emptyFormForProduct(p: ProductReservationTarget): ReservationForm {
  const today = new Date().toISOString().slice(0, 10);
  return {
    reservationDate: today,
    agreedPrice: p.price != null && Number.isFinite(Number(p.price)) ? String(p.price) : "",
    contactId: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerEmail: "",
    notes: "",
  };
}

export function ProductReservationModal({
  open,
  product,
  onClose,
  onSuccess,
}: {
  open: boolean;
  product: ProductReservationTarget | null;
  onClose: () => void;
  onSuccess: (result: { productName: string; customerName: string; amount: number }) => void;
}) {
  const draftKey = product ? `adminDraft:reservation:${product.id}` : null;
  const [form, setForm] = useState<ReservationForm>(() =>
    product ? emptyFormForProduct(product) : emptyFormForProduct({ id: "", name: "", price: 0 }),
  );
  const [contactQuery, setContactQuery] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactResults, setContactResults] = useState<ContactChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore draft when modal opens; reset to defaults if no draft saved for this product
  useEffect(() => {
    if (!open || !product) return;
    setContactQuery("");
    setContactResults([]);
    setError(null);
    if (draftKey) {
      try {
        const saved = sessionStorage.getItem(draftKey);
        if (saved) { setForm(JSON.parse(saved) as ReservationForm); return; }
      } catch { /* ignore */ }
    }
    setForm(emptyFormForProduct(product));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, draftKey]);

  // Auto-save draft while typing
  useEffect(() => {
    if (!open || !draftKey) return;
    try { sessionStorage.setItem(draftKey, JSON.stringify(form)); } catch { /* ignore */ }
  }, [form, open, draftKey]);

  useEffect(() => {
    if (!open || !product) return;
    const q = contactQuery.trim();
    if (q.length < 2) {
      setContactResults([]);
      return;
    }
    let cancelled = false;
    setContactLoading(true);
    fetch(`/api/admin/contacts?q=${encodeURIComponent(q)}&kind=client&perPage=12`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setContactResults((json as { data?: ContactChoice[] }).data ?? []);
      })
      .catch(() => {
        if (!cancelled) setContactResults([]);
      })
      .finally(() => {
        if (!cancelled) setContactLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contactQuery, open, product?.id]);

  async function createContactFromForm() {
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
        kind: "client",
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка при създаване на контакт");
    const c = (json as { data: ContactChoice }).data;
    setForm((s) => ({ ...s, contactId: c.id }));
    setContactQuery(c.full_name);
    setContactResults([c]);
  }

  async function submit() {
    if (!product) return;
    setBusy(true);
    setError(null);
    try {
      let contactId = form.contactId.trim() || null;
      if (!contactId && form.customerName.trim() && form.customerPhone.trim()) {
        await assertNoContactPrimaryPhoneDuplicate(form.customerPhone.trim());
        const contactRes = await fetch("/api/admin/contacts", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fullName: form.customerName.trim(),
            phone: form.customerPhone.trim(),
            email: form.customerEmail.trim() || null,
            address: form.customerAddress.trim() || null,
            notes: form.notes.trim() || null,
            kind: "client",
          }),
        });
        const contactJson = (await contactRes.json().catch(() => ({}))) as { data?: ContactChoice; error?: string };
        if (!contactRes.ok) throw new Error(contactJson.error || "Грешка при създаване на контакт");
        contactId = contactJson.data?.id ?? null;
      }

      const agreedRaw = form.agreedPrice.trim().replace(",", ".");
      const agreedPrice = agreedRaw !== "" && Number.isFinite(Number(agreedRaw)) ? Number(agreedRaw) : null;

      const res = await fetch("/api/admin/product-reservations", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          contactId,
          customerName: form.customerName.trim(),
          customerPhone: form.customerPhone.trim(),
          customerAddress: form.customerAddress.trim() || null,
          notes: form.notes.trim() || null,
          agreedPrice,
          reservationDate: form.reservationDate.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Грешка при резервация");

      const unitPrice =
        agreedPrice != null && Number.isFinite(agreedPrice) ? agreedPrice : Number(product.price);
      onSuccess({
        productName: product.name,
        customerName: form.customerName.trim(),
        amount: unitPrice,
      });
      if (draftKey) { try { sessionStorage.removeItem(draftKey); } catch { /* ignore */ } }
      onClose();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  if (!open || !product) return null;

  return (
    <AdminModalBackdrop open onClose={onClose} busy={busy} layerId="product-reservation">
      <div className={`${ADMIN_MODAL_PANEL} max-w-2xl`} onClick={(e) => e.stopPropagation()}>
        <AdminModalDragHandle />
        <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#ffffff_42%,#f0f9ff_100%)] px-4 py-4 md:px-6 md:py-5 shrink-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">Резервация</div>
          <div className="mt-1 text-lg md:text-2xl font-black leading-tight text-slate-950">{productLabel(product)}</div>
          <div className="mt-1 hidden text-sm font-medium text-slate-500 sm:block">
            Запазва продукта за клиент. Статусът става „Резервиран“ — не се показва като свободен в каталога.
          </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="shrink-0 mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 overflow-y-auto p-4 md:p-6 md:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-600">Дата на резервацията *</span>
            <Input
              type="date"
              value={form.reservationDate}
              onChange={(e) => setForm((s) => ({ ...s, reservationDate: e.target.value }))}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-600">Договорена цена (€)</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.agreedPrice}
              onChange={(e) => setForm((s) => ({ ...s, agreedPrice: e.target.value }))}
              placeholder={String(product.price)}
            />
          </label>

          <div className="relative md:col-span-2">
            <Input
              value={contactQuery}
              onChange={(e) => {
                setContactQuery(e.target.value);
                setForm((s) => ({ ...s, contactId: "" }));
              }}
              placeholder="Търси клиент (име/телефон)..."
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
                          customerName: c.full_name,
                          customerPhone: c.phone,
                          customerAddress: c.address ?? "",
                          customerEmail: c.email ?? "",
                        }));
                        setContactQuery(c.full_name);
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
          />
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((s) => ({ ...s, notes: e.target.value }))}
            placeholder="Бележки (по желание)"
            rows={2}
            className="md:col-span-2 min-h-[2.75rem]"
          />

          {error ? (
            <div className="md:col-span-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
              {error}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 p-4 md:flex-row md:items-center md:justify-between md:p-6 shrink-0">
          <div className="text-sm font-bold text-slate-600">
            Каталог: €{formatAdminPriceEuro(Number(product.price), { decimals: true })}
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={busy}>
              Отказ
            </Button>
            <Button
              onClick={() => void submit()}
              disabled={busy || !form.customerName.trim() || !form.customerPhone.trim() || !form.reservationDate.trim()}
              className="!bg-sky-600 hover:!bg-sky-700"
            >
              {busy ? "Запис..." : "Запази резервацията"}
            </Button>
          </div>
        </div>
      </div>
    </AdminModalBackdrop>
  );
}
