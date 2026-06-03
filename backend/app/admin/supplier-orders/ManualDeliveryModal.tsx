"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import { groupSupplierNames, mergeSupplierGroups, normalizeSupplierKey, type GroupedSupplier } from "@/lib/admin/supplierNameNormalize";
import { notifyAdminCalendarReload } from "@/lib/admin/calendarReload";
import type { ProductRegion } from "@/lib/admin/productRegion";

type ContactChoice = {
  id: string;
  full_name: string;
  phone: string;
  email?: string | null;
  address?: string | null;
};

type ProductChoice = {
  id: string;
  name: string;
  price: number;
  purchase_price?: number | null;
  stock_status: string;
  product_condition?: "new" | "used" | null;
  product_region?: ProductRegion | null;
  supplier_invoice_number?: string | null;
  model_code?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  brand_id?: string | null;
  brands?: { name?: string | null } | null;
  supplier?: { full_name?: string | null } | null;
};

type BrandOption = { id: string; name: string };
type ModelOption = { modelCode: string; product: ProductChoice };
type OrderSection = "new" | "used";

type ManualOrderForm = {
  productId: string;
  productName: string;
  brandId: string;
  brandName: string;
  modelCode: string;
  productCondition: OrderSection;
  productRegion: ProductRegion;
  contactId: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  customerEmail: string;
  notes: string;
  orderDate: string;
  purchasePrice: string;
  agreedPrice: string;
  supplierKey: string;
};

type ManualDeliveryDraft = {
  form: ManualOrderForm;
  brandQuery: string;
  modelQuery: string;
  nameQuery: string;
  contactQuery: string;
  selectedProduct: ProductChoice | null;
};

const DRAFT_STORAGE_PREFIX = "smolyanklima:manual-delivery-draft:";

function emptyForm(section: OrderSection): ManualOrderForm {
  const today = new Date().toISOString().slice(0, 10);
  return {
    productId: "",
    productName: "",
    brandId: "",
    brandName: "",
    modelCode: "",
    productCondition: section,
    productRegion: "europe",
    contactId: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerEmail: "",
    notes: "",
    orderDate: today,
    purchasePrice: "",
    agreedPrice: "",
    supplierKey: "",
  };
}

function draftStorageKey(section: OrderSection): string {
  return `${DRAFT_STORAGE_PREFIX}${section}`;
}

function hasMeaningfulDraft(draft: ManualDeliveryDraft): boolean {
  const f = draft.form;
  return Boolean(
    f.productName.trim() ||
      f.productId ||
      f.brandName.trim() ||
      f.modelCode.trim() ||
      f.contactId ||
      f.customerName.trim() ||
      f.customerPhone.trim() ||
      f.customerAddress.trim() ||
      f.customerEmail.trim() ||
      f.notes.trim() ||
      f.purchasePrice.trim() ||
      f.agreedPrice.trim() ||
      f.supplierKey.trim(),
  );
}

function readDraft(section: OrderSection): ManualDeliveryDraft | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(draftStorageKey(section));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ManualDeliveryDraft>;
    if (!parsed?.form) return null;
    const base = emptyForm(section);
    return {
      form: {
        ...base,
        ...parsed.form,
        productCondition:
          parsed.form.productCondition === "used" || parsed.form.productCondition === "new"
            ? parsed.form.productCondition
            : base.productCondition,
        productRegion: parsed.form.productRegion === "japan" ? "japan" : "europe",
      },
      brandQuery: parsed.brandQuery ?? "",
      modelQuery: parsed.modelQuery ?? "",
      nameQuery: parsed.nameQuery ?? "",
      contactQuery: parsed.contactQuery ?? "",
      selectedProduct: parsed.selectedProduct ?? null,
    };
  } catch {
    return null;
  }
}

function writeDraft(section: OrderSection, draft: ManualDeliveryDraft): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    if (!hasMeaningfulDraft(draft)) {
      sessionStorage.removeItem(draftStorageKey(section));
      return;
    }
    sessionStorage.setItem(draftStorageKey(section), JSON.stringify(draft));
  } catch {
    /* quota / private mode */
  }
}

function removeDraft(section: OrderSection): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(draftStorageKey(section));
}

function applyDraftToState(
  draft: ManualDeliveryDraft,
  setters: {
    setForm: (v: ManualOrderForm) => void;
    setBrandQuery: (v: string) => void;
    setModelQuery: (v: string) => void;
    setNameQuery: (v: string) => void;
    setContactQuery: (v: string) => void;
    setSelectedProduct: (v: ProductChoice | null) => void;
  },
) {
  setters.setForm(draft.form);
  setters.setBrandQuery(draft.brandQuery);
  setters.setModelQuery(draft.modelQuery);
  setters.setNameQuery(draft.nameQuery);
  setters.setContactQuery(draft.contactQuery);
  setters.setSelectedProduct(draft.selectedProduct);
}

function productLabel(p: ProductChoice): string {
  const parts = [p.brands?.name, p.name, p.model_code ? `(${p.model_code})` : null].filter(Boolean);
  return parts.join(" ") || p.name;
}

function filterByQuery(items: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => item.toLowerCase().includes(q));
}

function ProductSuggestDropdown({
  open,
  loading,
  children,
}: {
  open: boolean;
  loading: boolean;
  children: ReactNode;
}) {
  if (!open && !loading) return null;
  return (
    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
      {loading ? (
        <div className="p-3 text-center text-sm text-slate-500">Търсене...</div>
      ) : (
        children
      )}
    </div>
  );
}

function ComboPickField({
  label,
  value,
  placeholder,
  disabled,
  hint,
  menuOpen,
  onMenuOpen,
  onMenuClose,
  onChange,
  options,
  optionsLoading,
  emptyText,
  onPickOption,
  productFooter,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  hint?: string;
  menuOpen: boolean;
  onMenuOpen: () => void;
  onMenuClose: () => void;
  onChange: (next: string) => void;
  options: string[];
  optionsLoading?: boolean;
  emptyText: string;
  onPickOption: (option: string) => void;
  productFooter?: ReactNode;
}) {
  const filtered = filterByQuery(options, value);
  const showMenu = menuOpen && !disabled;

  return (
    <div className="relative">
      <label className="grid gap-1.5">
        <span className="text-xs font-bold text-slate-600">{label}</span>
        <Input
          value={value}
          disabled={disabled}
          onFocus={onMenuOpen}
          onBlur={() => window.setTimeout(onMenuClose, 160)}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
      </label>
      {hint && <span className="mt-1 block text-[10px] text-slate-500">{hint}</span>}
      {showMenu && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-52 overflow-y-auto rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          {optionsLoading ? (
            <div className="p-3 text-center text-sm text-slate-500">Зареждане...</div>
          ) : filtered.length === 0 ? (
            <div className="p-3 text-center text-sm text-slate-500">{emptyText}</div>
          ) : (
            filtered.map((option) => (
              <button
                key={option}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onPickOption(option)}
                className="block w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-slate-800 transition-colors hover:bg-slate-50"
              >
                {option}
              </button>
            ))
          )}
          {productFooter}
        </div>
      )}
    </div>
  );
}

function ProductSuggestButton({ p, onPick }: { p: ProductChoice; onPick: (p: ProductChoice) => void }) {
  return (
    <button
      type="button"
      onClick={() => onPick(p)}
      className="block w-full rounded-lg p-2 text-left transition-colors hover:bg-slate-50"
    >
      <div className="text-sm font-bold text-slate-900">{productLabel(p)}</div>
      <div className="mt-0.5 text-xs text-slate-500">
        {p.indoor_unit_serial || p.outdoor_unit_serial
          ? `SN: ${[p.indoor_unit_serial, p.outdoor_unit_serial].filter(Boolean).join(" / ")} · `
          : ""}
        €{Number(p.price ?? 0).toLocaleString()} · {p.stock_status}
      </div>
    </button>
  );
}

export function ManualDeliveryModal({
  open,
  section,
  onClose,
  onSuccess,
}: {
  open: boolean;
  section: OrderSection;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const initialDraft = readDraft(section);
  const [form, setForm] = useState<ManualOrderForm>(() => initialDraft?.form ?? emptyForm(section));
  const [selectedProduct, setSelectedProduct] = useState<ProductChoice | null>(
    () => initialDraft?.selectedProduct ?? null,
  );
  const [supplierOptions, setSupplierOptions] = useState<GroupedSupplier[]>([]);
  const [contactQuery, setContactQuery] = useState(() => initialDraft?.contactQuery ?? "");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactResults, setContactResults] = useState<ContactChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandModels, setBrandModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [brandQuery, setBrandQuery] = useState(() => initialDraft?.brandQuery ?? "");
  const [modelQuery, setModelQuery] = useState(() => initialDraft?.modelQuery ?? "");
  const [nameQuery, setNameQuery] = useState(() => initialDraft?.nameQuery ?? "");
  const wasOpenRef = useRef(false);
  const [productLoading, setProductLoading] = useState(false);
  const [productResults, setProductResults] = useState<ProductChoice[]>([]);
  const [nameSuggestOpen, setNameSuggestOpen] = useState(false);

  const fetchProducts = useCallback(
    async (q: string, brandId?: string) => {
      const term = q.trim();
      if (!term) return [] as ProductChoice[];
      const sp = new URLSearchParams({
        q: term,
        perPage: "12",
        catalogKind: "climatics",
        condition: form.productCondition || section,
      });
      if (brandId) sp.set("brandId", brandId);
      const res = await fetch(`/api/admin/products?${sp}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return [];
      return (json as { data?: ProductChoice[] }).data ?? [];
    },
    [form.productCondition, section],
  );

  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/meta/brands?usedInProducts=1", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/contacts?kind=supplier&perPage=500", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/meta/sale-suppliers", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([brandsJson, contactsJson, saleSuppliersJson]) => {
        setBrands((brandsJson as { data?: BrandOption[] }).data ?? []);
        const contactNames: string[] = [];
        for (const row of (contactsJson as { data?: { full_name?: string }[] }).data ?? []) {
          const n = (row.full_name ?? "").trim();
          if (n) contactNames.push(n);
        }
        const saleGroups = (saleSuppliersJson as { data?: GroupedSupplier[] }).data ?? [];
        setSupplierOptions(mergeSupplierGroups(groupSupplierNames(contactNames), saleGroups));
      })
      .catch(() => {
        setBrands([]);
        setSupplierOptions([]);
      });
  }, []);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const draft = readDraft(section);
      if (draft && hasMeaningfulDraft(draft)) {
        applyDraftToState(draft, {
          setForm,
          setBrandQuery,
          setModelQuery,
          setNameQuery,
          setContactQuery,
          setSelectedProduct,
        });
        setError(null);
      }
    }
    wasOpenRef.current = open;
  }, [open, section]);

  useEffect(() => {
    if (!open) return;
    writeDraft(section, {
      form,
      brandQuery,
      modelQuery,
      nameQuery,
      contactQuery,
      selectedProduct,
    });
  }, [open, section, form, brandQuery, modelQuery, nameQuery, contactQuery, selectedProduct]);

  useEffect(() => {
    const brandId = form.brandId.trim();
    if (!brandId) {
      setBrandModels([]);
      return;
    }
    let cancelled = false;
    setModelsLoading(true);
    const sp = new URLSearchParams({
      brandId,
      perPage: "500",
      catalogKind: "climatics",
      condition: form.productCondition || section,
    });
    void fetch(`/api/admin/products?${sp.toString()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        const products = (json as { data?: ProductChoice[] }).data ?? [];
        const byModel = new Map<string, ProductChoice>();
        for (const p of products) {
          const mc = (p.model_code ?? "").trim();
          if (!mc || byModel.has(mc)) continue;
          byModel.set(mc, p);
        }
        setBrandModels(
          [...byModel.entries()]
            .map(([modelCode, product]) => ({ modelCode, product }))
            .sort((a, b) => a.modelCode.localeCompare(b.modelCode, "bg")),
        );
      })
      .catch(() => {
        if (!cancelled) setBrandModels([]);
      })
      .finally(() => {
        if (!cancelled) setModelsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.brandId, form.productCondition, section]);

  useEffect(() => {
    const q = brandMenuOpen && brandQuery.trim() ? brandQuery : modelMenuOpen && modelQuery.trim() ? modelQuery : nameSuggestOpen && nameQuery.trim() ? nameQuery : "";
    const brandId = brandMenuOpen || modelMenuOpen ? form.brandId.trim() || undefined : undefined;
    const shouldFetch = Boolean(q.trim()) && (brandMenuOpen || modelMenuOpen || nameSuggestOpen);
    if (!shouldFetch) {
      setProductResults([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setProductLoading(true);
      try {
        setProductResults(await fetchProducts(q, brandId));
      } finally {
        setProductLoading(false);
      }
    }, 280);
    return () => window.clearTimeout(t);
  }, [brandMenuOpen, modelMenuOpen, brandQuery, modelQuery, nameQuery, nameSuggestOpen, form.brandId, fetchProducts]);

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

  function resolveSupplierKey(name: string | null | undefined): string {
    const n = (name ?? "").trim();
    if (!n) return "";
    const key = normalizeSupplierKey(n);
    return supplierOptions.find((s) => s.key === key)?.key ?? key;
  }

  function syncBrandIdFromName(name: string): string {
    return brands.find((b) => b.name.toLowerCase() === name.trim().toLowerCase())?.id ?? "";
  }

  function pickBrand(brandName: string) {
    if (selectedProduct) clearProductLink();
    const brand = brands.find((b) => b.name === brandName);
    setBrandQuery(brandName);
    setModelQuery("");
    setBrandMenuOpen(false);
    setForm((s) => ({
      ...s,
      brandId: brand?.id ?? syncBrandIdFromName(brandName),
      brandName,
      modelCode: "",
    }));
  }

  function pickModel(modelCode: string) {
    const entry = brandModels.find((m) => m.modelCode === modelCode);
    setModelQuery(modelCode);
    setModelMenuOpen(false);
    if (entry) {
      applyProduct(entry.product);
      return;
    }
    if (selectedProduct) clearProductLink();
    setForm((s) => ({ ...s, modelCode }));
  }

  function productMatchesFooter() {
    if (!productResults.length && !productLoading) return null;
    return (
      <div className="mt-1 border-t border-slate-100 pt-1">
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Продукти от каталога</div>
        {productLoading ? (
          <div className="p-2 text-center text-xs text-slate-500">Търсене...</div>
        ) : (
          productResults.map((p) => <ProductSuggestButton key={p.id} p={p} onPick={applyProduct} />)
        )}
      </div>
    );
  }

  function applyProduct(p: ProductChoice) {
    setSelectedProduct(p);
    const condition = (p.product_condition === "used" ? "used" : p.product_condition === "new" ? "new" : form.productCondition) as OrderSection;
    const supplierName = p.supplier?.full_name?.trim() ?? "";

    setForm((s) => ({
      ...s,
      productId: p.id,
      productName: p.name,
      brandId: p.brand_id ?? syncBrandIdFromName(p.brands?.name ?? ""),
      brandName: p.brands?.name ?? "",
      modelCode: p.model_code ?? "",
      productCondition: condition,
      productRegion: p.product_region === "japan" ? "japan" : "europe",
      purchasePrice: p.purchase_price != null ? String(p.purchase_price) : "",
      agreedPrice: p.price != null ? String(p.price) : "",
      supplierKey: resolveSupplierKey(supplierName),
    }));
    setBrandQuery(p.brands?.name ?? "");
    setModelQuery(p.model_code ?? "");
    setNameQuery(p.name);
    setBrandMenuOpen(false);
    setModelMenuOpen(false);
    setNameSuggestOpen(false);
    setProductResults([]);
  }

  function clearProductLink() {
    setSelectedProduct(null);
    setForm((s) => ({ ...s, productId: "" }));
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

  function supplierLabelForSubmit(): string | null {
    if (!form.supplierKey.trim()) return null;
    const g = supplierOptions.find((s) => s.key === form.supplierKey);
    return g?.label ?? form.supplierKey;
  }

  function buildNotes(): string | null {
    const parts: string[] = [];
    if (!form.productId) {
      const meta: string[] = [];
      if (form.brandName.trim()) meta.push(`Марка: ${form.brandName.trim()}`);
      if (form.modelCode.trim()) meta.push(`Модел: ${form.modelCode.trim()}`);
      if (meta.length) parts.push(meta.join(" · "));
    }
    if (form.notes.trim()) parts.push(form.notes.trim());
    return parts.length ? parts.join("\n\n") : null;
  }

  async function submit() {
    const productName = (form.productName || selectedProduct?.name || "").trim();
    const purchasePriceRaw = form.purchasePrice.trim();
    const purchasePrice = purchasePriceRaw === "" ? null : Number(purchasePriceRaw);
    const agreedRaw = form.agreedPrice.trim();
    const agreedPrice = agreedRaw === "" ? null : Number(agreedRaw);

    if (!productName && !form.productId) {
      setError("Въведете име на продукта или изберете от предложенията.");
      return;
    }
    if (!form.orderDate.trim()) {
      setError("Посочете дата на поръчката.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/supplier-orders", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manualHistoryDelivery: true,
          productId: form.productId || null,
          productName,
          brandId: form.brandId || null,
          modelCode: form.modelCode.trim() || null,
          productCondition: form.productCondition,
          productRegion: form.productRegion,
          supplierName: supplierLabelForSubmit(),
          purchasePrice: purchasePrice != null && Number.isFinite(purchasePrice) ? purchasePrice : null,
          agreedPrice: agreedPrice != null && Number.isFinite(agreedPrice) ? agreedPrice : null,
          orderDate: form.orderDate,
          contactId: form.contactId || null,
          customerName: form.customerName.trim() || null,
          customerPhone: form.customerPhone.trim() || null,
          customerAddress: form.customerAddress.trim() || null,
          notes: buildNotes(),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Грешка при запис на доставката");
      notifyAdminCalendarReload();
      removeDraft(section);
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <AdminModalBackdrop open onClose={onClose} busy={busy} layerId="manual-delivery">
      <div className={`${ADMIN_MODAL_PANEL} max-w-3xl`} onClick={(e) => e.stopPropagation()}>
        <AdminModalDragHandle />
        <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#ede9fe_0,#ffffff_42%,#e6f9fd_100%)] px-4 py-4 md:px-6 md:py-5 shrink-0">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-violet-700">Ръчна поръчка</div>
          <div className="mt-1 text-lg md:text-2xl font-black leading-tight text-slate-950">Запис в историята на поръчките</div>
          <div className="mt-1 hidden text-sm font-medium text-slate-500 sm:block">
            Записва поръчка в статус „чака доставка“. Сериите и фактурата се попълват при приключване на доставката.
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 overflow-y-auto p-4 md:p-6 md:grid-cols-2">
          <div className="col-span-full text-xs font-black uppercase tracking-wide text-violet-700">Продукт</div>

          <ComboPickField
            label="Марка"
            value={brandQuery}
            placeholder="Изберете или напишете марка…"
            menuOpen={brandMenuOpen}
            onMenuOpen={() => {
              setBrandMenuOpen(true);
              setModelMenuOpen(false);
            }}
            onMenuClose={() => setBrandMenuOpen(false)}
            onChange={(v) => {
              setBrandQuery(v);
              setForm((s) => ({
                ...s,
                brandName: v,
                brandId: syncBrandIdFromName(v),
                modelCode: v !== s.brandName ? "" : s.modelCode,
              }));
              if (selectedProduct) clearProductLink();
              if (v !== form.brandName) setModelQuery("");
            }}
            options={brands.map((b) => b.name)}
            emptyText="Няма марки в каталога"
            onPickOption={pickBrand}
            productFooter={brandQuery.trim() ? productMatchesFooter() : null}
          />

          <ComboPickField
            label="Модел"
            value={modelQuery}
            placeholder={form.brandId ? "Изберете или напишете модел…" : "Първо изберете марка"}
            disabled={!form.brandId}
            hint={!form.brandId ? "Моделите се зареждат след избор на марка." : undefined}
            menuOpen={modelMenuOpen}
            onMenuOpen={() => {
              if (!form.brandId) return;
              setModelMenuOpen(true);
              setBrandMenuOpen(false);
            }}
            onMenuClose={() => setModelMenuOpen(false)}
            onChange={(v) => {
              setModelQuery(v);
              setForm((s) => ({ ...s, modelCode: v }));
              if (selectedProduct) clearProductLink();
            }}
            options={brandModels.map((m) => m.modelCode)}
            optionsLoading={modelsLoading}
            emptyText={form.brandId ? "Няма модели за тази марка" : "Изберете марка"}
            onPickOption={pickModel}
            productFooter={modelQuery.trim() ? productMatchesFooter() : null}
          />

          <div className="relative md:col-span-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-slate-600">Име на продукта *</span>
              <Input
                value={nameQuery}
                onFocus={() => setNameSuggestOpen(true)}
                onChange={(e) => {
                  const v = e.target.value;
                  setNameQuery(v);
                  setForm((s) => ({ ...s, productName: v }));
                  if (selectedProduct) clearProductLink();
                  setNameSuggestOpen(true);
                }}
                placeholder="Пълно име в каталога"
              />
            </label>
            <ProductSuggestDropdown open={nameSuggestOpen && nameQuery.trim().length > 0} loading={productLoading && nameSuggestOpen}>
              {productResults.map((p) => (
                <ProductSuggestButton key={p.id} p={p} onPick={applyProduct} />
              ))}
            </ProductSuggestDropdown>
          </div>

          {!selectedProduct && (
            <>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-600">Категория *</span>
                <Select
                  value={form.productCondition}
                  onChange={(e) => setForm((s) => ({ ...s, productCondition: e.target.value as OrderSection }))}
                >
                  <option value="new">Нови</option>
                  <option value="used">Втора употреба</option>
                </Select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-bold text-slate-600">Регион</span>
                <Select
                  value={form.productRegion}
                  onChange={(e) => setForm((s) => ({ ...s, productRegion: e.target.value as ProductRegion }))}
                >
                  <option value="europe">Европа</option>
                  <option value="japan">Япония</option>
                </Select>
              </label>
            </>
          )}

          {selectedProduct && (
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-100 bg-violet-50/60 px-3 py-2">
              <span className="text-sm font-bold text-slate-800">{productLabel(selectedProduct)}</span>
              <button type="button" onClick={clearProductLink} className="text-xs font-bold text-violet-700 hover:underline">
                Премахни връзката
              </button>
            </div>
          )}

          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-bold text-slate-600">Дата на поръчката *</span>
            <Input type="date" value={form.orderDate} onChange={(e) => setForm((s) => ({ ...s, orderDate: e.target.value }))} />
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
              placeholder="За поръчка по клиент"
            />
          </label>

          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-bold text-slate-600">Доставчик</span>
            <Select
              value={form.supplierKey}
              onChange={(e) => setForm((s) => ({ ...s, supplierKey: e.target.value }))}
            >
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

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
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
    </AdminModalBackdrop>
  );
}
