"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CATALOG_BTU_OPTIONS } from "@/lib/catalog/productBtu";
import {
  SectionTitle,
  Card,
  Button,
  Input,
  Select,
  Table,
  Th,
  Td,
  Textarea,
  AdminContactSuggestRow,
} from "../ui";
import { ActiveFilterChipsBar, type ActiveFilterChip } from "./ActiveFilterChipsBar";
import {
  Plus,
  FilterX,
  CheckCircle,
  Trash2,
  Edit,
  Filter,
  ChevronDown,
  MessageCircle,
  PackageCheck,
  Clock4,
  Star,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Settings,
  Eye,
  EyeOff,
  ExternalLink,
  Truck,
  Bookmark,
  BookmarkX,
  X,
  Ban,
  Wrench,
  Loader2,
} from "lucide-react";
import { ShareToChatModal } from "../chat/ShareToChatModal";
import { ServiceProtocolFormWizard } from "../service/documents/service/ServiceProtocolFormWizard";
import { ServiceProtocolPreview } from "../service/documents/service/ServiceProtocolPreview";
import { SERVICE_KIND_LABEL } from "@/lib/repair-protocol-fields";
import type { AdminRole } from "@/lib/admin/db";
import {
  canProductServiceProtocol,
  productToServiceProtocolInitialData,
  serviceProtocolButtonTitle,
  serviceProtocolButtonClass,
  type LinkedRepairProtocolSummary,
} from "@/lib/admin/productServiceProtocol";
import { useAdminBackHandler } from "@/lib/admin/useAdminBackHandler";
import { CatalogItemQuickViewButton } from "../ProductQuickView";
import { FeaturedSlotModal } from "./FeaturedSlotModal";
import { ProductCatalogSettingsModal } from "./ProductCatalogSettingsModal";
import { ProductSupplierOrderModal } from "./ProductSupplierOrderModal";
import { StockLocationCell } from "./StockLocationCell";
import { ProductReservationModal } from "./ProductReservationModal";
import { formatAdminPriceEuro, formatAdminDateOnly } from "@/lib/admin/formatEuro";
import {
  PriceRangeSlider,
  ADMIN_PRICE_FILTER_MIN,
  ADMIN_PRICE_FILTER_MAX,
  isAdminPriceFilterActive,
} from "./PriceRangeSlider";
import { postAdminCatalogBulkInChunks, BulkConfirmRequiredError } from "@/lib/admin/catalogBulkFetch";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { assertNoContactPrimaryPhoneDuplicate } from "@/lib/admin/contactPhoneConflictClient";
import {
  agreedPriceAfterDiscount,
  discountPercentFromAgreedPrice,
  formatAgreedPriceInput,
  parseDecimalInput,
} from "@/lib/admin/agreedPriceDiscount";
import { notifyAdminCalendarReload } from "@/lib/admin/calendarReload";
import { recordProductSale } from "@/lib/admin/recordProductSale";
import {
  normalizeProductStockLocation,
  productStockLocationLabelCompact,
  type ProductStockLocation,
} from "@/lib/admin/productStockLocation";
import {
  productRegionLabel,
  type ProductRegion,
} from "@/lib/admin/productRegion";
import {
  ADMIN_PRODUCTS_LIST_PER_PAGE,
  clearAdminProductsListFilters,
  DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS,
  loadAdminProductsListFilters,
  saveAdminProductsListFilters,
  type CatalogKindFilter,
  type SortDir,
  type SortField,
} from "./productsListFiltersStorage";
import {
  buildProductCatalogDisplayRows,
  filterProductsCatalogItems,
  isGroupedExhaustedSelectable,
  productShowsSupplierInvoice,
} from "@/lib/admin/productCatalogDisplay";
import {
  csvParam,
  toggleChipFilter,
  type FeaturedFilter,
  type ProductConditionFilter,
  type PublicCatalogFilter,
  type StockStatusFilter,
} from "@/lib/admin/productListQueryFilters";

export const dynamic = "force-dynamic";

type ProductRow = {
  catalog_item?: "product" | "accessory";
  accessory_kind?: string | null;
  id: string;
  slug: string;
  name: string;
  price: number;
  purchase_price?: number | null;
  is_featured: boolean;
  is_active?: boolean | null;
  show_in_public_catalog?: boolean | null;
  featured_position?: number | null;
  featured_badge?: string | null;
  stock_status: "in_stock" | "out_of_stock" | "on_order" | string;
  stock_location?: ProductStockLocation | string | null;
  stock_quantity: number;
  sold_quantity: number;
  product_condition: "new" | "used";
  supplier_id?: string | null;
  source_url?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  supplier_invoice_number?: string | null;
  product_region?: ProductRegion | string | null;
  purchased_at?: string | null;
  /** Технически код на модела (напр. „FTXA50AW“). Когато е попълнен,
   *  продуктът е per-instance и количеството в каталога е COUNT(*)
   *  на всички инстанции със същия модел и `stock_status=in_stock`
   *  (поддържано от DB тригер; виж миграция 0039). */
  model_code?: string | null;
  brand_id?: string | null;
  brands?: { name?: string } | null;
  product_types?: { name?: string } | null;
  supplier?: { full_name?: string | null } | { full_name?: string | null }[] | null;
  container_id?: string | null;
  container?: { name?: string | null } | { name?: string | null }[] | null;
};

type OptionRow = { id: string; name: string };
type ContactChoice = { id: string; full_name: string; phone: string; email?: string | null; address?: string | null };

function isAccessoryRow(p: Pick<ProductRow, "catalog_item">): boolean {
  return p.catalog_item === "accessory";
}

/** Единен icon бутон в колона „Действия“ (продажбата остава отделно). */
const PRODUCT_ROW_ICON_BTN =
  "inline-flex items-center justify-center w-[34px] h-[34px] rounded-xl border shrink-0 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed";

/** Редакция — леко по-голям, защото се ползва най-често. */
const PRODUCT_ROW_EDIT_BTN =
  "inline-flex items-center justify-center w-[38px] h-[38px] rounded-xl border shrink-0 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 active:scale-[0.97]";

const PRODUCT_ROW_ICON = "w-3.5 h-3.5 shrink-0";
const PRODUCT_ROW_EDIT_ICON = "w-4 h-4 shrink-0";

function catalogEditHref(p: Pick<ProductRow, "id" | "catalog_item">): string {
  return isAccessoryRow(p) ? `/admin/accessories/${p.id}` : `/admin/products/${p.id}`;
}

function partitionSelectedIds(items: ProductRow[], selected: string[]) {
  const selectedSet = new Set(selected);
  const rows = items.filter((x) => selectedSet.has(x.id));
  return {
    productIds: rows.filter((x) => !isAccessoryRow(x)).map((x) => x.id),
    accessoryIds: rows.filter((x) => isAccessoryRow(x)).map((x) => x.id),
  };
}

function bulkDeleteNoun(items: ProductRow[], selected: string[]) {
  const { productIds, accessoryIds } = partitionSelectedIds(items, selected);
  const n = selected.length;
  if (productIds.length > 0 && accessoryIds.length > 0) return n === 1 ? "артикул" : "артикула";
  if (accessoryIds.length > 0) return n === 1 ? "аксесоар" : "аксесоара";
  return n === 1 ? "продукт" : "продукта";
}

function bulkDeleteWarning(items: ProductRow[], selected: string[]) {
  const { productIds, accessoryIds } = partitionSelectedIds(items, selected);
  if (accessoryIds.length > 0 && productIds.length === 0) {
    return "Заедно с аксесоарите ще се изтрият и свързаните снимки.";
  }
  if (productIds.length > 0 && accessoryIds.length > 0) {
    return "Ще се изтрият избраните климатици (снимки, спецификации) и аксесоари (снимки).";
  }
  return "Заедно с продуктите ще се изтрият: снимки, характеристики, оценки и история на запитванията за тях.";
}

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
  center = false,
}: {
  label: string;
  field: SortField;
  sortBy: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
  className?: string;
  /** Подравняване по център (таблица продукти). */
  center?: boolean;
}) {
  const isActive = sortBy === field;
  const ArrowIcon = !isActive ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Th
      className={`cursor-pointer select-none hover:bg-slate-100 transition-colors ${center ? "text-center" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`w-full inline-flex items-center gap-0.5 text-[10px] leading-tight ${center ? "justify-center" : "text-left"} ${isActive ? "text-brand-blue-700" : "text-slate-600"}`}
        title={`Сортирай по „${label}“`}
      >
        <span className="truncate">{label}</span>
        <ArrowIcon className={`w-2.5 h-2.5 shrink-0 ${isActive ? "opacity-100" : "opacity-40"}`} />
      </button>
    </Th>
  );
}

function canRecordSale(p: ProductRow) {
  return p.stock_status === "in_stock" || p.stock_status === "on_order";
}

/** Няма записани серийни номера — напр. бройка от партида „втора употреба“,
 *  добавена по количество без сериен №. При продажба/прибиране в сервиз
 *  трябва да се въведат, за да се знае точно кой уред е засегнат. */
function productMissingSerials(p: Pick<ProductRow, "catalog_item" | "indoor_unit_serial" | "outdoor_unit_serial">) {
  return !isAccessoryRow(p) && !(p.indoor_unit_serial ?? "").trim() && !(p.outdoor_unit_serial ?? "").trim();
}

function canReserveProduct(p: ProductRow) {
  return !isAccessoryRow(p) && p.stock_status === "in_stock";
}

function isProductReserved(p: ProductRow) {
  return !isAccessoryRow(p) && p.stock_status === "reserved";
}

function saleButtonTitle(p: ProductRow): string {
  if (p.stock_status === "on_order") return "Поръчай от доставчик";
  if (p.stock_status === "reserved") return "Резервиран — продажба след отмяна на резервацията";
  if (p.stock_status === "scrapped") return "Бракуван — продажба не е възможна";
  if (p.stock_status === "out_of_stock") return "Изчерпан — продажба не е възможна";
  if (canRecordSale(p)) return "Продажба";
  return "Продажба не е възможна";
}

/** След продажба: само „в наличност“ → „изчерпан“; „по поръчка“ остава непроменен. */
function stockStatusAfterSale(
  priorStatus: ProductRow["stock_status"],
  hasModelCode: boolean,
  nextQty: number,
): ProductRow["stock_status"] | undefined {
  if (priorStatus !== "in_stock") return undefined;
  if (hasModelCode) return "out_of_stock";
  return nextQty <= 0 ? "out_of_stock" : "in_stock";
}

function defaultNextMountDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function emptySaleModalForm() {
  return {
    contactId: "",
    customerName: "",
    customerPhone: "",
    customerAddress: "",
    customerEmail: "",
    notes: "",
    agreedPrice: "",
    agreedPriceDiscountPct: "",
    includeMount: true,
    mountDate: defaultNextMountDate(),
    mountTimeFrom: "09:00",
    mountTimeTo: "13:00",
  };
}

function saleModalFormForProduct(p: ProductRow) {
  const base = emptySaleModalForm();
  const withoutMount = isAccessoryRow(p) ? { ...base, includeMount: false } : base;
  if (p.stock_status !== "on_order") return withoutMount;
  const catalog = Number(p.price);
  if (!Number.isFinite(catalog) || catalog < 0) return withoutMount;
  return { ...withoutMount, agreedPrice: formatAgreedPriceInput(catalog) };
}

function fmtEuro(n: number | null | undefined) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return `€${formatAdminPriceEuro(Number(n))}`;
}

function fmtPurchaseDate(value: string | null | undefined): string {
  return formatAdminDateOnly(value);
}

function catalogStockBadgeText(status: string, compact = false) {
  if (compact) {
    if (status === "in_stock") return "Наличен";
    if (status === "on_order") return "По поръчка";
    if (status === "reserved") return "Резервиран";
    if (status === "scrapped") return "Бракуван";
    return status || "—";
  }
  if (status === "in_stock") return "В наличност";
  if (status === "on_order") return "По поръчка";
  if (status === "reserved") return "Резервиран";
  if (status === "scrapped") return "Бракуван";
  return status || "—";
}

function catalogStockBadgeClass(status: string) {
  if (status === "in_stock") return "bg-emerald-100 text-emerald-800 border border-emerald-200/70";
  if (status === "scrapped") return "bg-stone-200 text-stone-800 border border-stone-300/80";
  if (status === "on_order") return "bg-amber-50 text-amber-900 border border-amber-200/70";
  if (status === "reserved") return "bg-sky-50 text-sky-900 border border-sky-200/70";
  return "bg-slate-100 text-slate-700 border border-slate-200/70";
}

function searchTokens(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const part of q.split(/[\s\-_/]+/)) {
    const t = part.trim();
    if (!t) continue;
    if (t.length < 2 && !/\d/.test(t)) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    tokens.push(t);
  }
  return tokens;
}

/**
 * Подсветка на съвпадения от търсенето (целия низ или всяка дума поотделно).
 */
function highlightMatch(text: string | null | undefined, query: string): ReactNode {
  const value = text ?? "";
  const q = query.trim();
  if (!value || !q) return value || "—";

  const fullIdx = value.toLowerCase().indexOf(q.toLowerCase());
  if (fullIdx >= 0) {
    return (
      <>
        {value.slice(0, fullIdx)}
        <mark className="bg-yellow-100 text-slate-900 rounded px-0.5">{value.slice(fullIdx, fullIdx + q.length)}</mark>
        {value.slice(fullIdx + q.length)}
      </>
    );
  }

  const tokens = searchTokens(q);
  if (tokens.length === 0) return value;

  type Span = { start: number; end: number };
  const spans: Span[] = [];
  const lower = value.toLowerCase();
  for (const tok of tokens) {
    let from = 0;
    while (from < lower.length) {
      const idx = lower.indexOf(tok, from);
      if (idx < 0) break;
      spans.push({ start: idx, end: idx + tok.length });
      from = idx + tok.length;
    }
  }
  if (spans.length === 0) return value;

  spans.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Span[] = [];
  for (const s of spans) {
    const last = merged[merged.length - 1];
    if (!last || s.start > last.end) merged.push({ ...s });
    else last.end = Math.max(last.end, s.end);
  }

  const out: ReactNode[] = [];
  let cursor = 0;
  for (const s of merged) {
    if (s.start > cursor) out.push(value.slice(cursor, s.start));
    out.push(
      <mark key={`${s.start}-${s.end}`} className="bg-yellow-100 text-slate-900 rounded px-0.5">
        {value.slice(s.start, s.end)}
      </mark>,
    );
    cursor = s.end;
  }
  if (cursor < value.length) out.push(value.slice(cursor));
  return <>{out}</>;
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
    const matchesField = (value: string | null | undefined) => {
      if (!value) return false;
      const hay = value.toLowerCase();
      if (hay.includes(q)) return true;
      const tokens = searchTokens(q);
      return tokens.length > 0 && tokens.every((tok) => hay.includes(tok));
    };
    const candidates: Array<{ label: string; value: string | null | undefined }> = [
      { label: "Сериен (вътр)", value: p.indoor_unit_serial },
      { label: "Сериен (външ)", value: p.outdoor_unit_serial },
      { label: "Фактура",       value: p.supplier_invoice_number },
      { label: "Slug",          value: p.slug },
    ];
    for (const c of candidates) {
      if (matchesField(c.value)) return { label: c.label, value: c.value! };
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

// Toggle-чип за бързи филтри — клик включва/изключва стойност (multi-select).
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
      className={`inline-flex items-center gap-0.5 sm:gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold border transition-colors ${
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const focusProductHandledRef = useRef(false);
  const [items, setItems] = useState<ProductRow[]>([]);
  const [brands, setBrands] = useState<OptionRow[]>([]);
  const [types, setTypes] = useState<OptionRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [shareProduct, setShareProduct] = useState<ProductRow | null>(null);
  const [featuredFor, setFeaturedFor] = useState<ProductRow | null>(null);
  const [q, setQ] = useState("");
  const [conditions, setConditions] = useState<ProductConditionFilter[]>([]);
  const [featuredFlags, setFeaturedFlags] = useState<FeaturedFilter[]>([]);
  const [publicCatalogFlags, setPublicCatalogFlags] = useState<PublicCatalogFilter[]>([]);
  const [stockStatuses, setStockStatuses] = useState<StockStatusFilter[]>([]);
  const [stockLocationFilter, setStockLocationFilter] = useState<"" | ProductStockLocation>("");
  const [productRegionFilter, setProductRegionFilter] = useState<"" | ProductRegion>("");
  const [catalogKind, setCatalogKind] = useState<CatalogKindFilter>("climatics");
  const [brandId, setBrandId] = useState("");
  const [btuFilters, setBtuFilters] = useState<string[]>([]);
  const [typeId, setTypeId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [containerId, setContainerId] = useState("");
  const [containers, setContainers] = useState<OptionRow[]>([]);
  const containerIdHandledRef = useRef(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    ADMIN_PRICE_FILTER_MIN,
    ADMIN_PRICE_FILTER_MAX,
  ]);
  const [hasSerial, setHasSerial] = useState<"" | "with" | "without">("");
  const [hasPurchasePrice, setHasPurchasePrice] = useState<"" | "with" | "without">("");
  const [purchasedFrom, setPurchasedFrom] = useState("");
  const [purchasedTo, setPurchasedTo] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saleFor, setSaleFor] = useState<ProductRow | null>(null);
  useAdminBackHandler(Boolean(saleFor), () => setSaleFor(null), "catalog-product-sale");
  const [orderFor, setOrderFor] = useState<ProductRow | null>(null);
  useAdminBackHandler(Boolean(orderFor), () => setOrderFor(null), "catalog-product-order");
  const [reserveFor, setReserveFor] = useState<ProductRow | null>(null);
  useAdminBackHandler(Boolean(reserveFor), () => setReserveFor(null), "catalog-product-reserve");
  const [reserveCancelBusyId, setReserveCancelBusyId] = useState<string | null>(null);
  const [saleBusy, setSaleBusy] = useState(false);
  const [saleForm, setSaleForm] = useState(emptySaleModalForm);
  // Серийни номера, попълвани в момента на продажба — само когато редът
  // още няма записани такива (напр. бройка от партида „втора употреба“).
  const [saleSerialIndoor, setSaleSerialIndoor] = useState("");
  const [saleSerialOutdoor, setSaleSerialOutdoor] = useState("");
  const [contactQuery, setContactQuery] = useState("");
  const [contactLoading, setContactLoading] = useState(false);
  const [contactResults, setContactResults] = useState<ContactChoice[]>([]);
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [priceBusy, setPriceBusy] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [purchaseDraft, setPurchaseDraft] = useState("");
  const [purchaseBusy, setPurchaseBusy] = useState(false);
  const [saleSuccess, setSaleSuccess] = useState<{
    productName: string;
    customerName: string;
    amount: number;
    isBackOrder?: boolean;
    isReservation?: boolean;
    isReservationCancel?: boolean;
    quantity?: number;
  } | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleteActiveLinkWarning, setBulkDeleteActiveLinkWarning] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [listFiltersReady, setListFiltersReady] = useState(false);
  const [catalogSettingsOpen, setCatalogSettingsOpen] = useState(false);
  const [locationBusyId, setLocationBusyId] = useState<string | null>(null);
  // Промяна на място в „Сервиз“ при продукт без серийни номера — изисква
  // потвърждение с попълване на серийните номера преди PATCH.
  const [serviceSerialPromptFor, setServiceSerialPromptFor] = useState<ProductRow | null>(null);
  const [serviceSerialIndoor, setServiceSerialIndoor] = useState("");
  const [serviceSerialOutdoor, setServiceSerialOutdoor] = useState("");
  useAdminBackHandler(Boolean(serviceSerialPromptFor), () => setServiceSerialPromptFor(null), "catalog-product-service-serial");
  const [suppliersById, setSuppliersById] = useState<Record<string, string>>({});
  /** Бърза инлайн редакция на продажна / закупна цена в таблицата — само master_admin (сървърът също валидира). */
  const [canEditMasterPricesInline, setCanEditMasterPricesInline] = useState(false);
  /** Master + офис: редакции в списъка, продажба, изтриване, топ продукти. Сервиз — само преглед + нов продукт. */
  const [canMutateProductRows, setCanMutateProductRows] = useState(true);
  /** Роля от whoami — за каталог настройки (сервиз: преглед). */
  const [adminRole, setAdminRole] = useState<string>("");
  const [repairProtocolByProductId, setRepairProtocolByProductId] = useState<
    Record<string, LinkedRepairProtocolSummary>
  >({});
  const [serviceProtocolWizard, setServiceProtocolWizard] = useState<{
    editId?: string;
    initialData?: ReturnType<typeof productToServiceProtocolInitialData>;
  } | null>(null);
  const [serviceProtocolPreview, setServiceProtocolPreview] = useState<LinkedRepairProtocolSummary | null>(null);
  const [serviceProtocolBusyId, setServiceProtocolBusyId] = useState<string | null>(null);

  const debouncedQ = useDebounce(q, 350);
  /*
   * Инлайн „Продажна“ и „Закупна“: кликабилни само за master_admin.
   * Authorization се прави **изцяло на сървъра** в `PUT /api/admin/products/[id]`:
   *   - `price`, `priceWithMount`, `purchasePrice` → само `master_admin`;
   *   - `stockLocation`, `productRegion` → `master_admin` + `office_staff`.
   * При липса на права API връща грешка и UI я показва в червената лента горе.
   */

  const listFiltersKey = useMemo(
    () =>
      JSON.stringify({
        debouncedQ,
        catalogKind,
        conditions,
        featuredFlags,
        publicCatalogFlags,
        stockStatuses,
        stockLocationFilter,
        productRegionFilter,
        brandId,
        btuFilters,
        typeId,
        supplierId,
        containerId,
        priceRange,
        hasSerial,
        hasPurchasePrice,
        purchasedFrom,
        purchasedTo,
        sortBy,
        sortDir,
      }),
    [
      debouncedQ,
      catalogKind,
      conditions,
      featuredFlags,
      publicCatalogFlags,
      stockStatuses,
      stockLocationFilter,
      productRegionFilter,
      brandId,
      btuFilters,
      typeId,
      supplierId,
      containerId,
      priceRange,
      hasSerial,
      hasPurchasePrice,
      purchasedFrom,
      purchasedTo,
      sortBy,
      sortDir,
    ],
  );

  const listFiltersKeyRef = useRef(listFiltersKey);
  const queryPage = listFiltersKeyRef.current !== listFiltersKey ? 1 : page;

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    sp.set("catalogKind", catalogKind);
    if (conditions.length) sp.set("condition", conditions.join(","));
    const featuredParam = csvParam(featuredFlags);
    if (featuredParam) sp.set("featured", featuredParam);
    const publicCatalogParam = csvParam(publicCatalogFlags);
    if (publicCatalogParam) sp.set("publicCatalog", publicCatalogParam);
    if (stockStatuses.length) sp.set("stockStatus", stockStatuses.join(","));
    if (stockLocationFilter) sp.set("stockLocation", stockLocationFilter);
    if (productRegionFilter) sp.set("productRegion", productRegionFilter);
    if (brandId) sp.set("brandId", brandId);
    if (btuFilters.length) sp.set("btu", btuFilters.join(","));
    if (typeId) sp.set("typeId", typeId);
    if (supplierId) sp.set("supplierId", supplierId);
    if (containerId) sp.set("containerId", containerId);
    if (priceRange[0] > ADMIN_PRICE_FILTER_MIN) sp.set("priceMin", String(priceRange[0]));
    if (priceRange[1] < ADMIN_PRICE_FILTER_MAX) sp.set("priceMax", String(priceRange[1]));
    if (hasSerial) sp.set("hasSerial", hasSerial);
    if (hasPurchasePrice) sp.set("hasPurchasePrice", hasPurchasePrice);
    if (purchasedFrom) sp.set("purchasedFrom", purchasedFrom);
    if (purchasedTo) sp.set("purchasedTo", purchasedTo);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    sp.set("page", String(queryPage));
    sp.set("perPage", String(ADMIN_PRODUCTS_LIST_PER_PAGE));
    return sp.toString();
  }, [
    debouncedQ,
    catalogKind,
    conditions,
    featuredFlags,
    publicCatalogFlags,
    stockStatuses,
    stockLocationFilter,
    productRegionFilter,
    brandId,
    btuFilters,
    typeId,
    supplierId,
    containerId,
    priceRange,
    hasSerial,
    hasPurchasePrice,
    purchasedFrom,
    purchasedTo,
    sortBy,
    sortDir,
    queryPage,
  ]);

  useEffect(() => {
    if (listFiltersKeyRef.current === listFiltersKey) return;
    listFiltersKeyRef.current = listFiltersKey;
    setPage(1);
  }, [listFiltersKey]);

  function applySavedListFilters() {
    const s = loadAdminProductsListFilters();
    setQ(s.q);
    setCatalogKind(s.catalogKind);
    setConditions(s.conditions);
    setFeaturedFlags(s.featuredFlags);
    setPublicCatalogFlags(s.publicCatalogFlags);
    setStockStatuses(s.stockStatuses);
    setStockLocationFilter(s.stockLocationFilter);
    setProductRegionFilter(s.productRegionFilter);
    setBrandId(s.brandId);
    setBtuFilters(s.btuFilters);
    setTypeId(s.typeId);
    setSupplierId(s.supplierId);
    setPriceRange(s.priceRange);
    setHasSerial(s.hasSerial);
    setHasPurchasePrice(s.hasPurchasePrice);
    setPurchasedFrom(s.purchasedFrom);
    setPurchasedTo(s.purchasedTo);
    setSortBy(s.sortBy);
    setSortDir(s.sortDir);
    setFiltersOpen(s.filtersOpen);
  }

  function snapshotListFilters() {
    return {
      version: 3 as const,
      q,
      catalogKind,
      conditions,
      featuredFlags,
      publicCatalogFlags,
      stockStatuses,
      stockLocationFilter,
      productRegionFilter,
      brandId,
      btuFilters,
      typeId,
      supplierId,
      priceRange,
      hasSerial,
      hasPurchasePrice,
      purchasedFrom,
      purchasedTo,
      sortBy,
      sortDir,
      filtersOpen,
    };
  }

  async function loadMeta() {
    try {
      const [bRes, tRes, sRes, cRes, wRes] = await Promise.all([
        fetch("/api/admin/meta/brands?usedInProducts=1", { credentials: "include" }),
        fetch("/api/admin/meta/product-types", { credentials: "include" }),
        fetch("/api/admin/contacts?kind=supplier&perPage=500", { credentials: "include" }),
        fetch("/api/admin/containers?perPage=200", { credentials: "include" }),
        fetch("/api/admin/whoami", { credentials: "include" }),
      ]);
      const [bJson, tJson, sJson, cJson, wJson] = await Promise.all([
        bRes.json().catch(() => ({})),
        tRes.json().catch(() => ({})),
        sRes.json().catch(() => ({})),
        cRes.json().catch(() => ({})),
        wRes.json().catch(() => ({})),
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
      if (cRes.ok) {
        const rows = ((cJson as { data?: { id: string; name: string }[] }).data ?? []) as { id: string; name: string }[];
        setContainers(rows.map((r) => ({ id: r.id, name: r.name })));
      }
      if (wRes.ok) {
        const role = (wJson as { data?: { admin?: { role?: string } | null } }).data?.admin?.role ?? "";
        setAdminRole(role);
        setCanEditMasterPricesInline(role === "master_admin");
        setCanMutateProductRows(role === "master_admin" || role === "office_staff");
      }
    } catch {
      // non-blocking for products table
    }
  }

  function supplierLabel(p: Pick<ProductRow, "supplier_id" | "supplier">) {
    const joined = p.supplier
      ? (Array.isArray(p.supplier) ? p.supplier[0]?.full_name : p.supplier.full_name)
      : null;
    if (joined?.trim()) return joined.trim();
    if (p.supplier_id && suppliersById[p.supplier_id]) return suppliersById[p.supplier_id];
    return "—";
  }

  function containerLabel(p: Pick<ProductRow, "container_id" | "container">): string | null {
    const joined = p.container
      ? (Array.isArray(p.container) ? p.container[0]?.name : p.container.name)
      : null;
    return joined?.trim() || null;
  }

  async function loadRepairProtocolMap(rows: ProductRow[]) {
    const ids = rows
      .filter((p) => !isAccessoryRow(p) && p.stock_status === "in_stock")
      .map((p) => p.id);
    if (ids.length === 0) {
      setRepairProtocolByProductId({});
      return;
    }
    try {
      const res = await fetch(
        `/api/admin/products/repair-protocol-ids?ids=${ids.join(",")}`,
        { credentials: "include" },
      );
      if (!res.ok) return;
      const json = await res.json() as { data?: Record<string, LinkedRepairProtocolSummary> };
      setRepairProtocolByProductId(json.data ?? {});
    } catch {
      /* non-blocking */
    }
  }

  async function openServiceProtocol(p: ProductRow) {
    if (!canProductServiceProtocol(p)) return;
    setServiceProtocolBusyId(p.id);
    try {
      const cached = repairProtocolByProductId[p.id];
      if (cached) {
        setServiceProtocolPreview(cached);
        return;
      }
      const res = await fetch(`/api/admin/products/${p.id}/repair-protocol`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const json = await res.json() as { data?: { protocol?: LinkedRepairProtocolSummary | null } };
      const protocol = json.data?.protocol ?? null;
      if (protocol) {
        setRepairProtocolByProductId((prev) => ({ ...prev, [p.id]: protocol }));
        setServiceProtocolPreview(protocol);
      } else {
        setServiceProtocolWizard({
          initialData: productToServiceProtocolInitialData(p),
        });
      }
    } finally {
      setServiceProtocolBusyId(null);
    }
  }

  function serviceProtocolPreviewLabel(p: LinkedRepairProtocolSummary): string {
    const brandModel = [p.ac_brand, p.ac_model].filter(Boolean).join(" ");
    if (p.service_kind === "recycle") {
      return [SERVICE_KIND_LABEL.recycle, brandModel].filter(Boolean).join(" · ") || "—";
    }
    return [p.client_name, brandModel].filter(Boolean).join(" · ") || "—";
  }

  function formatProtocolDate(iso: string): string {
    if (!iso) return "—";
    const [y, m, d] = iso.slice(0, 10).split("-");
    if (!y || !m || !d) return iso;
    return `${d}.${m}.${y}`;
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/products?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      const rows: ProductRow[] = json.data ?? [];
      setItems(rows);
      setTotalCount(json.meta?.total ?? (rows.length ?? 0));
      setSelected([]);
      void loadRepairProtocolMap(rows);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    applySavedListFilters();
    setListFiltersReady(true);
    void loadMeta();
  }, []);

  /** След запис от редакция — маха филтри, които крият новата/запазената бройка. */
  useEffect(() => {
    if (!listFiltersReady || focusProductHandledRef.current) return;
    const focusId = searchParams.get("focusProductId");
    if (!focusId) return;
    focusProductHandledRef.current = true;
    setPublicCatalogFlags([]);
    setStockStatuses([]);
    setBtuFilters([]);
    setHasSerial("");
    setHasPurchasePrice("");
    setPage(1);
    router.replace("/admin/products");
  }, [listFiltersReady, searchParams, router]);

  /** Дълбока връзка от екрана „Контейнери“ — предварително филтрира по контейнер. */
  useEffect(() => {
    if (!listFiltersReady || containerIdHandledRef.current) return;
    const cid = searchParams.get("containerId");
    if (!cid) return;
    containerIdHandledRef.current = true;
    setContainerId(cid);
    setPage(1);
    router.replace("/admin/products");
  }, [listFiltersReady, searchParams, router]);

  useEffect(() => {
    if (!listFiltersReady) return;
    saveAdminProductsListFilters(snapshotListFilters());
  }, [
    listFiltersReady,
    q,
    catalogKind,
    conditions,
    featuredFlags,
    publicCatalogFlags,
    stockStatuses,
    stockLocationFilter,
    productRegionFilter,
    brandId,
    btuFilters,
    typeId,
    supplierId,
    priceRange,
    hasSerial,
    hasPurchasePrice,
    purchasedFrom,
    purchasedTo,
    sortBy,
    sortDir,
    filtersOpen,
  ]);

  useEffect(() => {
    if (!listFiltersReady) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs, listFiltersReady]);

  function resetFilters() {
    const d = DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS;
    setQ(d.q);
    setCatalogKind(d.catalogKind);
    setConditions(d.conditions);
    setFeaturedFlags(d.featuredFlags);
    setPublicCatalogFlags(d.publicCatalogFlags);
    setStockStatuses(d.stockStatuses);
    setStockLocationFilter(d.stockLocationFilter);
    setProductRegionFilter(d.productRegionFilter);
    setBrandId(d.brandId);
    setBtuFilters(d.btuFilters);
    setTypeId(d.typeId);
    setSupplierId(d.supplierId);
    setContainerId("");
    setPriceRange(d.priceRange);
    setHasSerial(d.hasSerial);
    setHasPurchasePrice(d.hasPurchasePrice);
    setPurchasedFrom(d.purchasedFrom);
    setPurchasedTo(d.purchasedTo);
    setSortBy(d.sortBy);
    setSortDir(d.sortDir);
    setPage(1);
    clearAdminProductsListFilters();
  }

  // Превключване на сортирането от клик върху заглавие на колона:
  //   • клик върху същата колона → обръща посоката (asc ↔ desc);
  //   • клик върху нова колона   → започва възходящо.
  function handleSort(field: SortField) {
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
  async function bulkDelete(force = false) {
    if (selected.length === 0) return;
    if (!confirmBulkDelete && !force) {
      setConfirmBulkDelete(true);
      return;
    }
    const { productIds, accessoryIds } = partitionSelectedIds(items, selected);
    try {
      if (productIds.length > 0) {
        await postAdminCatalogBulkInChunks("/api/admin/products/bulk", productIds, { action: "delete", force });
      }
      if (accessoryIds.length > 0) {
        await postAdminCatalogBulkInChunks("/api/admin/accessories/bulk", accessoryIds, { action: "delete" });
      }
    } catch (e: unknown) {
      if (e instanceof BulkConfirmRequiredError) {
        setConfirmBulkDelete(false);
        setBulkDeleteActiveLinkWarning(e.warning);
        return;
      }
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    setConfirmBulkDelete(false);
    setBulkDeleteActiveLinkWarning(null);
    setSelected([]);
    await load();
  }

  async function bulkSetPublicCatalog(visible: boolean) {
    if (selected.length === 0) return;
    const { productIds, accessoryIds } = partitionSelectedIds(items, selected);
    try {
      if (productIds.length > 0) {
        await postAdminCatalogBulkInChunks("/api/admin/products/bulk", productIds, {
          action: "set_public_catalog",
          visible,
        });
      }
      if (accessoryIds.length > 0) {
        await postAdminCatalogBulkInChunks("/api/admin/accessories/bulk", accessoryIds, {
          action: "set_active",
          active: visible,
        });
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      return;
    }
    setSelected([]);
    await load();
  }

  async function togglePublicCatalog(p: ProductRow) {
    if (isAccessoryRow(p)) {
      const next = !(p.is_active ?? p.show_in_public_catalog);
      const res = await fetch(`/api/admin/accessories/${p.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((json as { error?: string }).error || "Грешка при промяна на видимостта");
        return;
      }
      setItems((prev) =>
        prev.map((x) =>
          x.id === p.id ? { ...x, is_active: next, show_in_public_catalog: next } : x,
        ),
      );
      return;
    }
    const next = !p.show_in_public_catalog;
    const res = await fetch(`/api/admin/products/${p.id}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showInPublicCatalog: next }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((json as { error?: string }).error || "Грешка при промяна на видимостта");
      return;
    }
    setItems((prev) => prev.map((x) => (x.id === p.id ? { ...x, show_in_public_catalog: next } : x)));
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
    await assertNoContactPrimaryPhoneDuplicate(saleForm.customerPhone.trim());
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
    prod: ProductRow,
    customer: { id?: string; name: string; phone: string; address: string; email?: string; notes: string },
    mount: { date: string; timeFrom: string; timeTo: string } | null,
    salePrice?: number,
    withInstallation = true,
    serials?: { indoor: string; outdoor: string },
  ) {
    if (!canRecordSale(prod)) return false;

    // Ако редът досега няма серийни номера (напр. бройка от партида
    // „втора употреба“), е задължително да се въведат точно сега.
    if (productMissingSerials(prod)) {
      if (!serials?.indoor.trim() || !serials?.outdoor.trim()) {
        setError("Въведете серийните номера (вътрешно и външно тяло) на продавания уред.");
        return false;
      }
    }

    const unitPrice =
      salePrice != null && Number.isFinite(salePrice) && salePrice >= 0
        ? salePrice
        : Number(prod.price);

    const hasModelCode = Boolean((prod.model_code ?? "").trim());
    const currentQty = Math.max(0, Number(prod.stock_quantity ?? 0));
    const nextSold = Math.max(0, Number(prod.sold_quantity ?? 0) + 1);
    const nextQty = Math.max(0, currentQty - 1);

    try {
      await recordProductSale(
        {
          id: prod.id,
          name: prod.name,
          price: unitPrice,
          purchase_price: prod.purchase_price,
          supplier_name: supplierLabel(prod) !== "—" ? supplierLabel(prod) : null,
          supplier_invoice_number: prod.supplier_invoice_number?.trim() || null,
          model_code: prod.model_code,
          stock_status: prod.stock_status,
          stock_quantity: prod.stock_quantity,
          sold_quantity: prod.sold_quantity,
          brand_id: prod.brand_id,
        },
        customer,
        mount,
        {
          withInstallation,
          salePrice: unitPrice,
          ...(serials?.indoor.trim() ? { indoorUnitSerial: serials.indoor.trim() } : {}),
          ...(serials?.outdoor.trim() ? { outdoorUnitSerial: serials.outdoor.trim() } : {}),
        },
      );

      const modelKey = (prod.model_code ?? "").trim().toLowerCase();
      const soldRowStatus = stockStatusAfterSale(prod.stock_status, hasModelCode, nextQty) ?? prod.stock_status;
      setItems((prev) =>
        prev.map((x) => {
          if (x.id === prod.id) {
            return {
              ...x,
              stock_status: soldRowStatus,
              sold_quantity: nextSold,
              stock_quantity: hasModelCode ? x.stock_quantity : nextQty,
              ...(serials?.indoor.trim() ? { indoor_unit_serial: serials.indoor.trim() } : {}),
              ...(serials?.outdoor.trim() ? { outdoor_unit_serial: serials.outdoor.trim() } : {}),
            };
          }
          if (
            hasModelCode &&
            x.brand_id &&
            x.brand_id === prod.brand_id &&
            (x.model_code ?? "").trim().toLowerCase() === modelKey
          ) {
            return { ...x, stock_quantity: nextQty };
          }
          return x;
        }),
      );

      if (withInstallation) notifyAdminCalendarReload();
      return true;
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      return false;
    }
  }

  async function cancelProductReservation(prod: ProductRow) {
    if (!isProductReserved(prod)) return false;
    setReserveCancelBusyId(prod.id);
    setError(null);
    try {
      const res = await fetch("/api/admin/product-reservations", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: prod.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Грешка при отмяна на резервацията");

      const modelKey = (prod.model_code ?? "").trim().toLowerCase();
      setItems((prev) =>
        prev.map((x) => {
          if (x.id === prod.id) return { ...x, stock_status: "in_stock" };
          if (
            modelKey &&
            x.brand_id &&
            x.brand_id === prod.brand_id &&
            (x.model_code ?? "").trim().toLowerCase() === modelKey
          ) {
            return { ...x, stock_quantity: Math.max(0, Number(x.stock_quantity ?? 0) + 1) };
          }
          return x;
        }),
      );
      setSaleSuccess({
        productName: prod.name,
        customerName: "—",
        amount: Number(prod.price) || 0,
        isReservationCancel: true,
      });
      return true;
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      return false;
    } finally {
      setReserveCancelBusyId(null);
    }
  }

  function startPriceEdit(p: ProductRow) {
    if (!canEditMasterPricesInline) return;
    setEditingPriceId(p.id);
    setPriceDraft(String(Number(p.price)));
  }

  async function savePrice(p: ProductRow) {
    if (!canEditMasterPricesInline) return;
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

  function requestStockLocationChange(p: ProductRow, next: ProductStockLocation) {
    if (!canMutateProductRows) return;
    if (next === "service" && productMissingSerials(p)) {
      setServiceSerialIndoor("");
      setServiceSerialOutdoor("");
      setServiceSerialPromptFor(p);
      return;
    }
    void patchStockLocation(p.id, next);
  }

  async function patchStockLocation(
    productId: string,
    next: ProductStockLocation,
    serials?: { indoor: string; outdoor: string },
  ) {
    setError(null);
    setLocationBusyId(productId);
    try {
      const body: Record<string, unknown> = { stockLocation: next };
      if (serials?.indoor.trim()) body.indoorUnitSerial = serials.indoor.trim();
      if (serials?.outdoor.trim()) body.outdoorUnitSerial = serials.outdoor.trim();
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as any).error || "Грешка при смяна на място");
      const norm = normalizeProductStockLocation(next);
      setItems((prev) =>
        prev.map((x) =>
          x.id === productId
            ? {
                ...x,
                stock_location: norm,
                ...(serials?.indoor.trim() ? { indoor_unit_serial: serials.indoor.trim() } : {}),
                ...(serials?.outdoor.trim() ? { outdoor_unit_serial: serials.outdoor.trim() } : {}),
              }
            : x,
        ),
      );
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLocationBusyId(null);
    }
  }

  function startPurchaseEdit(p: ProductRow) {
    if (!canEditMasterPricesInline) return;
    setEditingPurchaseId(p.id);
    const pp = p.purchase_price;
    setPurchaseDraft(pp == null || !Number.isFinite(Number(pp)) ? "" : String(Number(pp)));
  }

  async function savePurchasePrice(p: ProductRow) {
    if (!canEditMasterPricesInline) return;
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

  const listPages = Math.max(1, Math.ceil(totalCount / ADMIN_PRODUCTS_LIST_PER_PAGE));
  const usedOnlyFilter = conditions.length === 1 && conditions[0] === "used";
  const catalogEmptyMessage =
    items.length === 0
      ? usedOnlyFilter
        ? "Няма налични или по поръчка климатици втора употреба. Продадените единици са в Продажби."
        : "Няма намерени артикули."
      : "Няма видими артикули в този изглед.";
  const catalogEmptyMessageMobile =
    items.length === 0
      ? usedOnlyFilter
        ? "Няма налични употребявани климатици. Продадените — в Продажби."
        : "Няма намерени продукти."
      : "Няма видими продукти в този изглед.";
  const showScrappedInList = stockStatuses.includes("scrapped");
  const catalogVisibleItems = useMemo(
    () => filterProductsCatalogItems(items, { showScrapped: showScrappedInList }),
    [items, showScrappedInList],
  );
  const displayRows = useMemo(() => buildProductCatalogDisplayRows(catalogVisibleItems), [catalogVisibleItems]);
  const selectableDisplayIds = useMemo(
    () => displayRows.filter(isGroupedExhaustedSelectable).map((d) => d.row.id),
    [displayRows],
  );

  // Списък с активни филтри — ползва се за брояча и за chip bar-а.
  const supplierName = supplierId ? suppliersById[supplierId] : null;
  const brandName = brandId ? brands.find((b) => b.id === brandId)?.name : null;
  const typeName = typeId ? types.find((t) => t.id === typeId)?.name : null;
  const containerName = containerId ? containers.find((c) => c.id === containerId)?.name : null;

  const activeFilters: ActiveFilterChip[] = [];
  if (q.trim()) {
    activeFilters.push({
      key: "q",
      label: `Търсене: „${q.trim()}“`,
      onClear: () => {
        setQ("");
      },
    });
  }
  if (catalogKind !== "climatics") {
    activeFilters.push({
      key: "catalogKind",
      label: catalogKind === "accessories" ? "Само аксесоари" : "Климатици и аксесоари",
      onClear: () => setCatalogKind("climatics"),
    });
  }
  for (const c of conditions) {
    activeFilters.push({
      key: `condition-${c}`,
      label: `Състояние: ${c === "new" ? "Нови" : "Втора употреба"}`,
      onClear: () => setConditions((prev) => prev.filter((x) => x !== c)),
    });
  }
  for (const flag of featuredFlags) {
    activeFilters.push({
      key: `featured-${flag}`,
      label: flag === "featured" ? "Топ продукти" : "Без топ",
      onClear: () => setFeaturedFlags((prev) => prev.filter((x) => x !== flag)),
    });
  }
  for (const flag of publicCatalogFlags) {
    activeFilters.push({
      key: `publicCatalog-${flag}`,
      label: flag === "visible" ? "В публичен каталог" : "Скрит от каталог",
      onClear: () => setPublicCatalogFlags((prev) => prev.filter((x) => x !== flag)),
    });
  }
  for (const status of stockStatuses) {
    const label =
      status === "in_stock"
        ? "В наличност"
        : status === "on_order"
          ? "По поръчка"
          : status === "reserved"
            ? "Резервиран"
            : status === "scrapped"
              ? "Бракуван"
              : status;
    activeFilters.push({
      key: `stockStatus-${status}`,
      label: `Наличност: ${label}`,
      onClear: () => setStockStatuses((prev) => prev.filter((x) => x !== status)),
    });
  }
  if (stockLocationFilter) {
    activeFilters.push({
      key: "stockLocation",
      label: `Място: ${productStockLocationLabelCompact(stockLocationFilter)}`,
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
  for (const btu of btuFilters) {
    activeFilters.push({
      key: `btu-${btu}`,
      label: `BTU: ${btu} 000`,
      onClear: () => setBtuFilters((prev) => prev.filter((x) => x !== btu)),
    });
  }
  if (typeId) activeFilters.push({ key: "type", label: `Тип: ${typeName ?? "—"}`, onClear: () => setTypeId("") });
  if (supplierId) activeFilters.push({ key: "supplier", label: `Доставчик: ${supplierName ?? "—"}`, onClear: () => setSupplierId("") });
  if (containerId) activeFilters.push({ key: "container", label: `Контейнер: ${containerName ?? "—"}`, onClear: () => setContainerId("") });
  if (isAdminPriceFilterActive(priceRange)) {
    activeFilters.push({
      key: "price",
      label: `Цена: ${formatAdminPriceEuro(priceRange[0])} – ${formatAdminPriceEuro(priceRange[1])} €`,
      onClear: () => setPriceRange([ADMIN_PRICE_FILTER_MIN, ADMIN_PRICE_FILTER_MAX]),
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
    <div className="w-full space-y-2.5 md:space-y-3">
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
          {!canMutateProductRows && (
            <p className="mt-1.5 text-[11px] text-slate-600 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 inline-block max-w-2xl">
              <strong>Сервизен преглед:</strong> вижте списъка и детайлите от името; можете да добавяте нов продукт. Редакция, продажба и изтриване са само за офис / главен администратор.
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(canEditMasterPricesInline || adminRole === "service_staff") && (
            <button
              type="button"
              onClick={() => setCatalogSettingsOpen(true)}
              className="inline-flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 transition-colors shadow-sm"
              title={canEditMasterPricesInline ? "Настройки на каталога" : "Настройки на каталога (преглед)"}
              aria-label="Настройки на каталога"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}
          <Link
            href="/admin/products/new"
            className="inline-flex items-center gap-2 bg-brand-blue-600 text-white px-3 py-2 md:px-4 rounded-xl font-semibold hover:bg-brand-blue-700 transition-colors shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Нов климатик</span>
            <span className="sm:hidden">Климатик</span>
          </Link>
          <Link
            href="/admin/accessories/new"
            className="inline-flex items-center gap-2 bg-brand-orange-500 text-white px-3 py-2 md:px-4 rounded-xl font-semibold hover:bg-brand-orange-600 active:bg-brand-orange-700 transition-colors shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Нов аксесоар</span>
            <span className="sm:hidden">Аксесоар</span>
          </Link>
        </div>
      </div>

      <ProductCatalogSettingsModal
        open={catalogSettingsOpen}
        onClose={() => setCatalogSettingsOpen(false)}
        onApplied={() => void load()}
        readOnly={!canEditMasterPricesInline}
      />

      {/* Mobile: search + filter toggle row */}
      <div className="flex gap-1.5 md:hidden">
        <div className="flex-1 min-w-0">
          <ProductSearchBox
            value={q}
            onChange={(next) => { setQ(next); }}
            items={catalogVisibleItems}
            placeholder="Търси име, сериен №, фактура…"
          />
        </div>
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-bold text-xs shrink-0 transition-colors ${filtersOpen ? "bg-brand-blue-50 border-brand-blue-200 text-brand-blue-700" : "bg-white border-slate-200 text-slate-700"}`}
        >
          <Filter className="w-4 h-4" />
          {activeFiltersCount > 0 && (
            <span className="bg-brand-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{activeFiltersCount}</span>
          )}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtersOpen ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div className="md:hidden space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-slate-500 tabular-nums">
            Намерени: <span className="text-slate-900">{totalCount}</span>
          </span>
          {activeFiltersCount > 0 ? (
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800"
            >
              <FilterX className="w-3 h-3" />
              Изчисти ({activeFiltersCount})
            </button>
          ) : null}
        </div>
      </div>

      {/* Filters card — always visible on desktop, toggleable on mobile */}
      <Card className={`p-2.5 md:p-4 ${filtersOpen ? "block" : "hidden"} md:block space-y-2.5 md:space-y-4 rounded-lg md:rounded-xl shadow-sm`}>
        {/* Row 1: търсене + общ брояч + reset */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
          <div className="flex-1 hidden md:block min-w-0">
            <ProductSearchBox
              value={q}
              onChange={(next) => { setQ(next); }}
              items={catalogVisibleItems}
              placeholder="Търси по име, slug, сериен номер (вътрешен/външен) или № на фактура от доставчик…"
            />
          </div>
          <div className="flex items-center justify-between gap-2 w-full sm:w-auto sm:ml-auto sm:justify-end flex-wrap">
            <span className="text-[10px] md:text-xs font-semibold text-slate-500 tabular-nums">
              Намерени: <span className="text-slate-900">{totalCount}</span>
            </span>
            {activeFiltersCount > 0 && (
              <Button variant="secondary" size="sm" onClick={resetFilters} title="Изчисти всички филтри" className="gap-1 !py-1 !px-2 !text-[11px] md:!text-xs md:!py-1.5 md:!px-2.5">
                <FilterX className="w-3 h-3 md:w-3.5 md:h-3.5 text-slate-500 shrink-0" /> Изчисти ({activeFiltersCount})
              </Button>
            )}
          </div>
        </div>

        {/* Бързи филтри: състояние + наличност в каталога — обединени на
            един ред с малки prefix-етикети. На малки екрани групите се
            пренареждат естествено във wrap. */}
        <div className="space-y-1.5 md:space-y-2">
          <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-500">Бързи филтри</div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 md:gap-x-4 md:gap-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mr-0.5">Състояние:</span>
              <ChipToggle active={conditions.length === 0} onClick={() => { setConditions([]); }}>Всички</ChipToggle>
              <ChipToggle
                active={conditions.includes("new")}
                onClick={() => { setConditions((prev) => toggleChipFilter(prev, "new")); }}
              >
                Нови
              </ChipToggle>
              <ChipToggle
                active={conditions.includes("used")}
                onClick={() => { setConditions((prev) => toggleChipFilter(prev, "used")); }}
              >
                Втора употреба
              </ChipToggle>
            </div>
            <span className="hidden md:inline-block h-5 w-px bg-slate-200" aria-hidden />
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mr-0.5">Наличност:</span>
              <ChipToggle active={stockStatuses.length === 0} onClick={() => { setStockStatuses([]); }}>Всички</ChipToggle>
              <ChipToggle
                active={stockStatuses.includes("in_stock")}
                tone="success"
                onClick={() => { setStockStatuses((prev) => toggleChipFilter(prev, "in_stock")); }}
              >
                <PackageCheck className="w-3 h-3" /> В наличност
              </ChipToggle>
              <ChipToggle
                active={stockStatuses.includes("on_order")}
                tone="warning"
                onClick={() => { setStockStatuses((prev) => toggleChipFilter(prev, "on_order")); }}
              >
                <Clock4 className="w-3 h-3" /> По поръчка
              </ChipToggle>
              <ChipToggle
                active={stockStatuses.includes("reserved")}
                tone="brand"
                onClick={() => { setStockStatuses((prev) => toggleChipFilter(prev, "reserved")); }}
              >
                <Bookmark className="w-3 h-3" /> Резервиран
              </ChipToggle>
              <ChipToggle
                active={stockStatuses.includes("scrapped")}
                tone="neutral"
                onClick={() => { setStockStatuses((prev) => toggleChipFilter(prev, "scrapped")); }}
              >
                <Ban className="w-3 h-3" /> Бракувани
              </ChipToggle>
              <span className="hidden md:inline-block h-5 w-px bg-slate-200 mx-0.5" aria-hidden />
              <ChipToggle
                active={featuredFlags.includes("featured")}
                tone="brand"
                onClick={() => { setFeaturedFlags((prev) => toggleChipFilter(prev, "featured")); }}
              >
                <Star className="w-3 h-3 fill-current" /> Топ продукти
              </ChipToggle>
              <ChipToggle
                active={publicCatalogFlags.includes("visible")}
                tone="brand"
                onClick={() => { setPublicCatalogFlags((prev) => toggleChipFilter(prev, "visible")); }}
              >
                <Eye className="w-3 h-3" /> В публичен каталог
              </ChipToggle>
            </div>
          </div>
        </div>

        {/* Мощност (BTU) */}
        <div className="space-y-1.5 md:space-y-2">
          <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-500">Мощност (BTU)</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <ChipToggle active={btuFilters.length === 0} onClick={() => { setBtuFilters([]); }}>
              Всички
            </ChipToggle>
            {CATALOG_BTU_OPTIONS.map((btu) => (
              <span key={btu} title={`${btu * 1000} BTU`} className="inline-flex">
                <ChipToggle
                  active={btuFilters.includes(String(btu))}
                  onClick={() => {
                    setBtuFilters((prev) => toggleChipFilter(prev, String(btu)));
                  }}
                >
                  {btu}
                </ChipToggle>
              </span>
            ))}
          </div>
        </div>

        {/* Класификация: марка / тип / доставчик / място / страна */}
        <div className="space-y-1.5 md:space-y-2">
          <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-500">Класификация</div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-1.5 md:gap-3 [&_select]:text-xs md:[&_select]:text-sm">
            <Select
              value={catalogKind}
              onChange={(e) => { setCatalogKind(e.target.value as CatalogKindFilter); }}
            >
              <option value="climatics">Климатици</option>
              <option value="accessories">Аксесоари</option>
              <option value="all">Всички</option>
            </Select>
            <Select value={brandId} onChange={(e) => { setBrandId(e.target.value); }}>
              <option value="">Марка: всички</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
            <Select value={typeId} onChange={(e) => { setTypeId(e.target.value); }}>
              <option value="">Тип: всички</option>
              {types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </Select>
            <Select value={supplierId} onChange={(e) => { setSupplierId(e.target.value); }}>
              <option value="">Доставчик: всички</option>
              {Object.entries(suppliersById)
                .sort((a, b) => a[1].localeCompare(b[1], "bg"))
                .map(([id, name]) => (
                  <option key={id} value={id}>{name}</option>
                ))}
            </Select>
            <Select value={containerId} onChange={(e) => { setContainerId(e.target.value); }}>
              <option value="">Контейнер: всички</option>
              {containers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select value={stockLocationFilter} onChange={(e) => { setStockLocationFilter(e.target.value as "" | ProductStockLocation); }}>
              <option value="">Място: всички</option>
              <option value="showroom">В магазин</option>
              <option value="warehouse">В склада</option>
              <option value="service">В сервиз</option>
            </Select>
            <Select value={productRegionFilter} onChange={(e) => { setProductRegionFilter(e.target.value as "" | ProductRegion); }}>
              <option value="">Страна: всички</option>
              <option value="europe">EUROPE</option>
              <option value="japan">JAPAN</option>
            </Select>
          </div>
        </div>

        {/* Цена — първи ред; период и критерии — втори ред (4 колони). */}
        <div className="space-y-1.5 md:space-y-2">
          <div className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-500 leading-snug">
            Цена, период и критерии
          </div>
          <div className="max-w-md">
            <PriceRangeSlider
              value={priceRange}
              onChange={(next) => {
                setPriceRange(next);
              }}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 md:gap-3 [&_input]:!text-xs md:[&_input]:!text-sm [&_select]:text-xs md:[&_select]:text-sm">
            <div className="relative">
              <span className="pointer-events-none absolute top-1 left-3 text-[9px] font-bold uppercase tracking-wide text-slate-500">Закупен от</span>
              <Input
                type="date"
                value={purchasedFrom}
                onChange={(e) => { setPurchasedFrom(e.target.value); }}
                max={purchasedTo || undefined}
                className="!pt-4 !pb-1.5 !text-xs"
              />
            </div>
            <div className="relative">
              <span className="pointer-events-none absolute top-1 left-3 text-[9px] font-bold uppercase tracking-wide text-slate-500">Закупен до</span>
              <Input
                type="date"
                value={purchasedTo}
                onChange={(e) => { setPurchasedTo(e.target.value); }}
                min={purchasedFrom || undefined}
                className="!pt-4 !pb-1.5 !text-xs"
              />
            </div>
            <Select value={hasSerial} onChange={(e) => { setHasSerial(e.target.value as "" | "with" | "without"); }}>
              <option value="">Сериен №: всички</option>
              <option value="with">Само със сериен №</option>
              <option value="without">Само без сериен №</option>
            </Select>
            <Select value={hasPurchasePrice} onChange={(e) => { setHasPurchasePrice(e.target.value as "" | "with" | "without"); }}>
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

      </Card>

      {/* Bulk actions — видимост в каталога + изтриване */}
      {canMutateProductRows && selected.length > 0 && (
        <div className="bg-brand-blue-50 border border-brand-blue-200 rounded-lg md:rounded-xl px-2.5 py-2 md:px-3 md:py-2.5 flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[11px] md:text-sm font-bold text-brand-blue-700">
            Избрани: {selected.length}{" "}
            <span className="font-normal text-brand-blue-600/80 hidden sm:inline">
              {catalogKind === "accessories"
                ? "(за останалите промени отвори картата на аксесоара)"
                : "(за останалите промени отвори картата на артикула)"}
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
            <Button variant="secondary" size="sm" onClick={() => void bulkSetPublicCatalog(true)} className="gap-1 !py-1.5">
              <Eye className="w-3.5 h-3.5" /> Видими в каталога
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void bulkSetPublicCatalog(false)} className="gap-1 !py-1.5">
              <EyeOff className="w-3.5 h-3.5" /> Скрити от каталога
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void bulkDelete()}
              className="gap-1 !py-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Изтрий избраните
            </Button>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

      {/* Desktop table — компактна, table-fixed за ширина на екрана */}
      <div className="hidden md:block rounded-xl border border-slate-200 bg-white shadow-sm max-w-full overflow-hidden">
        <ActiveFilterChipsBar
          filters={activeFilters}
          onClearAll={resetFilters}
          compact
          className="px-3 py-2 border-b border-brand-blue-100 bg-brand-blue-50/40 rounded-none"
        />
        <Table
          className="border-0 rounded-none shadow-none bg-transparent w-full table-fixed [&_th]:!px-1 [&_th]:!py-1 [&_th]:!text-[10px] [&_td]:!px-1 [&_td]:!py-0.5 [&_td]:!text-[11px] [&_td]:leading-tight"
          stickyHeader
        >
          <colgroup>
            {canMutateProductRows && <col className="w-[2%]" />}
            <col className="w-[11%]" />
            <col className="w-[2%]" />
            <col className="w-[2%]" />
            <col className="w-[6%]" />
            <col className="w-[5%]" />
            <col className="w-[4%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[4%]" />
            <col className="w-[4%]" />
            <col className="w-[7%]" />
            <col className="w-[4%]" />
            <col className="w-[3.5%]" />
            <col className="w-[4%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead className="[&>tr>th]:sticky [&>tr>th]:top-0 [&>tr>th]:z-40 [&>tr>th]:align-middle [&>tr>th]:!bg-slate-50 [&>tr>th]:shadow-[0_1px_0_0_rgb(226,232,240)]">
            <tr>
              {canMutateProductRows && (
              <Th className="text-center align-middle !px-0.5">
                <span className="inline-flex w-full justify-center">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand-blue-500 focus:ring-brand-blue-500"
                    checked={selectableDisplayIds.length > 0 && selectableDisplayIds.every((id) => selected.includes(id))}
                    onChange={(e) => setSelected(e.target.checked ? selectableDisplayIds : [])}
                  />
                </span>
              </Th>
              )}
              <SortableTh label="Име" field="name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} center />
              <Th className="text-center !px-0" title="Линк към доставчик">
                <ExternalLink className="w-3 h-3 opacity-70 mx-auto" />
              </Th>
              <Th className="text-center !px-0" title="Публичен каталог">
                <Eye className="w-3 h-3 opacity-70 mx-auto" />
              </Th>
              <Th className="text-center">Статус</Th>
              <Th className="text-center">Марка</Th>
              <SortableTh label="Състояние" field="product_condition" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} center />
              <Th className="text-center">Тип</Th>
              <SortableTh label="Закупна" field="purchase_price" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} center />
              <SortableTh label="Дата" field="purchased_at" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} center />
              <SortableTh label="Продажна" field="price" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} center />
              <Th className="text-center">Доставчик</Th>
              <Th className="text-center" title="Фактура доставчик">Фактура</Th>
              <Th className="text-center">Рег.</Th>
              <SortableTh label="Място" field="stock_location" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} center />
              <Th className="text-center">Действия</Th>
            </tr>
          </thead>
          <tbody className="[&>tr>td]:align-middle">
            {!loading && displayRows.map(({ row: p, groupKey, groupedCount, isGroupedExhausted }) => {
              const groupedExhausted = isGroupedExhausted && groupedCount > 1;
              return (
              <tr key={groupKey} className="hover:bg-slate-50 transition-colors group">
                {canMutateProductRows && (
                <Td className="text-center align-middle whitespace-nowrap">
                  <span className="inline-flex w-full justify-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-brand-blue-500 focus:ring-brand-blue-500 disabled:opacity-40"
                      checked={selected.includes(p.id)}
                      disabled={groupedExhausted}
                      title={groupedExhausted ? `${groupedCount} изчерпани единици — изберете от пълния запис` : undefined}
                      onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id))}
                    />
                  </span>
                </Td>
                )}
                <Td className="font-semibold text-slate-900 text-center !align-top min-w-0 whitespace-normal">
                  <div className="flex justify-center min-w-0">
                    <CatalogItemQuickViewButton
                      catalogItem={isAccessoryRow(p) ? "accessory" : "product"}
                      itemId={p.id}
                      itemName={p.name}
                      className="block whitespace-normal text-center leading-tight text-[11px] line-clamp-2 break-words font-semibold"
                    />
                  </div>
                </Td>
                <Td className="text-center align-middle whitespace-nowrap !px-0">
                  {p.source_url ? (
                    <a
                      href={p.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Отвори при доставчика"
                      className="inline-flex items-center justify-center p-0.5 rounded hover:bg-slate-100 text-slate-400 hover:text-brand-blue-600 transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : null}
                </Td>
                <Td className="text-center align-middle whitespace-nowrap !px-0">
                  {(() => {
                    const catalogVisible = isAccessoryRow(p)
                      ? Boolean(p.is_active ?? p.show_in_public_catalog)
                      : Boolean(p.show_in_public_catalog);
                    if (canMutateProductRows) {
                      return (
                        <button
                          type="button"
                          onClick={() => void togglePublicCatalog(p)}
                          className="inline-flex items-center justify-center p-0.5 rounded hover:bg-slate-100"
                          title={
                            catalogVisible
                              ? "Видим в публичния каталог — клик за скриване"
                              : "Скрит от публичния каталог — клик за показване"
                          }
                        >
                          {catalogVisible ? (
                            <Eye className="w-3.5 h-3.5 text-sky-600" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                          )}
                        </button>
                      );
                    }
                    return catalogVisible ? (
                      <Eye className="w-3.5 h-3.5 text-sky-600 inline-block" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-400 inline-block" />
                    );
                  })()}
                </Td>
                <Td className="text-center align-middle whitespace-nowrap">
                  <span className="inline-flex items-center justify-center gap-0.5">
                    <span
                      className={`inline-flex items-center px-1 py-px rounded text-[10px] font-bold leading-none ${catalogStockBadgeClass(p.stock_status)}`}
                    >
                      {catalogStockBadgeText(p.stock_status, true)}
                    </span>
                    {groupedExhausted && (
                      <span
                        className="inline-flex items-center px-1 py-px rounded text-[9px] font-bold text-slate-600 bg-slate-100 leading-none"
                        title={`${groupedCount} продадени единици с този модел`}
                      >
                        ×{groupedCount}
                      </span>
                    )}
                  </span>
                </Td>
                <Td className="text-center align-middle min-w-0 truncate whitespace-nowrap" title={p.brands?.name ?? undefined}>
                  {p.brands?.name ?? "—"}
                </Td>
                <Td className="text-center align-middle whitespace-nowrap">
                  {isAccessoryRow(p) ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <span
                      className={`inline-flex shrink-0 items-center justify-center px-1 py-px rounded text-[10px] font-medium leading-none ${
                        p.product_condition === "used" ? "bg-brand-orange-100 text-brand-orange-700" : "bg-brand-blue-100 text-brand-blue-700"
                      }`}
                    >
                      {p.product_condition === "used" ? "Употребяван" : "Нов"}
                    </span>
                  )}
                </Td>
                <Td className="text-center align-middle min-w-0 truncate whitespace-nowrap" title={p.product_types?.name ?? undefined}>
                  {p.product_types?.name ?? "—"}
                </Td>
                <Td
                  className={`text-center align-middle min-w-0 tabular-nums ${
                    editingPurchaseId === p.id && canEditMasterPricesInline ? "whitespace-normal" : "whitespace-nowrap"
                  }`}
                >
                  {isAccessoryRow(p) ? (
                    <span className="text-slate-400">—</span>
                  ) : editingPurchaseId === p.id && canEditMasterPricesInline ? (
                    <div className="flex flex-col gap-0.5 min-w-[5rem] mx-auto items-center">
                      <Input
                        type="number"
                        min={0}
                        value={purchaseDraft}
                        onChange={(e) => setPurchaseDraft(e.target.value)}
                        className="!text-xs !py-1 text-center"
                        autoFocus
                        placeholder="—"
                      />
                      <div className="flex gap-1 justify-center">
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
                  ) : canEditMasterPricesInline ? (
                    <button
                      type="button"
                      onClick={() => startPurchaseEdit(p)}
                      className="rounded px-1 py-0.5 font-semibold text-slate-900 bg-brand-orange-50/60 hover:bg-brand-orange-100 hover:text-brand-orange-700 focus:outline-none focus:ring-1 focus:ring-brand-orange-300 cursor-pointer tabular-nums"
                      title="Клик за редакция на закупна цена"
                    >
                      {fmtEuro(p.purchase_price)}
                    </button>
                  ) : (
                    <span
                      className="inline-block rounded px-1 py-0.5 font-semibold text-slate-900 tabular-nums"
                      title="Само главен администратор може да променя закупната цена тук"
                    >
                      {fmtEuro(p.purchase_price)}
                    </span>
                  )}
                </Td>
                {/* Дата на закупуване от доставчик — редактира се от формата на продукта. */}
                <Td className="whitespace-nowrap text-[10px] text-slate-600 text-center align-middle tabular-nums">
                  {isAccessoryRow(p) ? "—" : fmtPurchaseDate(p.purchased_at)}
                </Td>
                <Td
                  className={`font-semibold text-center align-middle min-w-0 tabular-nums ${
                    editingPriceId === p.id && canEditMasterPricesInline && !isAccessoryRow(p) ? "whitespace-normal" : "whitespace-nowrap"
                  }`}
                >
                  {isAccessoryRow(p) ? (
                    <span className="inline-block rounded px-1 py-0.5 text-slate-900 tabular-nums">{fmtEuro(p.price)}</span>
                  ) : editingPriceId === p.id && canEditMasterPricesInline ? (
                    <div className="flex flex-col gap-0.5 min-w-[5rem] mx-auto items-center">
                      <Input type="number" min={0} value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} className="!text-xs !py-1 text-center" autoFocus />
                      <div className="flex gap-1 justify-center">
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
                  ) : canEditMasterPricesInline ? (
                    <button
                      type="button"
                      onClick={() => startPriceEdit(p)}
                      className="rounded px-1 py-0.5 text-slate-900 bg-brand-blue-50/60 hover:bg-brand-blue-100 hover:text-brand-blue-700 focus:outline-none focus:ring-1 focus:ring-brand-blue-300 cursor-pointer tabular-nums"
                      title="Клик за редакция на продажна цена"
                    >
                      {fmtEuro(p.price)}
                    </button>
                  ) : (
                    <span className="inline-block rounded px-1 py-0.5 text-slate-900 tabular-nums" title="Само главен администратор може да променя продажната цена тук">
                      {fmtEuro(p.price)}
                    </span>
                  )}
                </Td>
                <Td className="text-center align-middle min-w-0 truncate whitespace-nowrap" title={isAccessoryRow(p) ? undefined : supplierLabel(p)}>
                  <span className="block truncate">{isAccessoryRow(p) ? "—" : supplierLabel(p)}</span>
                  {!isAccessoryRow(p) && containerLabel(p) && (
                    <span className="block truncate text-[9px] font-semibold text-brand-blue-600" title={containerLabel(p) ?? undefined}>
                      {containerLabel(p)}
                    </span>
                  )}
                </Td>
                <Td
                  className="text-[10px] text-slate-700 text-center align-middle truncate"
                  title={
                    !isAccessoryRow(p) && productShowsSupplierInvoice(p.stock_status)
                      ? (p.supplier_invoice_number ?? "").trim() || undefined
                      : undefined
                  }
                >
                  {isAccessoryRow(p) || !productShowsSupplierInvoice(p.stock_status)
                    ? "—"
                    : truncCell(p.supplier_invoice_number, 8)}
                </Td>
                <Td className="text-center align-middle whitespace-nowrap">
                  <span className="inline-flex items-center px-1 py-px rounded text-[10px] font-bold text-slate-700 bg-slate-100 leading-none">
                    {isAccessoryRow(p) ? "—" : productRegionLabel(p.product_region)}
                  </span>
                </Td>
                <Td className="text-center align-middle whitespace-nowrap">
                  {isAccessoryRow(p) ? (
                    <span className="text-slate-400 text-[10px]">—</span>
                  ) : (
                    <StockLocationCell
                      productId={p.id}
                      stockLocation={p.stock_location}
                      canEdit={canMutateProductRows}
                      busy={locationBusyId === p.id}
                      onConfirmChange={(next) => requestStockLocationChange(p, next)}
                    />
                  )}
                </Td>
                <Td className="text-center align-middle whitespace-nowrap !px-0.5">
                  {isAccessoryRow(p) ? (
                    <span className="text-[10px] text-slate-500 font-medium">Аксесоар</span>
                  ) : canMutateProductRows ? (
                  <div className="flex flex-nowrap items-center justify-center gap-1 min-w-0">
                    {!isProductReserved(p) && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          if (p.stock_status === "on_order") {
                            setOrderFor(p);
                            return;
                          }
                          setSaleFor(p);
                          setSaleForm(saleModalFormForProduct(p));
                          setSaleSerialIndoor("");
                          setSaleSerialOutdoor("");
                          setContactQuery("");
                          setContactResults([]);
                        }}
                        disabled={!canRecordSale(p)}
                        className={`!p-1 shrink-0 ${p.stock_status === "on_order" ? "!text-violet-700 !border-violet-300 !bg-violet-50 hover:!bg-violet-100" : ""}`}
                        title={p.stock_status === "on_order" ? "Поръчай от доставчик" : saleButtonTitle(p)}
                      >
                        {p.stock_status === "on_order" ? <Truck className="w-3 h-3" /> : <PackageCheck className="w-3 h-3" />}
                      </Button>
                    )}
                    <Link
                      href={catalogEditHref(p)}
                      className={`${PRODUCT_ROW_EDIT_BTN} bg-brand-blue-50 text-brand-blue-700 border-brand-blue-200 hover:bg-brand-blue-100 focus:ring-brand-blue-200`}
                      title="Редакция"
                    >
                      <Edit className={PRODUCT_ROW_EDIT_ICON} />
                    </Link>
                    {!isAccessoryRow(p) && (
                      <button
                        type="button"
                        disabled={!canProductServiceProtocol(p) || serviceProtocolBusyId === p.id}
                        onClick={() => void openServiceProtocol(p)}
                        title={serviceProtocolButtonTitle(p, repairProtocolByProductId[p.id])}
                        className={serviceProtocolButtonClass(p, repairProtocolByProductId[p.id], "icon")}
                      >
                        {serviceProtocolBusyId === p.id
                          ? <Loader2 className={`${PRODUCT_ROW_ICON} animate-spin`} />
                          : <Wrench className={PRODUCT_ROW_ICON} />}
                      </button>
                    )}
                    {isProductReserved(p) ? (
                      <button
                        type="button"
                        onClick={() => void cancelProductReservation(p)}
                        disabled={reserveCancelBusyId === p.id}
                        className={`${PRODUCT_ROW_ICON_BTN} bg-white text-sky-800 border-sky-300 hover:bg-sky-50 focus:ring-sky-200`}
                        title="Отмени резервацията"
                      >
                        <BookmarkX className={PRODUCT_ROW_ICON} />
                      </button>
                    ) : (
                      canReserveProduct(p) && (
                        <button
                          type="button"
                          onClick={() => setReserveFor(p)}
                          className={`${PRODUCT_ROW_ICON_BTN} bg-white text-sky-800 border-sky-300 hover:bg-sky-50 focus:ring-sky-200`}
                          title="Резервирай за клиент"
                        >
                          <Bookmark className={PRODUCT_ROW_ICON} />
                        </button>
                      )
                    )}
                    <button
                      type="button"
                      onClick={() => setShareProduct(p)}
                      title="Сподели в чат"
                      className={`${PRODUCT_ROW_ICON_BTN} bg-white text-brand-orange-600 border-orange-200 hover:bg-orange-50 focus:ring-orange-200`}
                    >
                      <MessageCircle className={PRODUCT_ROW_ICON} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFeaturedFor(p)}
                      title={
                        p.featured_position
                          ? `Топ продукти — позиция #${p.featured_position}`
                          : "Постави в Топ продукти на главната страница"
                      }
                      className={`${PRODUCT_ROW_ICON_BTN} ${
                        p.featured_position
                          ? "bg-amber-100 text-amber-700 border-amber-300 hover:bg-amber-200 focus:ring-amber-200"
                          : "bg-white text-slate-500 border-slate-300 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 focus:ring-amber-200"
                      }`}
                    >
                      <Star className={`${PRODUCT_ROW_ICON} ${p.featured_position ? "fill-current" : ""}`} />
                    </button>
                  </div>
                  ) : (
                    <span className="text-xs text-slate-400">Преглед</span>
                  )}
                </Td>
              </tr>
            );
            })}
            {!loading && displayRows.length === 0 && (
              <tr><Td colSpan={canMutateProductRows ? 15 : 14} className="text-center py-8 text-slate-500">{catalogEmptyMessage}</Td></tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Mobile: компактен списък (PWA / телефон) */}
      <div className="md:hidden space-y-1.5">
        <ActiveFilterChipsBar
          filters={activeFilters}
          onClearAll={resetFilters}
          compact
        />
        {/* Mobile sort controls */}
        <div className="flex items-center gap-2">
          <Select
            value={`${sortBy}:${sortDir}`}
            onChange={(e) => {
              const [field, dir] = e.target.value.split(":");
              setSortBy(field as SortField);
              setSortDir(dir as SortDir);
            }}
            className="flex-1 !text-xs"
          >
            <option value="name:asc">Название А→Я</option>
            <option value="name:desc">Название Я→А</option>
            <option value="price:asc">Продажна ↑</option>
            <option value="price:desc">Продажна ↓</option>
            <option value="purchase_price:asc">Закупна ↑</option>
            <option value="purchase_price:desc">Закупна ↓</option>
            <option value="purchased_at:desc">Дата ↓ (нови)</option>
            <option value="purchased_at:asc">Дата ↑ (стари)</option>
            <option value="stock_location:asc">Място А→Я</option>
            <option value="stock_location:desc">Място Я→А</option>
          </Select>
        </div>
        {loading && (
          <div className="text-center py-6 text-slate-500 text-xs">Зареждане...</div>
        )}
        {!loading && displayRows.length === 0 && (
          <div className="bg-white rounded-lg border border-slate-200 px-3 py-4 text-center text-slate-500 text-xs">
            {catalogEmptyMessageMobile}
          </div>
        )}
        {!loading && displayRows.map(({ row: p, groupKey, groupedCount, isGroupedExhausted }) => {
          const groupedExhausted = isGroupedExhausted && groupedCount > 1;
          return (
          <article
            key={groupKey}
            className="rounded-lg border border-slate-200 bg-white shadow-sm overflow-hidden active:bg-slate-50/90 transition-colors"
          >
            <div className="px-2.5 pt-2 pb-1.5 flex gap-2 items-start min-w-0">
              {canMutateProductRows && (
                <label className="flex items-center justify-center min-w-[44px] min-h-[44px] -ml-2 -mt-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="rounded border-slate-300 text-brand-blue-500 focus:ring-brand-blue-500 w-4 h-4 shrink-0 disabled:opacity-40"
                    checked={selected.includes(p.id)}
                    disabled={groupedExhausted}
                    title={groupedExhausted ? `${groupedCount} изчерпани единици — изберете от пълния запис` : undefined}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id),
                      )
                    }
                    aria-label="Избери за масово изтриване"
                  />
                </label>
              )}
              <div className="flex-1 min-w-0">
                <CatalogItemQuickViewButton
                  catalogItem={isAccessoryRow(p) ? "accessory" : "product"}
                  itemId={p.id}
                  itemName={p.name}
                  className="!text-[13px] !font-bold leading-snug line-clamp-2"
                />
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  <span
                    className={`inline-flex items-center px-1 py-px rounded text-[10px] font-bold ${
                      p.product_condition === "used"
                        ? "bg-brand-orange-100 text-brand-orange-800"
                        : "bg-brand-blue-100 text-brand-blue-800"
                    }`}
                  >
                    {p.product_condition === "used" ? "Употребяван" : "Нов"}
                  </span>
                  <button
                    type="button"
                    onClick={() => canMutateProductRows && void togglePublicCatalog(p)}
                    className={`inline-flex items-center p-0.5 rounded ${canMutateProductRows ? "hover:bg-slate-100" : ""}`}
                    title={
                      (isAccessoryRow(p) ? p.is_active : p.show_in_public_catalog)
                        ? "Видим в каталога"
                        : "Скрит от каталога"
                    }
                    disabled={!canMutateProductRows}
                  >
                    {(isAccessoryRow(p) ? p.is_active : p.show_in_public_catalog) ? (
                      <Eye className="w-3.5 h-3.5 text-sky-600" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </button>
                  <span
                    className={`inline-flex items-center px-1 py-px rounded text-[10px] font-bold ${catalogStockBadgeClass(p.stock_status)}`}
                    title="Складов статус"
                  >
                    {catalogStockBadgeText(p.stock_status)}
                  </span>
                  {groupedExhausted && (
                    <span
                      className="inline-flex items-center px-1 py-px rounded text-[9px] font-bold text-slate-600 bg-slate-100"
                      title={`${groupedCount} продадени единици с този модел`}
                    >
                      ×{groupedCount}
                    </span>
                  )}
                  {p.is_active === false && (
                    <span className="inline-flex items-center px-1 py-px rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                      Скрит
                    </span>
                  )}
                  {p.model_code?.trim() && (
                    <span className="font-mono text-[10px] text-slate-600 truncate max-w-[9rem]" title={p.model_code}>
                      {p.model_code}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right w-[5.75rem] leading-tight space-y-1">
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400 leading-none">Продажна</div>
                  {editingPriceId === p.id && canEditMasterPricesInline ? (
                    <div className="mt-0.5 flex flex-col items-end gap-0.5">
                      <Input
                        type="number"
                        min={0}
                        value={priceDraft}
                        onChange={(e) => setPriceDraft(e.target.value)}
                        className="!py-1 !px-1.5 !text-xs w-full text-right"
                        autoFocus
                      />
                      <div className="flex gap-0.5">
                        <Button size="sm" onClick={() => void savePrice(p)} disabled={priceBusy} className="!py-0.5 !px-1.5 !text-[10px]">
                          OK
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingPriceId(null);
                            setPriceDraft("");
                          }}
                          disabled={priceBusy}
                          className="!py-0.5 !px-1.5 !text-[10px]"
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ) : canEditMasterPricesInline ? (
                    <button
                      type="button"
                      onClick={() => startPriceEdit(p)}
                      className="mt-0.5 text-sm font-black text-slate-900 tabular-nums rounded-md px-1.5 py-0.5 bg-brand-blue-50/80 hover:bg-brand-blue-100 w-full text-right"
                    >
                      {fmtEuro(p.price)}
                    </button>
                  ) : (
                    <div className="mt-0.5 text-sm font-black text-slate-900 tabular-nums" title="Само главен администратор може да променя продажната цена тук">
                      {fmtEuro(p.price)}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase tracking-wide text-slate-400 leading-none pt-0.5">Закупна</div>
                  {editingPurchaseId === p.id && canEditMasterPricesInline ? (
                    <div className="mt-0.5 flex flex-col items-end gap-0.5">
                      <Input
                        type="number"
                        min={0}
                        value={purchaseDraft}
                        onChange={(e) => setPurchaseDraft(e.target.value)}
                        className="!py-1 !px-1.5 !text-xs w-full text-right"
                        placeholder="—"
                      />
                      <div className="flex gap-0.5">
                        <Button size="sm" onClick={() => void savePurchasePrice(p)} disabled={purchaseBusy} className="!py-0.5 !px-1.5 !text-[10px]">
                          OK
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setEditingPurchaseId(null);
                            setPurchaseDraft("");
                          }}
                          disabled={purchaseBusy}
                          className="!py-0.5 !px-1.5 !text-[10px]"
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ) : canEditMasterPricesInline ? (
                    <button
                      type="button"
                      onClick={() => startPurchaseEdit(p)}
                      className="mt-0.5 text-xs font-bold text-slate-800 tabular-nums rounded-md px-1.5 py-0.5 bg-brand-orange-50/80 hover:bg-brand-orange-100 w-full text-right"
                    >
                      {fmtEuro(p.purchase_price)}
                    </button>
                  ) : (
                    <div className="mt-0.5 text-xs font-bold text-slate-800 tabular-nums" title="Само главен администратор може да променя закупната цена тук">
                      {fmtEuro(p.purchase_price)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="px-2.5 pb-1 text-[10px] text-slate-600 leading-snug border-b border-slate-100 flex flex-wrap gap-x-2 gap-y-0.5 items-baseline">
              {p.brands?.name && <span className="font-semibold text-slate-800 truncate max-w-[42%]">{p.brands.name}</span>}
              {p.product_types?.name && (
                <span className="text-slate-500 truncate max-w-[42%]" title={p.product_types.name}>
                  · {p.product_types.name}
                </span>
              )}
              <span className="text-slate-500 shrink-0">· {productRegionLabel(p.product_region)}</span>
              <span className="text-slate-500 shrink-0">
                ·{" "}
                {isAccessoryRow(p) ? (
                  <span className="font-semibold text-slate-800">—</span>
                ) : (
                  <StockLocationCell
                    productId={p.id}
                    stockLocation={p.stock_location}
                    canEdit={canMutateProductRows}
                    busy={locationBusyId === p.id}
                    compact={false}
                    onConfirmChange={(next) => requestStockLocationChange(p, next)}
                  />
                )}
              </span>
              <span className="text-slate-400 shrink-0">· {fmtPurchaseDate(p.purchased_at)}</span>
            </div>

            <div className="px-2.5 py-1.5 grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px] text-slate-600">
              <div className="col-span-2 flex min-w-0 gap-1">
                <span className="text-slate-400 shrink-0">Доставчик</span>
                <span className="font-medium text-slate-800 truncate min-w-0" title={supplierLabel(p)}>
                  {supplierLabel(p)}
                </span>
              </div>
              {!isAccessoryRow(p) && containerLabel(p) && (
                <div className="col-span-2 flex min-w-0 gap-1">
                  <span className="text-slate-400 shrink-0">Контейнер</span>
                  <span className="font-medium text-brand-blue-700 truncate min-w-0">{containerLabel(p)}</span>
                </div>
              )}
              {!isAccessoryRow(p) && productShowsSupplierInvoice(p.stock_status) && (
              <div className="col-span-2 min-w-0">
                <span className="text-slate-400">Фактура </span>
                <span className="text-slate-900 break-all" title={(p.supplier_invoice_number ?? "").trim() || undefined}>
                  {truncCell(p.supplier_invoice_number, 36)}
                </span>
              </div>
              )}
            </div>

            {canMutateProductRows ? (
              <div className={`grid border-t border-slate-100 divide-x divide-slate-100 bg-slate-50/50 ${canReserveProduct(p) || isProductReserved(p) ? "grid-cols-5" : "grid-cols-4"}`}>
                {isProductReserved(p) ? (
                  <button
                    type="button"
                    disabled
                    title={saleButtonTitle(p)}
                    className="min-h-[44px] px-0.5 text-[10px] font-bold leading-tight text-slate-400 opacity-35"
                  >
                    Продажба
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (p.stock_status === "on_order") {
                        setOrderFor(p);
                        return;
                      }
                      setSaleFor(p);
                      setSaleForm(saleModalFormForProduct(p));
                      setSaleSerialIndoor("");
                      setSaleSerialOutdoor("");
                      setContactQuery("");
                      setContactResults([]);
                    }}
                    disabled={!canRecordSale(p)}
                    title={p.stock_status === "on_order" ? "Поръчай от доставчик" : saleButtonTitle(p)}
                    className={`min-h-[44px] px-0.5 text-[10px] font-bold leading-tight transition-colors disabled:opacity-35 ${p.stock_status === "on_order" ? "text-violet-700 hover:bg-violet-50 active:bg-violet-100" : "text-slate-800 hover:bg-white active:bg-slate-100"}`}
                  >
                    {p.stock_status === "on_order" ? "Поръчване" : "Продажба"}
                  </button>
                )}
                <Link
                  href={catalogEditHref(p)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[44px] text-xs font-bold text-brand-blue-700 hover:bg-white active:bg-brand-blue-50/60 min-w-0"
                  title="Редакция"
                >
                  <Edit className="w-3.5 h-3.5 shrink-0" />
                  <span className="leading-none">Ред.</span>
                </Link>
                {!isAccessoryRow(p) && (
                  <button
                    type="button"
                    disabled={!canProductServiceProtocol(p) || serviceProtocolBusyId === p.id}
                    onClick={() => void openServiceProtocol(p)}
                    title={serviceProtocolButtonTitle(p, repairProtocolByProductId[p.id])}
                    className={serviceProtocolButtonClass(p, repairProtocolByProductId[p.id], "mobile")}
                  >
                    {serviceProtocolBusyId === p.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Wrench className="w-3.5 h-3.5 shrink-0" />}
                    <span className="leading-none">Серв.</span>
                  </button>
                )}
                {isProductReserved(p) ? (
                  <button
                    type="button"
                    onClick={() => void cancelProductReservation(p)}
                    disabled={reserveCancelBusyId === p.id}
                    title="Отмени резервацията"
                    className="min-h-[44px] px-0.5 text-[10px] font-bold leading-tight text-sky-800 hover:bg-sky-50 active:bg-sky-100 disabled:opacity-35"
                  >
                    Отм. рез.
                  </button>
                ) : (
                  canReserveProduct(p) && (
                    <button
                      type="button"
                      onClick={() => setReserveFor(p)}
                      title="Резервирай за клиент"
                      className="min-h-[44px] px-0.5 text-[10px] font-bold leading-tight text-sky-800 hover:bg-sky-50 active:bg-sky-100"
                    >
                      Резерв.
                    </button>
                  )
                )}
                <button
                  type="button"
                  onClick={() => setShareProduct(p)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[44px] text-xs font-bold text-brand-orange-600 hover:bg-white active:bg-brand-orange-50/50 min-w-0"
                  title="Сподели в чат"
                >
                  <MessageCircle className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-[9px] font-bold leading-none">Чат</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFeaturedFor(p)}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[44px] text-xs min-w-0 ${
                    p.featured_position
                      ? "text-amber-800 bg-amber-50/80 hover:bg-amber-100"
                      : "text-slate-500 hover:bg-white hover:text-amber-700"
                  }`}
                  title={
                    p.featured_position
                      ? `Топ продукти — позиция #${p.featured_position}`
                      : "Постави в Топ продукти"
                  }
                >
                  <Star className={`w-3.5 h-3.5 shrink-0 ${p.featured_position ? "fill-current" : ""}`} />
                  <span className="text-[9px] font-bold leading-none">{p.featured_position ? `#${p.featured_position}` : "Топ"}</span>
                </button>
              </div>
            ) : (
              <div className="border-t border-slate-100 bg-slate-50/40">
                <Link
                  href={catalogEditHref(p)}
                  className="flex items-center justify-center min-h-[44px] text-center text-[11px] font-bold text-brand-blue-700 hover:bg-white transition-colors"
                >
                  {isAccessoryRow(p) ? "Пълен запис на аксесоара →" : "Пълен запис на продукта →"}
                </Link>
              </div>
            )}
          </article>
        );
        })}
      </div>

      <div className="pt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs md:text-sm text-slate-500 font-medium">
          <span>Общо: {totalCount}</span>
          {displayRows.length > 0 && (
            <span className="text-slate-400 tabular-nums ml-2">
              На страницата: {displayRows.length} реда
              {displayRows.length < catalogVisibleItems.length ? (
                <span className="text-slate-400"> ({catalogVisibleItems.length} артикула)</span>
              ) : null}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={loading || queryPage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ‹ Пред.
          </Button>
          <span className="text-xs md:text-sm font-medium text-slate-600 tabular-nums">
            {queryPage} / {listPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={loading || queryPage >= listPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Следв. ›
          </Button>
        </div>
      </div>

      {saleFor && (() => {
        const isClimateProduct = !isAccessoryRow(saleFor);
        const withInstallation = isClimateProduct && saleForm.includeMount;
        return (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/55 p-0 md:p-4 backdrop-blur-md"
        >
          <div
            className="w-full max-w-3xl max-h-[92dvh] md:max-h-[calc(100vh-2rem)] overflow-hidden rounded-t-3xl md:rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="border-b border-slate-100 px-4 py-4 md:px-6 md:py-5 shrink-0 flex items-start justify-between gap-3 bg-[radial-gradient(circle_at_top_left,#e6f9fd_0,#ffffff_42%,#fff3ed_100%)]">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand-blue-700">Запис на продажба</div>
              <div className="mt-1 text-lg md:text-2xl font-black leading-tight text-slate-950">{saleFor.name}</div>
              <div className="mt-1 text-sm font-medium text-slate-500 hidden sm:block">
                {withInstallation
                  ? "Контакт за сделката, дата и час за монтаж. Създава се продажба (чака монтаж) и събитие „Монтаж“ в календара."
                  : "Продажба без монтаж — записът в „Продажби“ се маркира директно като завършен, без дата в календара."}
            </div>
            </div>
            <button type="button" onClick={() => setSaleFor(null)} aria-label="Close" className="shrink-0 mt-0.5 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 hover:bg-slate-50 hover:text-slate-900">
              <X className="h-5 w-5" />
            </button>
              </div>

            <div className="grid flex-1 min-h-0 grid-cols-1 gap-3 overflow-y-auto p-4 md:p-6 md:grid-cols-2">
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
                        <AdminContactSuggestRow
                          key={c.id}
                          name={c.full_name}
                          phone={c.phone}
                          email={c.email}
                          onSelect={() => {
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
                        />
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

              {productMissingSerials(saleFor) && (
                <div className="col-span-full rounded-xl border-2 border-amber-300 bg-amber-50 p-3 space-y-2">
                  <p className="text-xs font-bold text-amber-900">
                    Този уред още няма записани серийни номера — въведете ги сега, за да се знае точно кой климатик се продава.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      value={saleSerialIndoor}
                      onChange={(e) => setSaleSerialIndoor(e.target.value)}
                      placeholder="Сериен № вътрешно тяло *"
                    />
                    <Input
                      value={saleSerialOutdoor}
                      onChange={(e) => setSaleSerialOutdoor(e.target.value)}
                      placeholder="Сериен № външно тяло *"
                    />
                  </div>
                </div>
              )}

              <div className="col-span-full border-t border-slate-100 pt-3 mt-1 space-y-3">
                {isClimateProduct && (
                  <label className="flex items-start gap-3 cursor-pointer rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={saleForm.includeMount}
                      onChange={(e) => setSaleForm((s) => ({ ...s, includeMount: e.target.checked }))}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-blue-600 focus:ring-brand-blue-500"
                    />
                    <span className="text-sm text-slate-700 leading-snug">
                      <span className="font-bold text-slate-900">С монтаж</span>
                      <span className="block text-xs text-slate-500 mt-0.5">
                        Изключете за продажба само на уред — без насрочване в календара.
                      </span>
                    </span>
                  </label>
                )}
                {withInstallation ? (
                  <>
                    <div className="text-xs font-black uppercase tracking-wide text-brand-blue-700">Монтаж</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold text-slate-600">Дата *</span>
                        <Input
                          type="date"
                          value={saleForm.mountDate}
                          onChange={(e) => setSaleForm((s) => ({ ...s, mountDate: e.target.value }))}
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold text-slate-600">Час от</span>
                        <Input
                          type="time"
                          value={saleForm.mountTimeFrom}
                          onChange={(e) => setSaleForm((s) => ({ ...s, mountTimeFrom: e.target.value }))}
                        />
                      </label>
                      <label className="grid gap-1.5">
                        <span className="text-xs font-bold text-slate-600">Час до</span>
                        <Input
                          type="time"
                          value={saleForm.mountTimeTo}
                          onChange={(e) => setSaleForm((s) => ({ ...s, mountTimeTo: e.target.value }))}
                        />
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

            <div className="flex justify-between items-center border-t border-slate-100 bg-slate-50 px-6 py-4 gap-2 flex-wrap">
              <span className="text-sm font-black text-slate-900">
                Сума: €{formatAdminPriceEuro(Number(saleFor.price))}
              </span>
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
                  disabled={
                    saleBusy ||
                    !saleForm.customerName.trim() ||
                    !saleForm.customerPhone.trim() ||
                    (withInstallation && !saleForm.mountDate.trim()) ||
                    (productMissingSerials(saleFor) && (!saleSerialIndoor.trim() || !saleSerialOutdoor.trim()))
                  }
                  onClick={async () => {
                    setSaleBusy(true);
                    try {
                      const resolvedPrice = saleForm.agreedPrice.trim()
                        ? Number(saleForm.agreedPrice.replace(",", "."))
                        : Number(saleFor.price);
                      const ok = await markAsSold(
                        saleFor,
                        {
                          id: saleForm.contactId || undefined,
                          name: saleForm.customerName.trim(),
                          phone: saleForm.customerPhone.trim(),
                          address: saleForm.customerAddress.trim(),
                          email: saleForm.customerEmail.trim(),
                          notes: saleForm.notes.trim(),
                        },
                        withInstallation
                          ? {
                              date: saleForm.mountDate,
                              timeFrom: saleForm.mountTimeFrom,
                              timeTo: saleForm.mountTimeTo,
                            }
                          : null,
                        Number.isFinite(resolvedPrice) ? resolvedPrice : Number(saleFor.price),
                        withInstallation,
                        { indoor: saleSerialIndoor, outdoor: saleSerialOutdoor },
                      );
                      if (ok) {
                        setSaleSuccess({
                          productName: saleFor.name,
                          customerName: saleForm.customerName.trim(),
                          amount: Number.isFinite(resolvedPrice) ? resolvedPrice : Number(saleFor.price),
                        });
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
        );
      })()}

      <ProductSupplierOrderModal
        open={Boolean(orderFor)}
        product={orderFor}
        onClose={() => setOrderFor(null)}
        onSuccess={(result) => {
          setSaleSuccess({
            productName: result.productName,
            customerName: result.customerName,
            amount: result.amount,
            quantity: result.quantity,
            isBackOrder: true,
          });
        }}
      />

      <ProductReservationModal
        open={Boolean(reserveFor)}
        product={reserveFor}
        onClose={() => setReserveFor(null)}
        onSuccess={(result) => {
          if (reserveFor) {
            const modelKey = (reserveFor.model_code ?? "").trim().toLowerCase();
            setItems((prev) =>
              prev.map((x) => {
                if (x.id === reserveFor.id) return { ...x, stock_status: "reserved" };
                if (
                  modelKey &&
                  x.brand_id &&
                  x.brand_id === reserveFor.brand_id &&
                  (x.model_code ?? "").trim().toLowerCase() === modelKey
                ) {
                  return { ...x, stock_quantity: Math.max(0, Number(x.stock_quantity ?? 0) - 1) };
                }
                return x;
              }),
            );
          }
          setSaleSuccess({
            productName: result.productName,
            customerName: result.customerName,
            amount: result.amount,
            isReservation: true,
          });
        }}
      />

      {saleSuccess && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/55 p-0 md:p-4 backdrop-blur-md">
          <div
            className="w-full max-w-xl max-h-[92dvh] overflow-hidden rounded-t-3xl md:rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)] flex flex-col pb-safe md:pb-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className={`px-4 py-5 md:px-6 md:py-6 text-center shrink-0 ${
              saleSuccess.isReservationCancel
                ? "bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#ffffff_44%,#f8fafc_100%)]"
                : saleSuccess.isReservation
                  ? "bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#ffffff_44%,#f8fafc_100%)]"
                  : saleSuccess.isBackOrder
                    ? "bg-[radial-gradient(circle_at_top_left,#ede9fe_0,#ffffff_44%,#f8fafc_100%)]"
                    : "bg-[radial-gradient(circle_at_top_left,#dcfce7_0,#ffffff_44%,#f8fafc_100%)]"
            }`}>
              <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-lg ${
                saleSuccess.isReservationCancel || saleSuccess.isReservation
                  ? "bg-sky-600 shadow-sky-600/25"
                  : saleSuccess.isBackOrder
                    ? "bg-violet-600 shadow-violet-600/25"
                    : "bg-emerald-600 shadow-emerald-600/25"
              }`}>
                <CheckCircle className="h-7 w-7" />
              </div>
              <div className="text-xl md:text-2xl font-black text-slate-950">
                {saleSuccess.isReservationCancel
                  ? "Резервацията е отменена"
                  : saleSuccess.isReservation
                    ? "Резервацията е записана"
                    : saleSuccess.isBackOrder
                      ? "Поръчката е записана"
                      : "Продажбата е записана"}
              </div>
              <div className="mt-2 text-sm font-medium text-slate-500">
                {saleSuccess.isReservationCancel
                  ? saleSuccess.productName
                  : `${saleSuccess.productName} · ${saleSuccess.customerName}`}
              </div>
            </div>
            <div className="grid gap-3 p-4 md:p-6 overflow-y-auto flex-1 min-h-0">
              {!saleSuccess.isReservationCancel ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {saleSuccess.isBackOrder ? "Обща стойност" : saleSuccess.isReservation ? "Договорена цена" : "Договорена цена"}
                </div>
                <div className="mt-1 text-2xl font-black text-slate-900">
                  €{formatAdminPriceEuro(saleSuccess.amount, { decimals: true })}
                </div>
                {saleSuccess.isBackOrder && saleSuccess.quantity && saleSuccess.quantity > 1 ? (
                  <div className="mt-1 text-xs font-medium text-slate-500">Количество: {saleSuccess.quantity} бр.</div>
                ) : null}
              </div>
              ) : null}
              {saleSuccess.isReservation ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-900">
                  Продуктът е маркиран като <strong>резервиран</strong>. Събитието е записано в историята на клиента.
                </div>
              ) : saleSuccess.isReservationCancel ? (
                <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm font-semibold leading-6 text-sky-900">
                  Продуктът отново е <strong>в наличност</strong>. Отмяната е записана в историята на клиента.
                </div>
              ) : saleSuccess.isBackOrder ? (
                <div className="rounded-2xl border border-violet-100 bg-violet-50 p-4 text-sm font-semibold leading-6 text-violet-900">
                  Поръчката е записана в панела <strong>Поръчки</strong>. След доставката попълнете серийните номера и насрочете монтаж.
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-900">
                  В панела „Продажби“ сделката е със статус <strong>чака монтаж</strong>, а в таблото е планиран <strong>монтаж</strong> на избраната дата.
                </div>
              )}
            </div>
            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button onClick={() => setSaleSuccess(null)}>Готово</Button>
            </div>
          </div>
        </div>
      )}

      {confirmBulkDelete && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/55 p-0 md:p-4 backdrop-blur-md"
        >
          <div
            className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-white p-5 md:p-6 shadow-2xl ring-1 ring-rose-100 pb-safe md:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-2 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="text-xl font-black text-slate-950">Окончателно изтриване</div>
                <div className="mt-1 text-sm text-slate-600">
                  Ще бъдат изтрити <span className="font-bold text-rose-700">{selected.length}</span>{" "}
                  {bulkDeleteNoun(items, selected)}. Това действие <span className="font-bold">не може да бъде отменено</span>.
                </div>
                <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                  {bulkDeleteWarning(items, selected)}
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

      {bulkDeleteActiveLinkWarning && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/70 p-0 md:p-4 backdrop-blur-md">
          <div
            className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-white p-5 md:p-6 shadow-2xl ring-2 ring-amber-300 pb-safe md:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-2 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center gap-2 text-xl font-black text-amber-700">
              <span aria-hidden>⚠️</span> Внимание — избрани са продукти с активна поръчка
            </div>
            <div className="mt-3 text-sm text-slate-700 leading-relaxed font-medium">
              {bulkDeleteActiveLinkWarning}
            </div>
            <div className="mt-3 text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              Препоръчваме първо да отмените резервациите/продажбите от съответните места, а не да изтривате продуктите директно.
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setBulkDeleteActiveLinkWarning(null)}>Отказ</Button>
              <Button variant="danger" onClick={() => void bulkDelete(true)} className="gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Изтрий въпреки това
              </Button>
            </div>
          </div>
        </div>
      )}

      {serviceSerialPromptFor && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-slate-950/70 p-0 md:p-4 backdrop-blur-md">
          <div
            className="w-full max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl md:rounded-3xl bg-white p-5 md:p-6 shadow-2xl ring-2 ring-amber-300 pb-safe md:pb-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-2 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="flex items-center gap-2 text-xl font-black text-amber-700">
              <span aria-hidden>⚠️</span> Прибиране в сервиз — липсват серийни номера
            </div>
            <div className="mt-3 text-sm text-slate-700 leading-relaxed font-medium">
              „{serviceSerialPromptFor.name}“ още няма записани серийни номера (напр. бройка от партида „втора употреба“).
              Въведете ги сега, за да се знае точно кой уред е предаден за сервиз.
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                value={serviceSerialIndoor}
                onChange={(e) => setServiceSerialIndoor(e.target.value)}
                placeholder="Сериен № вътрешно тяло *"
              />
              <Input
                value={serviceSerialOutdoor}
                onChange={(e) => setServiceSerialOutdoor(e.target.value)}
                placeholder="Сериен № външно тяло *"
              />
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setServiceSerialPromptFor(null)}>Отказ</Button>
              <Button
                variant="primary"
                disabled={!serviceSerialIndoor.trim() || !serviceSerialOutdoor.trim() || locationBusyId === serviceSerialPromptFor.id}
                onClick={async () => {
                  const p = serviceSerialPromptFor;
                  if (!p) return;
                  await patchStockLocation(p.id, "service", {
                    indoor: serviceSerialIndoor,
                    outdoor: serviceSerialOutdoor,
                  });
                  setServiceSerialPromptFor(null);
                }}
              >
                Потвърди и прибери в сервиз
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

      {serviceProtocolWizard && (
        <ServiceProtocolFormWizard
          protocolId={serviceProtocolWizard.editId}
          initialData={serviceProtocolWizard.initialData}
          role={(adminRole || "office_staff") as AdminRole}
          onClose={() => {
            setServiceProtocolWizard(null);
            void loadRepairProtocolMap(items);
          }}
          onSaved={(id) => {
            setServiceProtocolWizard((prev) =>
              prev ? { ...prev, editId: id } : null,
            );
            void load();
          }}
        />
      )}

      {serviceProtocolPreview && (
        <ServiceProtocolPreview
          stacked
          protocolId={serviceProtocolPreview.id}
          protocolNumber={serviceProtocolPreview.protocol_number}
          clientLabel={serviceProtocolPreviewLabel(serviceProtocolPreview)}
          dateLabel={formatProtocolDate(serviceProtocolPreview.date)}
          role={(adminRole || "office_staff") as AdminRole}
          onClose={() => {
            setServiceProtocolPreview(null);
            void loadRepairProtocolMap(items);
          }}
          onEdit={() => {
            const preview = serviceProtocolPreview;
            setServiceProtocolPreview(null);
            setServiceProtocolWizard({ editId: preview.id });
          }}
        />
      )}
    </div>
  );
}
