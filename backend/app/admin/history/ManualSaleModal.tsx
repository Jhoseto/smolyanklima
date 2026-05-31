"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button, Input, Textarea, Select, ADMIN_MODAL_BACKDROP, ADMIN_MODAL_PANEL, AdminModalDragHandle } from "../ui";
import { assertNoContactPrimaryPhoneDuplicate } from "@/lib/admin/contactPhoneConflictClient";
import { canRecordProductSale } from "@/lib/admin/recordProductSale";
import { groupSupplierNames, mergeSupplierGroups, normalizeSupplierKey, type GroupedSupplier } from "@/lib/admin/supplierNameNormalize";

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
  price_with_mount?: number | null;
  purchase_price?: number | null;
  stock_status: string;
  product_condition?: "new" | "used" | null;
  supplier_invoice_number?: string | null;
  model_code?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  supplier_id?: string | null;
  brand_id?: string | null;
  brands?: { name?: string | null } | null;
  supplier?: { full_name?: string | null } | null;
};

type BrandOption = { id: string; name: string };

type ModelOption = { modelCode: string; product: ProductChoice };

type SaleSection = "new" | "used";

type MountDefaults = { new: number; used: number };

function defaultNextMountDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function mountAddon(defaults: MountDefaults | null, condition: SaleSection): number {
  if (!defaults) return 0;
  return condition === "used" ? defaults.used : defaults.new;
}

function salePriceWithMount(
  basePrice: number,
  withMount: boolean,
  condition: SaleSection,
  defaults: MountDefaults | null,
  storedPriceWithMount?: number | null,
): number {
  if (!withMount || !Number.isFinite(basePrice)) return basePrice;
  if (storedPriceWithMount != null && storedPriceWithMount >= basePrice) {
    return Math.round(storedPriceWithMount * 100) / 100;
  }
  const addon = mountAddon(defaults, condition);
  return Math.round((basePrice + addon) * 100) / 100;
}

function emptyForm(section: SaleSection) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    productId: "",
    productName: "",
    brandId: "",
    brandName: "",
    modelCode: "",
    indoorSerial: "",
    outdoorSerial: "",
    saleProductCondition: section,
    contactId: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerEmail: "",
    notes: "",
    saleDate: today,
    baseSalePrice: "",
    salePrice: "",
    purchasePrice: "",
    supplierKey: "",
    supplierInvoiceNumber: "",
    includeMount: false,
    mountDate: defaultNextMountDate(),
    mountTimeFrom: "09:00",
    mountTimeTo: "13:00",
    updateStock: true,
  };
}

function productLabel(p: ProductChoice): string {
  const parts = [p.brands?.name, p.name, p.model_code ? `(${p.model_code})` : null].filter(Boolean);
  return parts.join(" ") || p.name;
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

function filterByQuery(items: string[], query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => item.toLowerCase().includes(q));
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

export function ManualSaleModal({
  section,
  onClose,
  onSuccess,
}: {
  section: SaleSection;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState(() => emptyForm(section));
  const [selectedProduct, setSelectedProduct] = useState<ProductChoice | null>(null);
  const [supplierOptions, setSupplierOptions] = useState<GroupedSupplier[]>([]);
  const [mountDefaults, setMountDefaults] = useState<MountDefaults | null>(null);
  const [contactQuery, setContactQuery] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactResults, setContactResults] = useState<ContactChoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [brandModels, setBrandModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [brandMenuOpen, setBrandMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [brandQuery, setBrandQuery] = useState("");
  const [modelQuery, setModelQuery] = useState("");
  const [nameQuery, setNameQuery] = useState("");
  const [indoorQuery, setIndoorQuery] = useState("");
  const [outdoorQuery, setOutdoorQuery] = useState("");
  const [productLoading, setProductLoading] = useState(false);
  const [productResults, setProductResults] = useState<ProductChoice[]>([]);
  const [activeSuggest, setActiveSuggest] = useState<"name" | "indoor" | "outdoor" | null>(null);

  const salePriceManualRef = useRef(false);

  const fetchProducts = useCallback(
    async (q: string, brandId?: string) => {
      const term = q.trim();
      if (!term) return [] as ProductChoice[];
      const sp = new URLSearchParams({
        q: term,
        perPage: "12",
        catalogKind: "climatics",
        condition: form.saleProductCondition || section,
      });
      if (brandId) sp.set("brandId", brandId);
      const res = await fetch(`/api/admin/products?${sp}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) return [];
      return (json as { data?: ProductChoice[] }).data ?? [];
    },
    [form.saleProductCondition, section],
  );

  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/meta/brands?usedInProducts=1", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/contacts?kind=supplier&perPage=500", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/meta/sale-suppliers", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/products/catalog-settings", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([brandsJson, contactsJson, saleSuppliersJson, settingsJson]) => {
        setBrands((brandsJson as { data?: BrandOption[] }).data ?? []);
        const contactNames: string[] = [];
        for (const row of (contactsJson as { data?: { full_name?: string }[] }).data ?? []) {
          const n = (row.full_name ?? "").trim();
          if (n) contactNames.push(n);
        }
        const saleGroups = (saleSuppliersJson as { data?: GroupedSupplier[] }).data ?? [];
        setSupplierOptions(
          mergeSupplierGroups(groupSupplierNames(contactNames), saleGroups),
        );
        const s = (settingsJson as { data?: { defaultMountNewEur?: number; defaultMountUsedEur?: number } }).data;
        if (
          s?.defaultMountNewEur != null &&
          s?.defaultMountUsedEur != null &&
          Number.isFinite(s.defaultMountNewEur) &&
          Number.isFinite(s.defaultMountUsedEur)
        ) {
          setMountDefaults({ new: s.defaultMountNewEur, used: s.defaultMountUsedEur });
        }
      })
      .catch(() => {
        setBrands([]);
        setSupplierOptions([]);
      });
  }, []);

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
      condition: form.saleProductCondition || section,
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
        const models = [...byModel.entries()]
          .map(([modelCode, product]) => ({ modelCode, product }))
          .sort((a, b) => a.modelCode.localeCompare(b.modelCode, "bg"));
        setBrandModels(models);
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
  }, [form.brandId, form.saleProductCondition, section]);

  useEffect(() => {
    const q =
      brandMenuOpen && brandQuery.trim()
        ? brandQuery
        : modelMenuOpen && modelQuery.trim()
          ? modelQuery
          : activeSuggest === "name"
            ? nameQuery
            : activeSuggest === "indoor"
              ? indoorQuery
              : activeSuggest === "outdoor"
                ? outdoorQuery
                : "";
    const brandId =
      brandMenuOpen || modelMenuOpen ? form.brandId.trim() || undefined : undefined;
    const shouldFetch =
      Boolean(q.trim()) &&
      (brandMenuOpen || modelMenuOpen || activeSuggest === "name" || activeSuggest === "indoor" || activeSuggest === "outdoor");
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
  }, [
    activeSuggest,
    brandMenuOpen,
    modelMenuOpen,
    brandQuery,
    modelQuery,
    nameQuery,
    indoorQuery,
    outdoorQuery,
    form.brandId,
    fetchProducts,
  ]);

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
    const match = supplierOptions.find((s) => s.key === key);
    return match?.key ?? key;
  }

  function syncBrandIdFromName(name: string): string {
    const match = brands.find((b) => b.name.toLowerCase() === name.trim().toLowerCase());
    return match?.id ?? "";
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
      <div className="border-t border-slate-100 mt-1 pt-1">
        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Продукти от каталога</div>
        {productLoading ? (
          <div className="p-2 text-center text-xs text-slate-500">Търсене...</div>
        ) : (
          productResults.map((p) => <ProductSuggestButton key={p.id} p={p} onPick={applyProduct} />)
        )}
      </div>
    );
  }

  function applyProduct(p: ProductChoice, withMountOverride?: boolean) {
    salePriceManualRef.current = false;
    setSelectedProduct(p);
    const condition = (p.product_condition === "used" ? "used" : p.product_condition === "new" ? "new" : form.saleProductCondition) as SaleSection;
    const base = Number(p.price ?? 0);
    const includeMount = withMountOverride ?? form.includeMount;
    const nextSale = salePriceWithMount(base, includeMount, condition, mountDefaults, p.price_with_mount);
    const supplierName = p.supplier?.full_name?.trim() ?? "";

    setForm((s) => ({
      ...s,
      productId: p.id,
      productName: p.name,
      brandId: p.brand_id ?? syncBrandIdFromName(p.brands?.name ?? ""),
      brandName: p.brands?.name ?? "",
      modelCode: p.model_code ?? "",
      indoorSerial: p.indoor_unit_serial ?? "",
      outdoorSerial: p.outdoor_unit_serial ?? "",
      saleProductCondition: condition,
      purchasePrice: p.purchase_price != null ? String(p.purchase_price) : "",
      baseSalePrice: Number.isFinite(base) ? String(base) : "",
      salePrice: Number.isFinite(nextSale) ? String(nextSale) : "",
      supplierKey: resolveSupplierKey(supplierName),
      supplierInvoiceNumber: p.supplier_invoice_number ?? "",
      updateStock: canRecordProductSale(p.stock_status),
    }));
    setBrandQuery(p.brands?.name ?? "");
    setModelQuery(p.model_code ?? "");
    setNameQuery(p.name);
    setIndoorQuery(p.indoor_unit_serial ?? "");
    setOutdoorQuery(p.outdoor_unit_serial ?? "");
    setBrandMenuOpen(false);
    setModelMenuOpen(false);
    setActiveSuggest(null);
    setProductResults([]);
  }

  function clearProductLink() {
    salePriceManualRef.current = false;
    setSelectedProduct(null);
    setForm((s) => ({
      ...s,
      productId: "",
      updateStock: false,
    }));
  }

  function handleIncludeMountChange(checked: boolean) {
    salePriceManualRef.current = false;
    setForm((s) => {
      const baseStr = s.baseSalePrice.trim() || s.salePrice;
      const baseNum = Number(baseStr);
      const nextSale = Number.isFinite(baseNum)
        ? salePriceWithMount(baseNum, checked, s.saleProductCondition, mountDefaults, selectedProduct?.price_with_mount)
        : NaN;
      return {
        ...s,
        includeMount: checked,
        baseSalePrice: s.baseSalePrice || baseStr,
        salePrice: Number.isFinite(nextSale) ? String(nextSale) : s.salePrice,
      };
    });
  }

  function handleSalePriceChange(value: string) {
    salePriceManualRef.current = true;
    setForm((s) => ({ ...s, salePrice: value }));
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
      if (form.indoorSerial.trim()) meta.push(`SN вътрешно: ${form.indoorSerial.trim()}`);
      if (form.outdoorSerial.trim()) meta.push(`SN външно: ${form.outdoorSerial.trim()}`);
      if (meta.length) parts.push(meta.join(" · "));
    }
    if (form.notes.trim()) parts.push(form.notes.trim());
    return parts.length ? parts.join("\n\n") : null;
  }

  async function submit() {
    const productName = (form.productName || selectedProduct?.name || "").trim();
    const salePrice = Number(form.salePrice);
    const purchasePriceRaw = form.purchasePrice.trim();
    const purchasePrice = purchasePriceRaw === "" ? null : Number(purchasePriceRaw);

    if (!productName && !form.productId) {
      setError("Въведете име на продукта или изберете от предложенията.");
      return;
    }
    if (!form.productId && !form.saleProductCondition) {
      setError("Посочете категория: нови или втора употреба.");
      return;
    }
    if (!form.saleDate.trim()) {
      setError("Посочете дата на продажбата.");
      return;
    }
    if (!Number.isFinite(salePrice) || salePrice < 0) {
      setError("Въведете валидна продажна цена.");
      return;
    }
    if (!form.customerName.trim() && !form.customerPhone.trim()) {
      setError("Въведете поне име или телефон на клиента.");
      return;
    }
    if (form.includeMount && !form.mountDate.trim()) {
      setError("Посочете дата за монтаж.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/work-items", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manualHistorySale: true,
          type: "sale",
          eventCode: "sale",
          title: `Продажба: ${productName}`,
          status: form.includeMount ? "planned" : "done",
          dueDate: form.includeMount ? form.mountDate : form.saleDate,
          saleInstallState: form.includeMount ? "pending_mount" : "completed",
          productId: form.productId || null,
          productName,
          saleProductCondition: form.productId ? null : form.saleProductCondition,
          contactId: form.contactId || null,
          customerName: form.customerName.trim() || null,
          customerPhone: form.customerPhone.trim() || null,
          customerAddress: form.customerAddress.trim() || null,
          notes: buildNotes(),
          quantity: 1,
          unitPrice: salePrice,
          totalAmount: salePrice,
          purchasePrice: purchasePrice != null && Number.isFinite(purchasePrice) ? purchasePrice : null,
          supplierName: supplierLabelForSubmit(),
          supplierInvoiceNumber: form.supplierInvoiceNumber.trim() || null,
          withInstallation: form.includeMount,
          mountDate: form.includeMount ? form.mountDate : null,
          mountTimeFrom: form.includeMount ? form.mountTimeFrom : null,
          mountTimeTo: form.includeMount ? form.mountTimeTo : null,
          updateStock: form.updateStock && Boolean(form.productId),
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; protocol_warning?: string };
      if (!res.ok) throw new Error(json.error || "Грешка при запис на продажбата");
      if (json.protocol_warning) {
        console.warn("[ManualSaleModal] protocol warning:", json.protocol_warning);
      }
      onSuccess();
      onClose();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  }

  const mountHint =
    form.includeMount && mountDefaults
      ? `+ €${mountAddon(mountDefaults, form.saleProductCondition).toLocaleString()} стандартен монтаж`
      : null;

  return (
    <div className={ADMIN_MODAL_BACKDROP} onClick={() => !busy && onClose()}>
      <div className={`${ADMIN_MODAL_PANEL} max-w-3xl`} onClick={(e) => e.stopPropagation()}>
        <AdminModalDragHandle />
        <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e6f9fd_0,#ffffff_42%,#fff3ed_100%)] px-4 py-4 md:px-6 md:py-5 shrink-0">
          <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand-blue-700">Ръчна продажба</div>
          <div className="mt-1 text-lg md:text-2xl font-black leading-tight text-slate-950">Запис в историята на продажбите</div>
          <div className="mt-1 text-sm font-medium text-slate-500 hidden sm:block">
            Полетата предлагат стойности от каталога. Може да свържете продукт или да въведете данни ръчно.
          </div>
        </div>

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 overflow-y-auto p-4 md:p-6 md:grid-cols-2">
          <div className="col-span-full text-xs font-black uppercase tracking-wide text-brand-blue-700">Продукт</div>

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
                onFocus={() => setActiveSuggest("name")}
                onChange={(e) => {
                  const v = e.target.value;
                  setNameQuery(v);
                  setForm((s) => ({ ...s, productName: v }));
                  if (selectedProduct) clearProductLink();
                  setActiveSuggest("name");
                }}
                placeholder="Пълно име в каталога"
              />
            </label>
            <ProductSuggestDropdown open={activeSuggest === "name" && nameQuery.trim().length > 0} loading={productLoading && activeSuggest === "name"}>
              {productResults.map((p) => (
                <ProductSuggestButton key={p.id} p={p} onPick={applyProduct} />
              ))}
            </ProductSuggestDropdown>
          </div>

          <div className="relative">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-slate-600">Сериен № вътрешно</span>
              <Input
                value={indoorQuery}
                onFocus={() => setActiveSuggest("indoor")}
                onChange={(e) => {
                  const v = e.target.value;
                  setIndoorQuery(v);
                  setForm((s) => ({ ...s, indoorSerial: v }));
                  if (selectedProduct) clearProductLink();
                  setActiveSuggest("indoor");
                }}
                placeholder="Сериен номер"
              />
            </label>
            <ProductSuggestDropdown open={activeSuggest === "indoor" && indoorQuery.trim().length > 0} loading={productLoading && activeSuggest === "indoor"}>
              {productResults.map((p) => (
                <ProductSuggestButton key={p.id} p={p} onPick={applyProduct} />
              ))}
            </ProductSuggestDropdown>
          </div>

          <div className="relative">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-slate-600">Сериен № външно</span>
              <Input
                value={outdoorQuery}
                onFocus={() => setActiveSuggest("outdoor")}
                onChange={(e) => {
                  const v = e.target.value;
                  setOutdoorQuery(v);
                  setForm((s) => ({ ...s, outdoorSerial: v }));
                  if (selectedProduct) clearProductLink();
                  setActiveSuggest("outdoor");
                }}
                placeholder="Сериен номер"
              />
            </label>
            <ProductSuggestDropdown open={activeSuggest === "outdoor" && outdoorQuery.trim().length > 0} loading={productLoading && activeSuggest === "outdoor"}>
              {productResults.map((p) => (
                <ProductSuggestButton key={p.id} p={p} onPick={applyProduct} />
              ))}
            </ProductSuggestDropdown>
          </div>

          {!selectedProduct && (
            <label className="grid gap-1.5 md:col-span-2">
              <span className="text-xs font-bold text-slate-600">Категория *</span>
              <Select
                value={form.saleProductCondition}
                onChange={(e) => {
                  const condition = e.target.value as SaleSection;
                  setForm((s) => {
                    const base = s.baseSalePrice || s.salePrice;
                    const nextSale = salePriceWithMount(
                      Number(base),
                      s.includeMount,
                      condition,
                      mountDefaults,
                      null,
                    );
                    return {
                      ...s,
                      saleProductCondition: condition,
                      salePrice: Number.isFinite(nextSale) ? String(nextSale) : s.salePrice,
                    };
                  });
                }}
              >
                <option value="new">Нови</option>
                <option value="used">Втора употреба</option>
              </Select>
            </label>
          )}

          {selectedProduct && (
            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-blue-100 bg-brand-blue-50/60 px-3 py-2">
              <span className="text-sm font-bold text-slate-800">{productLabel(selectedProduct)}</span>
              <button type="button" onClick={clearProductLink} className="text-xs font-bold text-brand-blue-700 hover:underline">
                Премахни връзката
              </button>
            </div>
          )}

          {selectedProduct && canRecordProductSale(selectedProduct.stock_status) && (
            <label className="md:col-span-2 flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <input
                type="checkbox"
                checked={form.updateStock}
                onChange={(e) => setForm((s) => ({ ...s, updateStock: e.target.checked }))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-blue-600 focus:ring-brand-blue-500"
              />
              <span className="text-sm text-slate-700 leading-snug">
                <span className="font-bold text-slate-900">Обнови склада</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Маркира бройката като продадена и намалява наличността.
                </span>
              </span>
            </label>
          )}

          <label className="grid gap-1.5 md:col-span-2">
            <span className="text-xs font-bold text-slate-600">Дата на продажбата *</span>
            <Input type="date" value={form.saleDate} onChange={(e) => setForm((s) => ({ ...s, saleDate: e.target.value }))} />
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
            <span className="text-xs font-bold text-slate-600">Продажна цена (€) *</span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={form.salePrice}
              onChange={(e) => handleSalePriceChange(e.target.value)}
              onBlur={() => {
                if (!salePriceManualRef.current) return;
                const sale = Number(form.salePrice);
                if (!Number.isFinite(sale)) return;
                const addon = form.includeMount ? mountAddon(mountDefaults, form.saleProductCondition) : 0;
                setForm((s) => ({ ...s, baseSalePrice: String(Math.max(0, Math.round((sale - addon) * 100) / 100)) }));
              }}
            />
            {mountHint && <span className="text-[10px] font-medium text-emerald-700">{mountHint}</span>}
          </label>

          <label className="grid gap-1.5">
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
          <Input
            value={form.supplierInvoiceNumber}
            onChange={(e) => setForm((s) => ({ ...s, supplierInvoiceNumber: e.target.value }))}
            placeholder="Фактура доставчик"
          />

          <div className="col-span-full border-t border-slate-100 pt-3">
            <div className="text-xs font-black uppercase tracking-wide text-brand-blue-700 mb-2">Клиент</div>
          </div>

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
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
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
                      className="block w-full rounded-lg p-2 text-left transition-colors hover:bg-slate-50"
                    >
                      <div className="text-sm font-bold text-slate-900">{c.full_name}</div>
                      <div className="mt-0.5 text-xs text-slate-500">{c.phone}</div>
                    </button>
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
            className="md:col-span-2 min-h-[2.75rem]"
          />

          <div className="col-span-full border-t border-slate-100 pt-3 space-y-3">
            <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
              <input
                type="checkbox"
                checked={form.includeMount}
                onChange={(e) => handleIncludeMountChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-blue-600 focus:ring-brand-blue-500"
              />
              <span className="text-sm text-slate-700 leading-snug">
                <span className="font-bold text-slate-900">С монтаж</span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  Добавя стандартния монтаж към продажната цена и създава насрочен монтаж в календара.
                </span>
              </span>
            </label>
            {form.includeMount ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="grid gap-1.5">
                  <span className="text-xs font-bold text-slate-600">Дата монтаж *</span>
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
            ) : (
              <p className="text-xs text-slate-500 rounded-lg border border-dashed border-slate-200 bg-white px-3 py-2">
                Продажбата ще бъде записана като <strong className="text-slate-700">завършена</strong>.
              </p>
            )}
          </div>
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
            {busy ? "Запис..." : "Запиши продажбата"}
          </Button>
        </div>
      </div>
    </div>
  );
}
