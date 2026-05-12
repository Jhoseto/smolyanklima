"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SectionTitle, Card, Button, Input, Select, Table, Th, Td, Textarea } from "../ui";
import { Plus, FilterX, CheckCircle, Trash2, Edit, Filter, ChevronDown, MessageCircle, PackageCheck, PackageX, Clock4, Star, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { ShareToChatModal } from "../chat/ShareToChatModal";
import { ProductQuickViewButton } from "../ProductQuickView";
import { FeaturedSlotModal } from "./FeaturedSlotModal";
import { useDebounce } from "@/lib/hooks/useDebounce";
import {
  normalizeProductStockLocation,
  productStockLocationLabel,
  type ProductStockLocation,
} from "@/lib/admin/productStockLocation";
import {
  productRegionLabel,
  type ProductRegion,
} from "@/lib/admin/productRegion";

export const dynamic = "force-dynamic";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  purchase_price?: number | null;
  is_featured: boolean;
  is_active?: boolean | null;
  featured_position?: number | null;
  featured_badge?: string | null;
  stock_status: "in_stock" | "out_of_stock" | "on_order" | string;
  stock_location?: ProductStockLocation | string | null;
  stock_quantity: number;
  sold_quantity: number;
  product_condition: "new" | "used";
  supplier_id?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  supplier_invoice_number?: string | null;
  product_region?: ProductRegion | string | null;
  purchased_at?: string | null;
  brands?: { name?: string } | null;
  product_types?: { name?: string } | null;
};

type OptionRow = { id: string; name: string };
type ContactChoice = { id: string; full_name: string; phone: string; email?: string | null; address?: string | null };
type SortField = "name" | "price" | "purchase_price" | "product_condition" | "purchased_at";
type SortDir = "asc" | "desc";

/**
 * Кликаемо заглавие на колона в таблицата — заменя статичния `<Th>` за
 * сортируеми колони. При клик върху същата колона обръща посоката
 * (asc ↔ desc); при клик върху нова колона започва от възходящо.
 *
 * Показва стрелка-индикатор:
 *   • неутрална стрелка (↕) — колоната не е активна за сортиране;
 *   • ↑ — активно сортиране, възходящ ред;
 *   • ↓ — активно сортиране, низходящ ред.
 */
function SortableTh({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
  className = "",
}: {
  label: string;
  field: SortField;
  sortBy: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
}) {
  const isActive = sortBy === field;
  const ArrowIcon = !isActive ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Th className={`cursor-pointer select-none hover:bg-slate-100 transition-colors ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`w-full text-left inline-flex items-center gap-1.5 ${isActive ? "text-brand-blue-700" : "text-slate-600"}`}
        title={`Сортирай по „${label}“`}
      >
        <span>{label}</span>
        <ArrowIcon className={`w-3 h-3 ${isActive ? "opacity-100" : "opacity-40"}`} />
      </button>
    </Th>
  );
}

function productStockLocationBadgeClass(loc: unknown) {
  const n = normalizeProductStockLocation(loc);
  if (n === "showroom") return "bg-violet-100 text-violet-900";
  return "bg-slate-100 text-slate-800";
}

function canRecordSale(p: ProductRow) {
  return p.stock_status !== "out_of_stock";
}

function fmtEuro(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `€${Number(n).toLocaleString()}`;
}

// Дата на закупуване от доставчик: в БД е `date` (без час). Показваме я в
// българския формат ДД.ММ.ГГГГ; при липсваща стойност — тире.
function fmtPurchaseDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * Подсветка на текстов фрагмент, който отговаря на текущия search query.
 * Регистър-нечувствително. Връща JSX с обвити в <mark> съвпадения.
 */
function highlightMatch(text: string | null | undefined, query: string): ReactNode {
  const value = text ?? "";
  const q = query.trim();
  if (!value || !q) return value || "—";
  const idx = value.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return value;
  return (
    <>
      {value.slice(0, idx)}
      <mark className="bg-yellow-100 text-slate-900 rounded px-0.5">{value.slice(idx, idx + q.length)}</mark>
      {value.slice(idx + q.length)}
    </>
  );
}

/**
 * Универсално поле за търсене с autocomplete dropdown. Показва до 8
 * предложения от текущо заредените продукти (`items`), като визуализира
 * мястото, в което е намерено съвпадението: име, сериен № вътрешен или
 * външен блок, фактура от доставчик. Клик върху ред заключва филтъра към
 * това име и затваря менюто. Esc / blur също затварят.
 */
function ProductSearchBox({
  value,
  onChange,
  items,
  placeholder,
  onPick,
}: {
  value: string;
  onChange: (next: string) => void;
  items: ProductRow[];
  placeholder?: string;
  onPick?: (p: ProductRow) => void;
}) {
  const [focused, setFocused] = useState(false);
  const q = value.trim().toLowerCase();
  const isOpen = focused && q.length >= 1 && items.length > 0;

  // Определя коя поле от продукта „хваща“ търсенето, за да го покажем в
  // dropdown-а като контекст: „Сериен (вътр): SN-…“ / „Фактура: …“.
  function describeMatch(p: ProductRow): { label: string; value: string } | null {
    if (!q) return null;
    const candidates: Array<{ label: string; value: string | null | undefined }> = [
      { label: "Сериен (вътр)", value: p.indoor_unit_serial },
      { label: "Сериен (външ)", value: p.outdoor_unit_serial },
      { label: "Фактура",       value: p.supplier_invoice_number },
      { label: "Slug",          value: p.slug },
    ];
    for (const c of candidates) {
      if (c.value && c.value.toLowerCase().includes(q)) return { label: c.label, value: c.value };
    }
    return null;
  }

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          // Малко закъснение, за да позволи `mousedown` върху ред в dropdown
          // да стигне до click handler-а, преди да затворим менюто.
          window.setTimeout(() => setFocused(false), 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            onChange("");
            setFocused(false);
          }
        }}
        placeholder={placeholder}
      />

      {isOpen && (
        <div className="absolute z-30 left-0 right-0 top-full mt-1 max-h-80 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 sticky top-0 bg-white">
            Предложения ({Math.min(items.length, 8)}{items.length > 8 ? ` от ${items.length}` : ""})
          </div>
          <ul>
            {items.slice(0, 8).map((p) => {
              const match = describeMatch(p);
              const brandName = p.brands?.name ?? "—";
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onPick?.(p);
                      onChange(p.name);
                      setFocused(false);
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-brand-blue-50 focus:bg-brand-blue-50 focus:outline-none transition-colors"
                  >
                    <div className="text-sm font-semibold text-slate-900 leading-snug">
                      {highlightMatch(p.name, value)}
                    </div>
                    <div className="text-[11px] text-slate-500 flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{brandName}</span>
                      {p.product_types?.name && <span>· {p.product_types.name}</span>}
                      {match && (
                        <span className="inline-flex items-center gap-1">
                          · <span className="font-semibold text-slate-600">{match.label}:</span>
                          <span>{highlightMatch(match.value, value)}</span>
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// Малък toggle-чип за бързи филтри. Поддържа 4 визуални тона, за да
// разграничим неутрален/успех/предупреждение/опасност (състояния на
// продукт). Логиката е изцяло decorative — селекцията се контролира
// чрез `active` пропа от родителя.
type ChipTone = "neutral" | "success" | "warning" | "danger" | "brand";
function ChipToggle({
  active,
  tone = "neutral",
  onClick,
  children,
}: {
  active: boolean;
  tone?: ChipTone;
  onClick: () => void;
  children: ReactNode;
}) {
  const palette: Record<ChipTone, { active: string; idle: string }> = {
    neutral: {
      active: "bg-slate-900 text-white border-slate-900",
      idle: "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300",
    },
    success: {
      active: "bg-emerald-600 text-white border-emerald-600",
      idle: "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100",
    },
    warning: {
      active: "bg-amber-500 text-white border-amber-500",
      idle: "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100",
    },
    danger: {
      active: "bg-rose-600 text-white border-rose-600",
      idle: "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100",
    },
    brand: {
      active: "bg-brand-blue-500 text-white border-brand-blue-500",
      idle: "bg-brand-blue-50 text-brand-blue-700 border-brand-blue-200 hover:bg-brand-blue-100",
    },
  };
  const styles = palette[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors ${
        active ? styles.active : styles.idle
      }`}
    >
      {children}
    </button>
  );
}

function truncCell(s: string | null | undefined, max = 16) {
  const t = (s ?? "").trim();
  if (!t) return "—";
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export default function AdminProductsPage() {
  const [items, setItems] = useState<ProductRow[]>([]);
  const [brands, setBrands] = useState<OptionRow[]>([]);
  const [types, setTypes] = useState<OptionRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [shareProduct, setShareProduct] = useState<ProductRow | null>(null);
  const [featuredFor, setFeaturedFor] = useState<ProductRow | null>(null);
  const [q, setQ] = useState("");
  const [condition, setCondition] = useState<"" | "new" | "used">("");
  const [featured, setFeatured] = useState<"" | "featured" | "regular">("");
  const [stockStatus, setStockStatus] = useState<"" | "in_stock" | "out_of_stock" | "on_order">("");
  const [stockLocationFilter, setStockLocationFilter] = useState<"" | ProductStockLocation>("");
  const [productRegionFilter, setProductRegionFilter] = useState<"" | ProductRegion>("");
  const [brandId, setBrandId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [hasSerial, setHasSerial] = useState<"" | "with" | "without">("");
  const [hasPurchasePrice, setHasPurchasePrice] = useState<"" | "with" | "without">("");
  const [purchasedFrom, setPurchasedFrom] = useState("");
  const [purchasedTo, setPurchasedTo] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, perPage: 20, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saleFor, setSaleFor] = useState<ProductRow | null>(null);
  const [saleBusy, setSaleBusy] = useState(false);
  const [saleForm, setSaleForm] = useState({
    contactId: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerEmail: "",
    notes: "",
  });
  const [contactQuery, setContactQuery] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactResults, setContactResults] = useState<ContactChoice[]>([]);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [purchaseDraft, setPurchaseDraft] = useState("");
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState<{ productName: string; customerName: string; amount: number } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [locationBusyId, setLocationBusyId] = useState<string | null>(null);
  const [suppliersById, setSuppliersById] = useState<Record<string, string>>({});

  const debouncedQ = useDebounce(q, 350);
  /*
   * UI винаги показва клетките като кликабилни (бърза инлайн редакция).
   * Authorization се прави **изцяло на сървъра** в `PUT /api/admin/products/[id]`:
   *   - `price`, `priceWithMount`, `purchasePrice` → само `master_admin`;
   *   - `stockLocation`, `productRegion` → `master_admin` + `office_staff`.
   * При липса на права API връща грешка и UI я показва в червената лента горе.
   */

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    if (condition) sp.set("condition", condition);
    if (featured) sp.set("featured", featured);
    if (stockStatus) sp.set("stockStatus", stockStatus);
    if (stockLocationFilter) sp.set("stockLocation", stockLocationFilter);
    if (productRegionFilter) sp.set("productRegion", productRegionFilter);
    if (brandId) sp.set("brandId", brandId);
    if (typeId) sp.set("typeId", typeId);
    if (supplierId) sp.set("supplierId", supplierId);
    if (priceMin.trim()) sp.set("priceMin", priceMin.trim());
    if (priceMax.trim()) sp.set("priceMax", priceMax.trim());
    if (hasSerial) sp.set("hasSerial", hasSerial);
    if (hasPurchasePrice) sp.set("hasPurchasePrice", hasPurchasePrice);
    if (purchasedFrom) sp.set("purchasedFrom", purchasedFrom);
    if (purchasedTo) sp.set("purchasedTo", purchasedTo);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    sp.set("page", String(page));
    sp.set("perPage", "20");
    return sp.toString();
  }, [
    debouncedQ,
    condition,
    featured,
    stockStatus,
    stockLocationFilter,
    productRegionFilter,
    brandId,
    typeId,
    supplierId,
    priceMin,
    priceMax,
    hasSerial,
    hasPurchasePrice,
    purchasedFrom,
    purchasedTo,
    sortBy,
    sortDir,
    page,
  ]);

  async function loadMeta() {
    try {
      const [bRes, tRes, sRes] = await Promise.all([
        fetch("/api/admin/meta/brands", { credentials: "include" }),
        fetch("/api/admin/meta/product-types", { credentials: "include" }),
        fetch("/api/admin/contacts?kind=supplier&perPage=500", { credentials: "include" }),
      ]);
      const [bJson, tJson, sJson] = await Promise.all([
        bRes.json().catch(() => ({})),
        tRes.json().catch(() => ({})),
        sRes.json().catch(() => ({})),
      ]);
      if (bRes.ok) setBrands(((bJson as { data?: OptionRow[] }).data ?? []) as OptionRow[]);
      if (tRes.ok) setTypes(((tJson as { data?: OptionRow[] }).data ?? []) as OptionRow[]);
      if (sRes.ok) {
        const rows = ((sJson as { data?: { id: string; full_name: string }[] }).data ?? []) as {
          id: string;
          full_name: string;
        }[];
        const m: Record<string, string> = {};
        for (const r of rows) m[r.id] = r.full_name;
        setSuppliersById(m);
      }
    } catch {
      // non-blocking for products table
    }
  }

  function supplierLabel(id: string | null | undefined) {
    if (!id) return "—";
    return suppliersById[id] ?? "—";
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
      setMeta(json.meta ?? { page: 1, perPage: 20, total: 0 });
      setSelected([]);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  function resetFilters() {
    setQ("");
    setCondition("");
    setFeatured("");
    setStockStatus("");
    setStockLocationFilter("");
    setProductRegionFilter("");
    setBrandId("");
    setTypeId("");
    setSupplierId("");
    setPriceMin("");
    setPriceMax("");
    setHasSerial("");
    setHasPurchasePrice("");
    setPurchasedFrom("");
    setPurchasedTo("");
    setSortBy("name");
    setSortDir("asc");
    setPage(1);
  }

  // Превключване на сортирането от клик върху заглавие на колона:
  //   • клик върху същата колона → обръща посоката (asc ↔ desc);
  //   • клик върху нова колона   → започва възходящо.
  function handleSort(field: SortField) {
    setPage(1);
    if (sortBy === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir("asc");
    }
  }

  // Масовите действия са нарочно сведени до едно — изтриване. Останалите
  // операции (промяна на статус, тип, наличност) се правят индивидуално от
  // карта/редакция, защото всеки климатик е уникален артикул със собствени
  // серийни номера и не се мисли „на бройки“.
  async function bulkDelete() {
    if (selected.length === 0) return;
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    const res = await fetch("/api/admin/products/bulk", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", ids: selected }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any).error || "Грешка при изтриване");
      return;
    }
    setConfirmBulkDelete(false);
    await load();
  }

  useEffect(() => {
    if (!saleFor) return;
    const q = contactQuery.trim();
    if (q.length < 2) {
      setContactResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setContactLoading(true);
      try {
        const res = await fetch(`/api/admin/contacts?q=${encodeURIComponent(q)}&perPage=20`, { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (res.ok) setContactResults((json as any).data ?? []);
      } finally {
        setContactLoading(false);
      }
    }, 180);
    return () => clearTimeout(t);
  }, [contactQuery, saleFor]);

  async function createContactInline() {
    if (!saleForm.customerName.trim() || !saleForm.customerPhone.trim()) return;
    const res = await fetch("/api/admin/contacts", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: saleForm.customerName.trim(),
        phone: saleForm.customerPhone.trim(),
        email: saleForm.customerEmail.trim() || null,
        address: saleForm.customerAddress.trim() || null,
        notes: saleForm.notes.trim() || null,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json as any).error || "Грешка при създаване на контакт");
    const c = (json as any).data as ContactChoice;
    setSaleForm((s) => ({ ...s, contactId: c.id }));
    setContactQuery(c.full_name);
    setContactResults([c]);
  }

  async function markAsSold(
    p: ProductRow,
    customer: { id?: string; name: string; phone: string; address: string; email?: string; notes: string },
  ) {
    if (!canRecordSale(p)) return false;
    // Намаляваме наличността с 1, но не под 0. Старият код караше всички
    // количества към 0 след една продажба — затова продукти с qty > 1
    // изчезваха от каталога. Сега „Изчерпан“ се сетва само ако реалната
    // наличност стигне 0; иначе оставяме съществуващия статус.
    const currentQty = Math.max(0, Number(p.stock_quantity ?? 0));
    const nextQty = Math.max(0, currentQty - 1);
    const nextSold = Math.max(0, Number(p.sold_quantity ?? 0) + 1);
    const shouldHideFromCatalog = nextQty === 0;
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stockQuantity: nextQty,
        soldQuantity: nextSold,
        stockStatus: shouldHideFromCatalog ? "out_of_stock" : p.stock_status,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as any).error || "Грешка при маркиране на продажба");
      return false;
    }
    setItems((prev) =>
      prev.map((x) =>
        x.id === p.id
          ? {
              ...x,
              stock_quantity: nextQty,
              sold_quantity: nextSold,
              stock_status: shouldHideFromCatalog ? "out_of_stock" : x.stock_status,
            }
          : x,
      ),
    );

    // Auto-create an operational record visible in the dashboard calendar.
    const today = new Date().toISOString().slice(0, 10);
    void fetch("/api/admin/work-items", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "sale",
        eventCode: "sale",
        title: `Продажба: ${p.name}`,
        dueDate: today,
        priority: "medium",
        status: "done",
        productId: p.id,
        contactId: customer.id || null,
        customerName: customer.name || null,
        customerPhone: customer.phone || null,
        customerAddress: customer.address || null,
        notes: customer.notes || null,
        quantity: 1,
        unitPrice: Number(p.price),
        totalAmount: Number(p.price),
      }),
    });
    return true;
  }

  function startPriceEdit(p: ProductRow) {
    setEditingPriceId(p.id);
    setPriceDraft(String(Number(p.price)));
  }

  async function savePrice(p: ProductRow) {
    const nextPrice = Number(String(priceDraft).replace(",", "."));
    if (!Number.isFinite(nextPrice) || nextPrice < 0) {
      setError("Въведете валидна цена.");
      return;
    }
    setPriceBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price: nextPrice }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при редакция на цена");
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, price: nextPrice } : x)));
      setEditingPriceId(null);
      setPriceDraft("");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setPriceBusy(false);
    }
  }

  function toggleStockLocation(p: ProductRow) {
    const cur = normalizeProductStockLocation(p.stock_location);
    const next: ProductStockLocation = cur === "showroom" ? "warehouse" : "showroom";
    void patchStockLocation(p.id, next);
  }

  async function patchStockLocation(productId: string, next: ProductStockLocation) {
    setError(null);
    setLocationBusyId(productId);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stockLocation: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при смяна на място");
      const norm = normalizeProductStockLocation(next);
      setItems((prev) => prev.map((x) => (x.id === productId ? { ...x, stock_location: norm } : x)));
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLocationBusyId(null);
    }
  }

  function startPurchaseEdit(p: ProductRow) {
    setEditingPurchaseId(p.id);
    const pp = p.purchase_price;
    setPurchaseDraft(pp == null || !Number.isFinite(Number(pp)) ? "" : String(Number(pp)));
  }

  async function savePurchasePrice(p: ProductRow) {
    const raw = purchaseDraft.trim().replace(",", ".");
    let nextPurchase: number | null;
    if (raw === "") nextPurchase = null;
    else {
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        setError("Въведете валидна закупна цена или оставете празно.");
        return;
      }
      nextPurchase = n;
    }
    setPurchaseBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products/${p.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchasePrice: nextPurchase }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при закупна цена");
      setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, purchase_price: nextPurchase } : x)));
      setEditingPurchaseId(null);
      setPurchaseDraft("");
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setPurchaseBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  // Списък с активни филтри — ползва се за брояча и за chip bar-а.
  type ActiveFilter = { key: string; label: string; onClear: () => void };
  const supplierName = supplierId ? suppliersById[supplierId] : null;
  const brandName = brandId ? brands.find((b) => b.id === brandId)?.name : null;
  const typeName = typeId ? types.find((t) => t.id === typeId)?.name : null;

  const activeFilters: ActiveFilter[] = [];
  if (condition) {
    activeFilters.push({
      key: "condition",
      label: `Състояние: ${condition === "new" ? "Нови" : "Втора употреба"}`,
      onClear: () => setCondition(""),
    });
  }
  if (featured) {
    activeFilters.push({
      key: "featured",
      label: featured === "featured" ? "Само топ продукти" : "Само нормални (без топ)",
      onClear: () => setFeatured(""),
    });
  }
  if (stockStatus) {
    const label =
      stockStatus === "in_stock"
        ? "В наличност"
        : stockStatus === "on_order"
          ? "По поръчка"
          : "Изчерпан";
    activeFilters.push({ key: "stockStatus", label: `Каталог: ${label}`, onClear: () => setStockStatus("") });
  }
  if (stockLocationFilter) {
    activeFilters.push({
      key: "stockLocation",
      label: `Място: ${stockLocationFilter === "showroom" ? "Магазин" : "Склад"}`,
      onClear: () => setStockLocationFilter(""),
    });
  }
  if (productRegionFilter) {
    activeFilters.push({
      key: "region",
      label: `Страна: ${productRegionFilter === "europe" ? "EUROPE" : "JAPAN"}`,
      onClear: () => setProductRegionFilter(""),
    });
  }
  if (brandId) activeFilters.push({ key: "brand", label: `Марка: ${brandName ?? "—"}`, onClear: () => setBrandId("") });
  if (typeId) activeFilters.push({ key: "type", label: `Тип: ${typeName ?? "—"}`, onClear: () => setTypeId("") });
  if (supplierId) activeFilters.push({ key: "supplier", label: `Доставчик: ${supplierName ?? "—"}`, onClear: () => setSupplierId("") });
  if (priceMin || priceMax) {
    activeFilters.push({
      key: "price",
      label: `Цена: ${priceMin || "0"} – ${priceMax || "∞"} €`,
      onClear: () => { setPriceMin(""); setPriceMax(""); },
    });
  }
  if (hasSerial) {
    activeFilters.push({
      key: "hasSerial",
      label: hasSerial === "with" ? "Само със сериен №" : "Само без сериен №",
      onClear: () => setHasSerial(""),
    });
  }
  if (hasPurchasePrice) {
    activeFilters.push({
      key: "hasPurchase",
      label: hasPurchasePrice === "with" ? "Само със закупна цена" : "Само без закупна цена",
      onClear: () => setHasPurchasePrice(""),
    });
  }
  if (purchasedFrom || purchasedTo) {
    activeFilters.push({
      key: "purchasedRange",
      label: `Закупени: ${purchasedFrom || "…"} → ${purchasedTo || "…"}`,
      onClear: () => { setPurchasedFrom(""); setPurchasedTo(""); },
    });
  }
  const activeFiltersCount = activeFilters.length;

  return (
    <div className="w-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-900 mb-0.5 leading-tight">
            <SectionTitle title="Продукти" hint="Всеки ред е отделен артикул (серийни номера в картата). Филтри, продажба и масови действия." />
          </h1>
          <p className="text-xs text-slate-500 hidden md:block">
            Каталог с уникални артикули — всеки климатик с отделни серийни номера, доставчик и фактура.{" "}
            Филтри, сортиране с клик върху колоните, инлайн редакция на цени и място, ★ Топ продукти и продажба.
          </p>
        </div>
        <Link href="/admin/products/new" className="inline-flex items-center gap-2 bg-brand-orange-500 text-white px-3 py-2 md:px-4 rounded-xl font-semibold hover:bg-brand-orange-600 active:bg-brand-orange-700 transition-colors shadow-sm text-sm">
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Нов продукт</span>
          <span className="sm:hidden">Нов</span>
        </Link>
      </div>

      {/* Mobile: search + filter toggle row */}
      <div className="flex gap-2 md:hidden">
        <div className="flex-1">
          <ProductSearchBox
            value={q}
            onChange={(next) => { setPage(1); setQ(next); }}
            items={items}
            placeholder="Търси име, сериен №, фактура…"
          />
        </div>
        <button
          onClick={() => setFiltersOpen((o) => !o)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border font-semibold text-sm shrink-0 transition-colors ${filtersOpen ? "bg-brand-blue-50 border-brand-blue-200 text-brand-blue-700" : "bg-white border-slate-200 text-slate-700"}`}
        >
          <Filter className="w-4 h-4" />
          {activeFiltersCount > 0 && (
            <span className="bg-brand-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeFiltersCount}</span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Filters card — always visible on desktop, toggleable on mobile */}
      <Card className={`p-3 md:p-4 ${filtersOpen ? "block" : "hidden"} md:block space-y-4`}>
        {/* Row 1: търсене + общ брояч + reset */}
        <div className="flex items-center gap-2">
          <div className="flex-1 hidden md:block">
            <ProductSearchBox
              value={q}
              onChange={(next) => { setPage(1); setQ(next); }}
              items={items}
              placeholder="Търси по име, slug, сериен номер (вътрешен/външен) или № на фактура от доставчик…"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-semibold text-slate-500">
              Намерени: <span className="text-slate-900">{meta.total}</span>
            </span>
            {activeFiltersCount > 0 && (
              <Button variant="secondary" size="sm" onClick={resetFilters} title="Изчисти всички филтри" className="gap-1.5">
                <FilterX className="w-3.5 h-3.5 text-slate-500" /> Изчисти ({activeFiltersCount})
              </Button>
            )}
          </div>
        </div>

        {/* Бързи филтри: състояние + наличност в каталога — обединени на
            един ред с малки prefix-етикети. На малки екрани групите се
            пренареждат естествено във wrap. */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Бързи филтри</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mr-0.5">Състояние:</span>
              <ChipToggle active={!condition} onClick={() => { setPage(1); setCondition(""); }}>Всички</ChipToggle>
              <ChipToggle active={condition === "new"} onClick={() => { setPage(1); setCondition("new"); }}>Нови</ChipToggle>
              <ChipToggle active={condition === "used"} onClick={() => { setPage(1); setCondition("used"); }}>Втора употреба</ChipToggle>
            </div>
            <span className="hidden md:inline-block h-5 w-px bg-slate-200" aria-hidden />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mr-0.5">Наличност:</span>
              <ChipToggle active={!stockStatus} onClick={() => { setPage(1); setStockStatus(""); }}>Всички</ChipToggle>
              <ChipToggle
                active={stockStatus === "in_stock"}
                tone="success"
                onClick={() => { setPage(1); setStockStatus("in_stock"); }}
              >
                <PackageCheck className="w-3 h-3" /> В наличност
              </ChipToggle>
              <ChipToggle
                active={stockStatus === "on_order"}
                tone="warning"
                onClick={() => { setPage(1); setStockStatus("on_order"); }}
              >
                <Clock4 className="w-3 h-3" /> По поръчка
              </ChipToggle>
              <ChipToggle
                active={stockStatus === "out_of_stock"}
                tone="danger"
                onClick={() => { setPage(1); setStockStatus("out_of_stock"); }}
              >
                <PackageX className="w-3 h-3" /> Изчерпан
              </ChipToggle>
              <span className="hidden md:inline-block h-5 w-px bg-slate-200 mx-0.5" aria-hidden />
              <ChipToggle
                active={featured === "featured"}
                tone="brand"
                onClick={() => { setPage(1); setFeatured(featured === "featured" ? "" : "featured"); }}
              >
                <Star className="w-3 h-3 fill-current" /> Топ продукти
              </ChipToggle>
            </div>
          </div>
        </div>

        {/* Класификация: марка / тип / доставчик / място / страна */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Класификация</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3">
            <Select value={brandId} onChange={(e) => { setPage(1); setBrandId(e.target.value); }}>
              <option value="">Марка: всички</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Select value={typeId} onChange={(e) => { setPage(1); setTypeId(e.target.value); }}>
              <option value="">Тип: всички</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select value={supplierId} onChange={(e) => { setPage(1); setSupplierId(e.target.value); }}>
              <option value="">Доставчик: всички</option>
              {Object.entries(suppliersById)
                .sort((a, b) => a[1].localeCompare(b[1], "bg"))
                .map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
            </Select>
            <Select value={stockLocationFilter} onChange={(e) => { setPage(1); setStockLocationFilter(e.target.value as "" | ProductStockLocation); }}>
              <option value="">Място: всички</option>
              <option value="showroom">В магазин</option>
              <option value="warehouse">В склада</option>
            </Select>
            <Select value={productRegionFilter} onChange={(e) => { setPage(1); setProductRegionFilter(e.target.value as "" | ProductRegion); }}>
              <option value="">Страна: всички</option>
              <option value="europe">EUROPE</option>
              <option value="japan">JAPAN</option>
            </Select>
          </div>
        </div>

        {/* Цена, период на закупуване и допълнителни критерии — всичко на
            един ред (6 колони на десктоп), за да не се разкъсва вертикално
            и да остава компактно. На таблет се пренарежда в 3, на мобилен
            в 2 колони. Дата полетата имат „floating label“ — малък етикет
            горе вляво в самия input, защото HTML5 date input не показва
            placeholder. */}
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Цена, период на закупуване и критерии</div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 md:gap-3">
            <Input value={priceMin} onChange={(e) => { setPage(1); setPriceMin(e.target.value); }} placeholder="Цена от (€)" type="number" min={0} />
            <Input value={priceMax} onChange={(e) => { setPage(1); setPriceMax(e.target.value); }} placeholder="Цена до (€)" type="number" min={0} />
            <div className="relative">
              <span className="pointer-events-none absolute top-1 left-3 text-[9px] font-bold uppercase tracking-wide text-slate-500">Закупен от</span>
              <Input
                type="date"
                value={purchasedFrom}
                onChange={(e) => { setPage(1); setPurchasedFrom(e.target.value); }}
                max={purchasedTo || undefined}
                className="!pt-4 !pb-1.5 !text-xs"
              />
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute top-1 left-3 text-[9px] font-bold uppercase tracking-wide text-slate-500">Закупен до</span>
              <Input
                type="date"
                value={purchasedTo}
                onChange={(e) => { setPage(1); setPurchasedTo(e.target.value); }}
                min={purchasedFrom || undefined}
                className="!pt-4 !pb-1.5 !text-xs"
              />
            </div>
            <Select value={hasSerial} onChange={(e) => { setPage(1); setHasSerial(e.target.value as "" | "with" | "without"); }}>
              <option value="">Сериен №: всички</option>
              <option value="with">Само със сериен №</option>
              <option value="without">Само без сериен №</option>
            </Select>
            <Select value={hasPurchasePrice} onChange={(e) => { setPage(1); setHasPurchasePrice(e.target.value as "" | "with" | "without"); }}>
              <option value="">Закупна цена: всички</option>
              <option value="with">Само с попълнена</option>
              <option value="without">Само без попълнена</option>
            </Select>
          </div>
        </div>

        {/*
         * Бел.: Сортирането НЕ е в този филтър блок преднамерено — то се
         * управлява чрез кликване върху заглавията на колоните в таблицата
         * по-долу (стандартен админ UX). Така екранът остава по-чист и
         * връзката „кликни → сортира тази колона“ е очевидна.
         */}

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className="pt-1 border-t border-slate-100">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Активни филтри</div>
            <div className="flex flex-wrap gap-1.5">
              {activeFilters.map((f) => (
                <button
                  key={f.key}
                  onClick={() => { setPage(1); f.onClear(); }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-blue-50 text-brand-blue-700 border border-brand-blue-200 hover:bg-brand-blue-100 hover:text-brand-blue-800 transition-colors"
                  title="Премахни този филтър"
                >
                  {f.label}
                  <span aria-hidden className="text-brand-blue-500">×</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Bulk actions — само „Изтрий“. Видимо когато има поне един избран ред. */}
      {selected.length > 0 && (
        <div className="bg-brand-blue-50 border border-brand-blue-200 rounded-xl px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs md:text-sm font-bold text-brand-blue-700">
            Избрани: {selected.length}{" "}
            <span className="font-normal text-brand-blue-600/80 hidden sm:inline">
              (за останалите промени отвори картата на продукта)
            </span>
          </span>
          <div className="flex gap-1.5 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelected([])}
              className="!py-1.5"
            >
              Откажи избора
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={bulkDelete}
              className="gap-1 !py-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Изтрий избраните
            </Button>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
        <Table className="min-w-[1100px]">
          <thead>
            <tr>
              <Th className="w-10">
                <input
                  type="checkbox"
                  className="rounded border-slate-300 text-brand-blue-500 focus:ring-brand-blue-500"
                  checked={items.length > 0 && selected.length === items.length}
                  onChange={(e) => setSelected(e.target.checked ? items.map((x) => x.id) : [])}
                />
              </Th>
              <SortableTh label="Име" field="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <Th>Марка</Th>
              <SortableTh label="Състояние" field="product_condition" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <Th>Тип</Th>
              <Th>Доставчик</Th>
              <SortableTh label="Закупна" field="purchase_price" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Закупен на" field="purchased_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Продажна" field="price" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <Th>Сер. вътр.</Th>
              <Th>Сер. външ.</Th>
              <Th>Фактура доставчик</Th>
              <Th>Страна</Th>
              <Th>Място</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50 transition-colors group">
                <Td>
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand-blue-500 focus:ring-brand-blue-500"
                    checked={selected.includes(p.id)}
                    onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id))}
                  />
                </Td>
                <Td className="font-bold text-slate-900">
                  <ProductQuickViewButton productId={p.id} productName={p.name} />
                </Td>
                <Td>{p.brands?.name ?? "—"}</Td>
                <Td>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.product_condition === "used" ? "bg-brand-orange-100 text-brand-orange-700" : "bg-brand-blue-100 text-brand-blue-700"}`}>
                    {p.product_condition === "used" ? "Втора употреба" : "Нови"}
                  </span>
                </Td>
                <Td>{p.product_types?.name ?? "—"}</Td>
                <Td className="max-w-[9rem]">
                  <span className="block truncate text-sm text-slate-800" title={supplierLabel(p.supplier_id)}>
                    {supplierLabel(p.supplier_id)}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-sm">
                  {editingPurchaseId === p.id ? (
                    <div className="flex flex-col gap-1 min-w-[7rem]">
                      <Input
                        type="number"
                        min={0}
                        value={purchaseDraft}
                        onChange={(e) => setPurchaseDraft(e.target.value)}
                        className="!text-xs !py-1"
                        autoFocus
                        placeholder="—"
                      />
                      <div className="flex gap-1">
                        <Button size="sm" className="!py-0.5 !px-2 !text-[11px]" onClick={() => void savePurchasePrice(p)} disabled={purchaseBusy}>
                          OK
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="!py-0.5 !px-2 !text-[11px]"
                          onClick={() => {
                            setEditingPurchaseId(null);
                            setPurchaseDraft("");
                          }}
                          disabled={purchaseBusy}
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startPurchaseEdit(p)}
                      className="rounded-md px-2 py-1 text-left font-semibold text-slate-900 bg-brand-orange-50/60 hover:bg-brand-orange-100 hover:text-brand-orange-700 focus:outline-none focus:ring-2 focus:ring-brand-orange-300 cursor-pointer transition"
                      title="Клик за редакция на закупна цена"
                    >
                      {fmtEuro(p.purchase_price)}
                    </button>
                  )}
                </Td>
                {/* Дата на закупуване от доставчик — редактира се от формата на продукта. */}
                <Td className="whitespace-nowrap text-xs text-slate-600">
                  {fmtPurchaseDate(p.purchased_at)}
                </Td>
                <Td className="whitespace-nowrap text-sm font-semibold">
                  {editingPriceId === p.id ? (
                    <div className="flex flex-col gap-1 min-w-[7rem]">
                      <Input type="number" min={0} value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} className="!text-xs !py-1" autoFocus />
                      <div className="flex gap-1">
                        <Button size="sm" className="!py-0.5 !px-2 !text-[11px]" onClick={() => void savePrice(p)} disabled={priceBusy}>
                          OK
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          className="!py-0.5 !px-2 !text-[11px]"
                          onClick={() => {
                            setEditingPriceId(null);
                            setPriceDraft("");
                          }}
                          disabled={priceBusy}
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startPriceEdit(p)}
                      className="rounded-md px-2 py-1 text-left text-slate-900 bg-brand-blue-50/60 hover:bg-brand-blue-100 hover:text-brand-blue-700 focus:outline-none focus:ring-2 focus:ring-brand-blue-300 cursor-pointer transition"
                      title="Клик за редакция на продажна цена"
                    >
                      {fmtEuro(p.price)}
                    </button>
                  )}
                </Td>
                <Td className="max-w-[5.5rem] text-xs font-mono text-slate-700" title={(p.indoor_unit_serial ?? "").trim() || undefined}>
                  {truncCell(p.indoor_unit_serial, 14)}
                </Td>
                <Td className="max-w-[5.5rem] text-xs font-mono text-slate-700" title={(p.outdoor_unit_serial ?? "").trim() || undefined}>
                  {truncCell(p.outdoor_unit_serial, 14)}
                </Td>
                <Td className="max-w-[6rem] text-xs text-slate-700" title={(p.supplier_invoice_number ?? "").trim() || undefined}>
                  {truncCell(p.supplier_invoice_number, 14)}
                </Td>
                <Td className="min-w-[6.5rem]">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wide text-slate-700 bg-slate-100">
                    {productRegionLabel(p.product_region)}
                  </span>
                </Td>
                <Td className="min-w-[132px]">
                  <button
                    type="button"
                    disabled={locationBusyId === p.id}
                    onClick={() => toggleStockLocation(p)}
                    title="Клик за смяна: магазин ↔ склад"
                    className={`inline-flex w-fit max-w-full items-center px-2.5 py-1 rounded-md text-xs font-semibold border border-slate-200/80 shadow-sm cursor-pointer transition hover:opacity-90 hover:ring-2 hover:ring-brand-blue-300/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 disabled:cursor-wait disabled:opacity-60 ${productStockLocationBadgeClass(p.stock_location)}`}
                  >
                    {locationBusyId === p.id ? "Запис…" : productStockLocationLabel(p.stock_location)}
                  </button>
                </Td>
                <Td>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => { setSaleFor(p); setSaleForm({ contactId: "", customerName: "", customerPhone: "", customerAddress: "", customerEmail: "", notes: "" }); setContactQuery(""); setContactResults([]); }} disabled={!canRecordSale(p)} className="!py-1 !px-2 !text-xs font-bold">
                      Продажба
                    </Button>
                    <Link href={`/admin/products/${p.id}`} className="inline-flex items-center gap-1.5 px-2 py-1 bg-brand-blue-50 text-brand-blue-700 hover:bg-brand-blue-100 rounded-lg text-xs font-bold transition-colors">
                      <Edit className="w-3.5 h-3.5" /> Редакция
                    </Link>
                    <button
                      onClick={() => setShareProduct(p)}
                      title="Сподели в чат"
                      className="inline-flex items-center gap-1 px-2 py-1 bg-brand-orange-50 text-brand-orange-600 hover:bg-brand-orange-100 rounded-lg text-xs font-bold transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setFeaturedFor(p)}
                      title={
                        p.featured_position
                          ? `Топ продукти — позиция #${p.featured_position}`
                          : "Постави в Топ продукти на главната страница"
                      }
                      className={`relative inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold transition-colors ${
                        p.featured_position
                          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          : "bg-slate-100 text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                      }`}
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${p.featured_position ? "fill-current" : ""}`}
                      />
                      {p.featured_position && (
                        <span className="text-[10px] font-black leading-none">#{p.featured_position}</span>
                      )}
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr><Td colSpan={15} className="text-center py-8 text-slate-500">Няма намерени продукти.</Td></tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {loading && (
          <div className="text-center py-10 text-slate-500 text-sm">Зареждане...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">Няма намерени продукти.</div>
        )}
        {!loading && items.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden active:bg-slate-50 transition-colors">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-slate-300 text-brand-blue-500 focus:ring-brand-blue-500 w-4 h-4 shrink-0"
                  checked={selected.includes(p.id)}
                  onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id))}
                />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 text-sm leading-snug">
                    <ProductQuickViewButton productId={p.id} productName={p.name} />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${p.product_condition === "used" ? "bg-brand-orange-100 text-brand-orange-700" : "bg-brand-blue-100 text-brand-blue-700"}`}>
                      {p.product_condition === "used" ? "Втора употр." : "Нов"}
                    </span>
                    {p.brands?.name && <span className="text-xs text-slate-500">{p.brands.name}</span>}
                    {p.product_types?.name && <span className="text-xs text-slate-400">{p.product_types.name}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 space-y-1.5 min-w-[6.5rem]">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Продажна</div>
                  {editingPriceId === p.id ? (
                    <div className="flex flex-col gap-1.5 items-end">
                      <Input type="number" min={0} value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} className="w-24 text-right" autoFocus />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => void savePrice(p)} disabled={priceBusy} className="!py-1 !px-2 !text-xs">OK</Button>
                        <Button variant="secondary" size="sm" onClick={() => { setEditingPriceId(null); setPriceDraft(""); }} disabled={priceBusy} className="!py-1 !px-2 !text-xs">✕</Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startPriceEdit(p)}
                      className="text-lg font-black text-slate-900 rounded-lg px-2 py-1 bg-brand-blue-50/60 hover:bg-brand-blue-100 hover:text-brand-blue-700 focus:outline-none active:bg-brand-blue-100 transition-colors cursor-pointer"
                    >
                      {fmtEuro(p.price)}
                    </button>
                  )}
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 pt-0.5">Закупна</div>
                  {editingPurchaseId === p.id ? (
                    <div className="flex flex-col gap-1 items-end">
                      <Input type="number" min={0} value={purchaseDraft} onChange={(e) => setPurchaseDraft(e.target.value)} className="w-24 text-right !text-sm" placeholder="—" />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => void savePurchasePrice(p)} disabled={purchaseBusy} className="!py-1 !px-2 !text-xs">OK</Button>
                        <Button variant="secondary" size="sm" onClick={() => { setEditingPurchaseId(null); setPurchaseDraft(""); }} disabled={purchaseBusy} className="!py-1 !px-2 !text-xs">✕</Button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => startPurchaseEdit(p)} className="text-sm font-bold text-slate-800 rounded-lg px-2 py-0.5 bg-brand-orange-50/60 hover:bg-brand-orange-100 cursor-pointer transition">
                      {fmtEuro(p.purchase_price)}
                    </button>
                  )}
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 pt-0.5">Закупен на</div>
                  <div className="text-xs font-semibold text-slate-700">{fmtPurchaseDate(p.purchased_at)}</div>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 pt-0.5">Страна</div>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold text-slate-700 bg-slate-100">
                    {productRegionLabel(p.product_region)}
                  </span>
                  <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400 pt-0.5">Място</div>
                  <button
                    type="button"
                    disabled={locationBusyId === p.id}
                    onClick={() => toggleStockLocation(p)}
                    title="Клик: магазин ↔ склад"
                    className={`w-full inline-flex items-center justify-center px-2 py-1 rounded-md text-[11px] font-semibold border border-slate-200/80 cursor-pointer transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500 disabled:cursor-wait disabled:opacity-60 ${productStockLocationBadgeClass(p.stock_location)}`}
                  >
                    {locationBusyId === p.id ? "Запис…" : productStockLocationLabel(p.stock_location)}
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px] border-t border-slate-100 pt-2 text-slate-600">
                <span className="text-slate-400 shrink-0">Доставчик</span>
                <span className="font-medium text-slate-800 truncate" title={supplierLabel(p.supplier_id)}>
                  {supplierLabel(p.supplier_id)}
                </span>
                <span className="text-slate-400">Сер. вътр.</span>
                <span className="font-mono text-slate-800 break-all" title={(p.indoor_unit_serial ?? "").trim() || undefined}>
                  {truncCell(p.indoor_unit_serial, 40)}
                </span>
                <span className="text-slate-400">Сер. външ.</span>
                <span className="font-mono text-slate-800 break-all" title={(p.outdoor_unit_serial ?? "").trim() || undefined}>
                  {truncCell(p.outdoor_unit_serial, 40)}
                </span>
                <span className="text-slate-400">Фактура</span>
                <span className="text-slate-800 break-all" title={(p.supplier_invoice_number ?? "").trim() || undefined}>
                  {truncCell(p.supplier_invoice_number, 48)}
                </span>
              </div>
            </div>
            <div className="flex border-t border-slate-100">
              <button
                type="button"
                onClick={() => { setSaleFor(p); setSaleForm({ contactId: "", customerName: "", customerPhone: "", customerAddress: "", customerEmail: "", notes: "" }); setContactQuery(""); setContactResults([]); }}
                disabled={!canRecordSale(p)}
                className="flex-1 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-colors disabled:opacity-40 border-r border-slate-100"
              >
                Продажба
              </button>
              <Link href={`/admin/products/${p.id}`} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-semibold text-brand-blue-700 hover:bg-brand-blue-50 active:bg-brand-blue-100 transition-colors">
                <Edit className="w-4 h-4" /> Редакция
              </Link>
              <button
                onClick={() => setShareProduct(p)}
                className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold text-brand-orange-600 hover:bg-brand-orange-50 active:bg-brand-orange-100 transition-colors border-r border-slate-100"
                title="Сподели в чат"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => setFeaturedFor(p)}
                className={`flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold transition-colors ${
                  p.featured_position
                    ? "text-amber-700 bg-amber-50 hover:bg-amber-100"
                    : "text-slate-500 hover:bg-amber-50 hover:text-amber-600"
                }`}
                title={
                  p.featured_position
                    ? `Топ продукти — позиция #${p.featured_position}`
                    : "Постави в Топ продукти"
                }
              >
                <Star className={`w-4 h-4 ${p.featured_position ? "fill-current" : ""}`} />
                {p.featured_position && (
                  <span className="text-[11px] font-black leading-none">#{p.featured_position}</span>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-500 font-medium">Общо: {meta.total}</span>
        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹ Пред.</Button>
          <span className="text-sm font-medium text-slate-600">{page} / {pages}</span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Следв. ›</Button>
        </div>
      </div>

      {saleFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
          onClick={() => !saleBusy && setSaleFor(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[calc(100vh-2rem)] overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e6f9fd_0,#ffffff_42%,#fff3ed_100%)] px-6 py-5">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand-blue-700">Запис на продажба</div>
              <div className="mt-1 text-2xl font-black leading-tight text-slate-950">{saleFor.name}</div>
              <div className="mt-1 text-sm font-medium text-slate-500">
                Създава продажба в календара, маркира този артикул като продаден (скрива се от каталога) и връзва контакт към сделката.
              </div>
            </div>

            <div className="grid max-h-[calc(100vh-12rem)] grid-cols-1 gap-3 overflow-y-auto p-6 md:grid-cols-2">
              <div className="col-span-full relative">
                <Input
                  value={contactQuery}
                  onChange={(e) => {
                    setContactQuery(e.target.value);
                    setSaleForm((s) => ({ ...s, contactId: "" }));
                  }}
                  placeholder="Търси контакт (име/телефон) ..."
                />
                {(contactLoading || contactResults.length > 0) && (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] border border-slate-200 rounded-lg bg-white shadow-lg z-10 max-h-32 overflow-y-auto p-1">
                    {contactLoading ? (
                      <div className="p-3 text-sm text-slate-500 text-center">Търсене...</div>
                    ) : (
                      contactResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSaleForm((s) => ({
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
                          className="block w-full text-left p-2 hover:bg-slate-50 rounded-lg transition-colors"
                        >
                          <div className="font-bold text-slate-900 text-sm">{c.full_name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">{c.phone}{c.email ? ` / ${c.email}` : ""}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
              <Input value={saleForm.customerName} onChange={(e) => setSaleForm((s) => ({ ...s, customerName: e.target.value }))} placeholder="Контактно лице*" />
              <Input value={saleForm.customerPhone} onChange={(e) => setSaleForm((s) => ({ ...s, customerPhone: e.target.value }))} placeholder="Телефон*" />
              <Input value={saleForm.customerEmail} onChange={(e) => setSaleForm((s) => ({ ...s, customerEmail: e.target.value }))} placeholder="Имейл" />
              <Input value={saleForm.customerAddress} onChange={(e) => setSaleForm((s) => ({ ...s, customerAddress: e.target.value }))} placeholder="Адрес" className="md:col-span-2" />
              <Textarea value={saleForm.notes} onChange={(e) => setSaleForm((s) => ({ ...s, notes: e.target.value }))} placeholder="Бележки (по желание)" rows={2} className="md:col-span-2 min-h-[2.75rem]" />
            </div>

            <div className="flex justify-between items-center border-t border-slate-100 bg-slate-50 px-6 py-4 gap-2 flex-wrap">
              <span className="text-sm font-black text-slate-900">Сума: €{Number(saleFor.price).toLocaleString()}</span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={saleBusy || !saleForm.customerName.trim() || !saleForm.customerPhone.trim()}
                  onClick={async () => {
                    setSaleBusy(true);
                    try {
                      await createContactInline();
                    } catch (e: any) {
                      setError(String(e?.message ?? e));
                    } finally {
                      setSaleBusy(false);
                    }
                  }}
                >
                  + Нов контакт
                </Button>
                <Button variant="secondary" disabled={saleBusy} onClick={() => setSaleFor(null)}>Отказ</Button>
                <Button
                  variant="primary"
                  disabled={saleBusy || !saleForm.customerName.trim() || !saleForm.customerPhone.trim()}
                  onClick={async () => {
                    setSaleBusy(true);
                    try {
                      const ok = await markAsSold(saleFor, {
                        id: saleForm.contactId || undefined,
                        name: saleForm.customerName.trim(),
                        phone: saleForm.customerPhone.trim(),
                        address: saleForm.customerAddress.trim(),
                        email: saleForm.customerEmail.trim(),
                        notes: saleForm.notes.trim(),
                      });
                      if (ok) {
                        setSaleSuccess({ productName: saleFor.name, customerName: saleForm.customerName.trim(), amount: Number(saleFor.price) });
                        setSaleFor(null);
                      }
                    } finally {
                      setSaleBusy(false);
                    }
                  }}
                >
                  {saleBusy ? "Запис..." : "Запиши продажба"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {saleSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md" onClick={() => setSaleSuccess(null)}>
          <div
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-[radial-gradient(circle_at_top_left,#dcfce7_0,#ffffff_44%,#f8fafc_100%)] px-6 py-6 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/25">
                <CheckCircle className="h-7 w-7" />
              </div>
              <div className="text-2xl font-black text-slate-950">Продажбата е записана</div>
              <div className="mt-2 text-sm font-medium text-slate-500">
                {saleSuccess.productName} · {saleSuccess.customerName}
              </div>
            </div>
            <div className="grid gap-3 p-6">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Сума</div>
                <div className="mt-1 text-2xl font-black text-slate-900">€{saleSuccess.amount.toLocaleString()}</div>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
                Артикулът е маркиран като продаден, продажбата е в историята и в календара.
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button onClick={() => setSaleSuccess(null)}>Готово</Button>
            </div>
          </div>
        </div>
      )}

      {confirmBulkDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
          onClick={() => setConfirmBulkDelete(false)}
        >
          <div
            className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-rose-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-xl font-black text-slate-950">Окончателно изтриване</div>
                <div className="mt-1 text-sm text-slate-600">
                  Ще бъдат изтрити <span className="font-bold text-rose-700">{selected.length}</span>{" "}
                  {selected.length === 1 ? "продукт" : "продукта"}. Това действие <span className="font-bold">не може да бъде отменено</span>.
                </div>
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  Заедно с продуктите ще се изтрият: снимки, характеристики, оценки и история на запитванията за тях.
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmBulkDelete(false)}>Отказ</Button>
              <Button variant="danger" onClick={() => void bulkDelete()} className="gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Изтрий {selected.length}
              </Button>
            </div>
          </div>
        </div>
      )}

      {shareProduct && (
        <ShareToChatModal
          product={{
            id: shareProduct.id,
            name: shareProduct.name,
            slug: shareProduct.id,
            price_from: shareProduct.price,
            brand_name: shareProduct.brands?.name ?? null,
          }}
          onClose={() => setShareProduct(null)}
        />
      )}

      {featuredFor && (
        <FeaturedSlotModal
          product={{
            id: featuredFor.id,
            name: featuredFor.name,
            brands: featuredFor.brands ?? null,
            stock_status: featuredFor.stock_status,
            is_active: featuredFor.is_active ?? null,
          }}
          onClose={() => setFeaturedFor(null)}
          onSaved={() => { void load(); }}
        />
      )}
    </div>
  );
}
