"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Select,
  ADMIN_MODAL_PANEL,
  AdminModalBackdrop,
  AdminModalDragHandle,
  AdminContactSuggestRow,
} from "../ui";
import { assertNoContactPrimaryPhoneDuplicate } from "@/lib/admin/contactPhoneConflictClient";
import {
  groupSupplierNames,
  mergeSupplierGroups,
  normalizeSupplierKey,
  type GroupedSupplier,
} from "@/lib/admin/supplierNameNormalize";
import { notifyAdminCalendarReload } from "@/lib/admin/calendarReload";
import { formatAdminPriceEuro } from "@/lib/admin/formatEuro";

type ContactChoice = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
};

export type ProductSupplierOrderTarget = {
  id: string;
  name: string;
  price: number;
  purchase_price?: number | null;
  model_code?: string | null;
  brands?: { name?: string | null } | null;
  supplier?: { full_name?: string | null } | { full_name?: string | null }[] | null;
};

type OrderForm = {
  quantity: string;
  orderDate: string;
  purchasePrice: string;
  agreedPrice: string;
  supplierKey: string;
  contactId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerEmail: string;
  notes: string;
};

function productLabel(p: ProductSupplierOrderTarget): string {
  const parts = [p.brands?.name, p.name, p.model_code ? `(${p.model_code})` : null].filter(Boolean);
  return parts.join(" ") || p.name;
}

function supplierNameFromProduct(p: ProductSupplierOrderTarget): string {
  const s = p.supplier;
  if (!s) return "";
  if (Array.isArray(s)) return (s[0]?.full_name ?? "").trim();
  return (s.full_name ?? "").trim();
}

function emptyFormForProduct(p: ProductSupplierOrderTarget, supplierKey = ""): OrderForm {
  const today = new Date().toISOString().slice(0, 10);
  return {
    quantity: "1",
    orderDate: today,
    purchasePrice: p.purchase_price != null ? String(p.purchase_price) : "",
    agreedPrice: p.price != null ? String(p.price) : "",
    supplierKey,
    contactId: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerEmail: "",
    notes: "",
  };
}

export function ProductSupplierOrderModal({
  open,
  product,
  onClose,
  onSuccess,
}: {
  open: boolean;
  product: ProductSupplierOrderTarget | null;
  onClose: () => void;
  onSuccess: (result: { productName: string; customerName: string; amount: number; quantity: number }) => void;
}) {
  const draftKey = product ? `adminDraft:supplierOrder:${product.id}` : null;
  const [form, setForm] = useState<OrderForm>(() =>
    product ? emptyFormForProduct(product) : emptyFormForProduct({ id: "", name: "", price: 0 }),
  );
  const [supplierOptions, setSupplierOptions] = useState<GroupedSupplier[]>([]);
  const [contactQuery, setContactQuery] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactResults, setContactResults] = useState<ContactChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore draft when modal opens; reset to defaults if no draft saved for this product
  useEffect(() => {
    if (!open || !draftKey || !product) return;
    try {
      const saved = sessionStorage.getItem(draftKey);
      if (saved) { setForm(JSON.parse(saved) as OrderForm); return; }
    } catch { /* ignore */ }
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
    void Promise.all([
      fetch("/api/admin/contacts?kind=supplier&perPage=500", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/meta/sale-suppliers", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([contactsJson, saleSuppliersJson]) => {
        const contactNames: string[] = [];
        for (const row of (contactsJson as { data?: { full_name?: string }[] }).data ?? []) {
          const n = (row.full_name ?? "").trim();
          if (n) contactNames.push(n);
        }
        const saleGroups = (saleSuppliersJson as { data?: GroupedSupplier[] }).data ?? [];
        const options = mergeSupplierGroups(groupSupplierNames(contactNames), saleGroups);
        setSupplierOptions(options);
        const supplierRaw = supplierNameFromProduct(product);
        const supplierKey = supplierRaw
          ? options.find((s) => s.key === normalizeSupplierKey(supplierRaw))?.key ??
            normalizeSupplierKey(supplierRaw)
          : "";
        setForm(emptyFormForProduct(product, supplierKey));
        setContactQuery("");
        setContactResults([]);
        setError(null);
      })
      .catch(() => {
        setSupplierOptions([]);
        setForm(emptyFormForProduct(product));
      });
  }, [open, product?.id]);

  useEffect(() => {
    if (!open || !contactQuery.trim()) {
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
  }, [contactQuery, open]);

  function supplierLabelForSubmit(): string | null {
    if (!form.supplierKey.trim()) return null;
    const g = supplierOptions.find((s) => s.key === form.supplierKey);
    return g?.label ?? form.supplierKey;
  }

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
    if (!product) return;
    if (!form.orderDate.trim()) {
      setError("Посочете дата на поръчката.");
      return;
    }
    const quantityRaw = form.quantity.trim();
    const quantity = quantityRaw === "" ? 1 : Number(quantityRaw.replace(",", "."));
    if (!Number.isFinite(quantity) || quantity < 1 || !Number.isInteger(quantity)) {
      setError("Въведете валидно количество (цяло число ≥ 1).");
      return;
    }

    const purchasePriceRaw = form.purchasePrice.trim();
    const purchasePrice = purchasePriceRaw === "" ? null : Number(purchasePriceRaw.replace(",", "."));
    const agreedRaw = form.agreedPrice.trim();
    const agreedPrice = agreedRaw === "" ? null : Number(agreedRaw.replace(",", "."));

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/supplier-orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          orderDate: form.orderDate,
          quantity,
          purchasePrice: purchasePrice != null && Number.isFinite(purchasePrice) ? purchasePrice : null,
          agreedPrice: agreedPrice != null && Number.isFinite(agreedPrice) ? agreedPrice : null,
          supplierName: supplierLabelForSubmit(),
          contactId: form.contactId || null,
          customerName: form.customerName.trim() || null,
          customerPhone: form.customerPhone.trim() || null,
          customerAddress: form.customerAddress.trim() || null,
          customerEmail: form.customerEmail.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Грешка при запис на поръчката");
      notifyAdminCalendarReload();
      const unitPrice =
        agreedPrice != null && Number.isFinite(agreedPrice) ? agreedPrice : Number(product.price);
      onSuccess({
        productName: product.name,
        customerName: form.customerName.trim() || "Обща поръчка",
        amount: unitPrice * quantity,
        quantity,
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

  const unitDisplay =
    form.agreedPrice.trim() !== "" && Number.isFinite(Number(form.agreedPrice.replace(",", ".")))
      ? Number(form.agreedPrice.replace(",", "."))
      : Number(product.price);
  const qtyDisplay = Math.max(1, Number(form.quantity.replace(",", ".")) || 1);

  return (
    <AdminModalBackdrop open onClose={onClose} busy={busy} layerId="product-supplier-order">
      <div className={`${ADMIN_MODAL_PANEL} max-w-3xl`} onClick={(e) => e.stopPropagation()}>
        <AdminModalDragHandle />
        <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#ede9fe_0,#ffffff_42%,#e6f9fd_100%)] px-4 py-4 md:px-6 md:py-5 shrink-0 flex items-start justify-between gap-3">
          <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-violet-700">Поръчка от доставчик</div>
          <div className="mt-1 text-lg md:text-2xl font-black leading-tight text-slate-950">{productLabel(product)}</div>
          <div className="mt-1 hidden text-sm font-medium text-slate-500 sm:block">
            Записва поръчка в статус „чака доставка“. Клиентът не е задължителен — попълнете количество, цени и доставчик.
          </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Close" className="shrink-0 mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 overflow-y-auto p-4 md:p-6 md:grid-cols-2">
          <div className="md:col-span-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2 text-sm font-bold text-slate-800">
            {productLabel(product)}
            <span className="ml-2 font-medium text-slate-500">
              · каталог €{formatAdminPriceEuro(Number(product.price), { decimals: true })}
            </span>
          </div>

          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-600">Дата на поръчката *</span>
            <Input type="date" value={form.orderDate} onChange={(e) => setForm((s) => ({ ...s, orderDate: e.target.value }))} />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-600">Количество *</span>
            <Input
              type="number"
              min={1}
              step={1}
              value={form.quantity}
              onChange={(e) => setForm((s) => ({ ...s, quantity: e.target.value }))}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-600">Закупна цена (€)</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.purchasePrice}
              onChange={(e) => setForm((s) => ({ ...s, purchasePrice: e.target.value }))}
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-xs font-bold text-slate-600">Договорена цена с клиент (€)</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.agreedPrice}
              onChange={(e) => setForm((s) => ({ ...s, agreedPrice: e.target.value }))}
              placeholder={String(product.price)}
            />
          </label>

          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-bold text-slate-600">Доставчик</span>
            <Select value={form.supplierKey} onChange={(e) => setForm((s) => ({ ...s, supplierKey: e.target.value }))}>
              <option value="">— изберете —</option>
              {supplierOptions.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </label>

          <div className="col-span-full border-t border-slate-100 pt-3">
            <div className="mb-2 text-xs font-black uppercase tracking-wide text-violet-700">Клиент (по избор)</div>
          </div>

          <div className="relative col-span-full">
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
            placeholder="Контактно лице"
          />
          <Input
            value={form.customerPhone}
            onChange={(e) => setForm((s) => ({ ...s, customerPhone: e.target.value }))}
            placeholder="Телефон"
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
            className="min-h-[2.75rem] md:col-span-2"
          />
        </div>

        {error && (
          <div className="mx-6 mb-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
          <span className="text-sm font-black text-violet-800">
            Общо: €{formatAdminPriceEuro(unitDisplay * qtyDisplay, { decimals: true })}
            {qtyDisplay > 1 ? ` (${qtyDisplay} × €${formatAdminPriceEuro(unitDisplay, { decimals: true })})` : ""}
          </span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" disabled={busy} onClick={onClose}>
              Отказ
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => createContactInline().catch((e) => setError(String(e)))}>
              + Нов контакт
            </Button>
            <Button disabled={busy} onClick={() => void submit()}>
              {busy ? "Запис..." : "Запиши поръчката"}
            </Button>
          </div>
        </div>
      </div>
    </AdminModalBackdrop>
  );
}
