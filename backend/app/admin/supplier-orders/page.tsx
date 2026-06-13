"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SectionTitle, Card, Input, Select, Button, Table, Th, Td, AdminPhoneLink, AdminContactMetaLine } from "../ui";
import { RefreshCw, Eye, Receipt, ArrowUpDown, ArrowUp, ArrowDown, Sparkles, Recycle, FilterX, Plus } from "lucide-react";
import { SupplierOrderDetailModal } from "../SupplierOrderDetailModal";
import { SupplierOrderSaleModal } from "./SupplierOrderSaleModal";
import { ManualDeliveryModal } from "./ManualDeliveryModal";
import { ProductQuickViewButton } from "../ProductQuickView";
import { notifyAdminCalendarReload } from "@/lib/admin/calendarReload";
import { canRecordProductSale } from "@/lib/admin/recordProductSale";
import type { NormalizedSupplierOrderRow } from "@/lib/admin/supplierOrderRow";
import {
  orderPhaseCsv,
  toggleOrderChipFilter,
  type OrderDataFlagFilter,
  type OrderPhaseFilter,
} from "@/lib/admin/supplierOrdersQueryFilters";
import type { ProductRegion } from "@/lib/admin/productRegion";
import { groupSupplierNames, mergeSupplierGroups, type GroupedSupplier } from "@/lib/admin/supplierNameNormalize";

type OrderSection = "new" | "used";

type SortField =
  | "product"
  | "status"
  | "customer_name"
  | "customer_phone"
  | "customer_address"
  | "purchase_price"
  | "total_amount"
  | "order_date";

type SortDir = "asc" | "desc";

function orderPhaseLabel(row: NormalizedSupplierOrderRow): string {
  if (row.status === "cancelled") return "Отказана";
  if (row.status === "done") return "Доставена";
  return "Поръчана";
}

function orderPhasePillClass(row: NormalizedSupplierOrderRow): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap border";
  if (row.status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (row.status === "cancelled") return `${base} bg-red-100 border-red-200 text-red-800`;
  return `${base} bg-violet-100 border-violet-200 text-violet-900`;
}

function statusPillClass(status: string): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap border";
  if (status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (status === "cancelled") return `${base} bg-red-100 border-red-200 text-red-800`;
  if (status === "in_progress") return `${base} bg-brand-blue-100 border-brand-blue-200 text-brand-blue-700`;
  return `${base} bg-amber-100 border-amber-200 text-amber-800`;
}

const STATUS_TEXT: Record<string, string> = {
  planned: "Чака",
  in_progress: "В процес",
  done: "Изпълнена",
  cancelled: "Отказана",
};

function displayName(row: NormalizedSupplierOrderRow): string {
  const prod = row.products;
  if (!prod) return row.title;
  return (
    [prod.brand_name, prod.name, prod.model_code ? `(${prod.model_code})` : null].filter(Boolean).join(" ") ||
    row.title
  );
}

function catalogProductId(row: NormalizedSupplierOrderRow): string | null {
  return row.product_id ?? row.products?.id ?? row.delivered_product?.id ?? null;
}

function orderSupplierName(row: NormalizedSupplierOrderRow): string | null {
  return row.products?.supplier_name?.trim() || row.supplier_name?.trim() || null;
}

function orderSupplierInvoice(row: NormalizedSupplierOrderRow): string | null {
  return row.delivered_product?.supplier_invoice_number?.trim() || row.supplier_invoice_number?.trim() || null;
}

function orderPurchasePrice(row: NormalizedSupplierOrderRow): number | null {
  if (row.delivered_product?.purchase_price != null) return row.delivered_product.purchase_price;
  if (row.purchase_price != null) return row.purchase_price;
  return row.products?.purchase_price ?? null;
}

function orderAgreedPrice(row: NormalizedSupplierOrderRow): number | null {
  return row.unit_price;
}

function orderDateDisplay(row: NormalizedSupplierOrderRow): string {
  const raw = row.due_date ?? row.created_at;
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("bg-BG");
  } catch {
    return "—";
  }
}

function OrderProductTitle({
  row,
  className = "",
}: {
  row: NormalizedSupplierOrderRow;
  className?: string;
}) {
  const name = displayName(row);
  return (
    <ProductQuickViewButton
      productId={catalogProductId(row)}
      productName={name}
      className={className}
    />
  );
}

function canSellDelivered(row: NormalizedSupplierOrderRow) {
  const dp = row.delivered_product;
  return row.status === "done" && dp != null && canRecordProductSale(dp.stock_status);
}

const DATE_DESC_FIELDS: SortField[] = ["order_date", "purchase_price", "total_amount"];
const TEXT_ASC_FIELDS: SortField[] = [
  "product",
  "customer_name",
  "customer_phone",
  "customer_address",
];

function defaultSortDir(field: SortField): SortDir {
  if (field === "status") return "desc";
  if (DATE_DESC_FIELDS.includes(field)) return "desc";
  if (TEXT_ASC_FIELDS.includes(field)) return "asc";
  return "asc";
}

const ORDER_TABLE_TH = "text-center whitespace-nowrap !text-xs !px-2 !py-2.5";

const ORDER_TABLE_TD = "!px-2.5 !py-2 align-middle text-xs";

const ORDER_PRICE_TD =
  `${ORDER_TABLE_TD} text-center tabular-nums font-semibold whitespace-nowrap min-w-[5.5rem]`;

const ORDER_STICKY_ACTIONS =
  "sticky right-0 z-20 bg-white shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.12)] !px-2 !py-2 w-[9rem] min-w-[9rem] text-center";

const ORDER_STICKY_ACTIONS_HEAD = `${ORDER_STICKY_ACTIONS} bg-slate-50`;

function OrderHeaderTh({ label, className = "" }: { label: string; className?: string }) {
  return (
    <Th className={`${ORDER_TABLE_TH} ${className}`}>
      {label}
    </Th>
  );
}

function sortHint(field: SortField, sortBy: SortField, sortDir: SortDir, label: string): string {
  if (sortBy !== field) return `Сортирай по „${label}"`;
  if (field === "order_date") {
    return sortDir === "desc" ? "Най-новите отгоре" : "Най-старите отгоре";
  }
  if (field === "status") {
    return sortDir === "desc" ? "Чакащите отгоре" : "Завършените отгоре";
  }
  if (field === "purchase_price" || field === "total_amount") {
    return sortDir === "desc" ? "Най-големите суми отгоре" : "Най-малките суми отгоре";
  }
  return sortDir === "asc" ? "А → Я" : "Я → А";
}

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
    <Th className={`p-0 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`w-full px-2 py-2.5 inline-flex items-center justify-center gap-1 text-xs font-bold whitespace-nowrap transition-colors hover:bg-slate-100 ${
          isActive ? "text-brand-blue-700 bg-brand-blue-50/60" : "text-slate-600"
        }`}
        title={sortHint(field, sortBy, sortDir, label)}
      >
        <span>{label}</span>
        <ArrowIcon className={`w-3 h-3 shrink-0 ${isActive ? "opacity-100" : "opacity-40"}`} />
      </button>
    </Th>
  );
}

type ChipTone = "neutral" | "success" | "warning" | "danger" | "brand" | "amber";

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
      idle: "bg-white text-slate-700 border-slate-200 hover:bg-slate-50",
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
    amber: {
      active: "bg-amber-700 text-white border-amber-700",
      idle: "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100",
    },
  };
  const styles = palette[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-0.5 px-3 min-h-[40px] rounded-full text-[10px] font-semibold border transition-colors ${
        active ? styles.active : styles.idle
      }`}
    >
      {children}
    </button>
  );
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function periodRange(preset: string): { from: string; to: string } {
  const now = new Date();
  if (preset === "month") {
    return {
      from: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      to: isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (preset === "90d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 90);
    return { from: isoDate(from), to: isoDate(now) };
  }
  const year = Number(preset);
  if (Number.isFinite(year) && year >= 2000) {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  return { from: "", to: "" };
}

const PERIOD_YEARS = [2026, 2025, 2024, 2023, 2022] as const;

export default function SupplierOrdersHistoryPage() {
  const [section, setSection] = useState<OrderSection>("new");
  const [items, setItems] = useState<NormalizedSupplierOrderRow[]>([]);
  const [q, setQ] = useState("");
  const [orderPhases, setOrderPhases] = useState<OrderPhaseFilter[]>([]);
  const [dataFlags, setDataFlags] = useState<OrderDataFlagFilter[]>([]);
  const [productRegion, setProductRegion] = useState<"" | ProductRegion>("");
  const [brandId, setBrandId] = useState("");
  const [supplierKey, setSupplierKey] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [periodPreset, setPeriodPreset] = useState("");
  const [brands, setBrands] = useState<{ id: string; name: string }[]>([]);
  const [supplierOptions, setSupplierOptions] = useState<GroupedSupplier[]>([]);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ page: 1, perPage: 30, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [saleOrder, setSaleOrder] = useState<NormalizedSupplierOrderRow | null>(null);
  const [manualDeliveryOpen, setManualDeliveryOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>("status");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    void Promise.all([
      fetch("/api/admin/meta/brands?usedInProducts=1", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/contacts?kind=supplier&perPage=500", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/meta/sale-suppliers", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([brandsJson, contactsJson, saleSuppliersJson]) => {
        setBrands((brandsJson as { data?: { id: string; name: string }[] }).data ?? []);
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

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (orderPhases.length) n += 1;
    if (dataFlags.length) n += dataFlags.length;
    if (productRegion) n += 1;
    if (brandId) n += 1;
    if (supplierKey) n += 1;
    if (amountMin.trim()) n += 1;
    if (amountMax.trim()) n += 1;
    if (fromDate || toDate) n += 1;
    if (q.trim()) n += 1;
    return n;
  }, [orderPhases, dataFlags, productRegion, brandId, supplierKey, amountMin, amountMax, fromDate, toDate, q]);

  function resetFilters() {
    setPage(1);
    setQ("");
    setOrderPhases([]);
    setDataFlags([]);
    setProductRegion("");
    setBrandId("");
    setSupplierKey("");
    setAmountMin("");
    setAmountMax("");
    setFromDate("");
    setToDate("");
    setPeriodPreset("");
  }

  function applyPeriod(preset: string) {
    setPage(1);
    if (periodPreset === preset) {
      setPeriodPreset("");
      setFromDate("");
      setToDate("");
      return;
    }
    const range = periodRange(preset);
    setPeriodPreset(preset);
    setFromDate(range.from);
    setToDate(range.to);
  }

  const qs = useMemo(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    const phaseCsv = orderPhaseCsv(orderPhases);
    if (phaseCsv) sp.set("orderPhase", phaseCsv);
    if (supplierKey.trim()) sp.set("supplierKey", supplierKey.trim());
    if (dataFlags.includes("invoice")) sp.set("hasSupplierInvoice", "yes");
    if (dataFlags.includes("purchase")) sp.set("hasPurchasePrice", "yes");
    if (productRegion) sp.set("productRegion", productRegion);
    if (brandId) sp.set("brandId", brandId);
    const min = amountMin.trim() ? Number(amountMin.replace(",", ".")) : NaN;
    const max = amountMax.trim() ? Number(amountMax.replace(",", ".")) : NaN;
    if (Number.isFinite(min)) sp.set("amountMin", String(min));
    if (Number.isFinite(max)) sp.set("amountMax", String(max));
    if (fromDate) sp.set("from", fromDate);
    if (toDate) sp.set("to", toDate);
    sp.set("page", String(page));
    sp.set("perPage", "30");
    sp.set("productCondition", section);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    return sp.toString();
  }, [
    q,
    orderPhases,
    dataFlags,
    productRegion,
    brandId,
    supplierKey,
    amountMin,
    amountMax,
    fromDate,
    toDate,
    page,
    section,
    sortBy,
    sortDir,
  ]);

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/supplier-orders?${qs}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка");
      setItems((json as { data?: NormalizedSupplierOrderRow[] }).data ?? []);
      setMeta((json as { meta?: typeof meta }).meta ?? { page: 1, perPage: 30, total: 0 });
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qs]);

  function handleSort(field: SortField) {
    setPage(1);
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(defaultSortDir(field));
    }
  }

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-bold leading-tight text-slate-900 md:text-xl">
          <SectionTitle
            title="Поръчки"
            hint="Пълна хронология: поръчани, доставени и отказани. Управление на доставка и продажба след получаване."
          />
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => setManualDeliveryOpen(true)} className="gap-2 shadow-sm">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Ръчна поръчка</span>
          </Button>
          <Button variant="secondary" onClick={() => void load()} className="gap-2 shadow-sm">
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Обнови</span>
          </Button>
        </div>
      </div>

      <div className="flex w-full rounded-xl border border-slate-200 bg-white p-0.5 shadow-sm sm:w-auto sm:min-w-[320px]">
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setSection("new");
          }}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-colors ${
            section === "new"
              ? "bg-brand-blue-500 text-white shadow-sm"
              : "text-slate-500 hover:bg-brand-blue-50 hover:text-brand-blue-700"
          }`}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Нови
        </button>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setSection("used");
          }}
          className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-colors ${
            section === "used"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-amber-50 hover:text-amber-800"
          }`}
        >
          <Recycle className="h-3.5 w-3.5" />
          Втора употреба
        </button>
      </div>

      <Card className="space-y-2 p-2.5 md:p-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Клиент, телефон, продукт, бележка, адрес…"
            className="flex-1 text-sm"
          />
          <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
            <span className="whitespace-nowrap text-[10px] font-semibold tabular-nums text-slate-500">
              Намерени: <span className="text-slate-900">{meta.total}</span>
            </span>
            {activeFiltersCount > 0 && (
              <Button variant="secondary" size="sm" onClick={resetFilters} className="gap-1 !px-2 !py-1 !text-[11px]">
                <FilterX className="h-3 w-3" /> Изчисти ({activeFiltersCount})
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Статус:</span>
          <ChipToggle
            active={orderPhases.includes("ordered")}
            tone="brand"
            onClick={() => {
              setPage(1);
              setOrderPhases((p) => toggleOrderChipFilter(p, "ordered"));
            }}
          >
            Поръчана
          </ChipToggle>
          <ChipToggle
            active={orderPhases.includes("delivered")}
            tone="success"
            onClick={() => {
              setPage(1);
              setOrderPhases((p) => toggleOrderChipFilter(p, "delivered"));
            }}
          >
            Доставена
          </ChipToggle>
          <ChipToggle
            active={orderPhases.includes("cancelled")}
            tone="danger"
            onClick={() => {
              setPage(1);
              setOrderPhases((p) => toggleOrderChipFilter(p, "cancelled"));
            }}
          >
            Отказана
          </ChipToggle>
          <span className="mx-0.5 hidden h-4 w-px bg-slate-200 sm:inline" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Данни:</span>
          <ChipToggle
            active={dataFlags.includes("invoice")}
            onClick={() => {
              setPage(1);
              setDataFlags((p) => toggleOrderChipFilter(p, "invoice"));
            }}
          >
            Фактура
          </ChipToggle>
          <ChipToggle
            active={dataFlags.includes("purchase")}
            onClick={() => {
              setPage(1);
              setDataFlags((p) => toggleOrderChipFilter(p, "purchase"));
            }}
          >
            Доставна
          </ChipToggle>
          <span className="mx-0.5 hidden h-4 w-px bg-slate-200 sm:inline" aria-hidden />
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Регион:</span>
          <ChipToggle
            active={productRegion === "europe"}
            onClick={() => {
              setPage(1);
              setProductRegion((r) => (r === "europe" ? "" : "europe"));
            }}
          >
            EU
          </ChipToggle>
          <ChipToggle
            active={productRegion === "japan"}
            tone="amber"
            onClick={() => {
              setPage(1);
              setProductRegion((r) => (r === "japan" ? "" : "japan"));
            }}
          >
            JAPAN
          </ChipToggle>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Период:</span>
          <ChipToggle active={periodPreset === "month"} onClick={() => applyPeriod("month")}>
            Този месец
          </ChipToggle>
          <ChipToggle active={periodPreset === "90d"} onClick={() => applyPeriod("90d")}>
            90 дни
          </ChipToggle>
          {PERIOD_YEARS.map((year) => (
            <ChipToggle key={year} active={periodPreset === String(year)} onClick={() => applyPeriod(String(year))}>
              {year}
            </ChipToggle>
          ))}
          <span className="mx-1 hidden h-4 w-px bg-slate-200 sm:inline" aria-hidden />
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setPage(1);
              setPeriodPreset("");
              setFromDate(e.target.value);
            }}
            className="!w-[8.5rem] !py-1 !text-xs"
            title="От дата"
          />
          <span className="text-[10px] text-slate-400">—</span>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => {
              setPage(1);
              setPeriodPreset("");
              setToDate(e.target.value);
            }}
            className="!w-[8.5rem] !py-1 !text-xs"
            title="До дата"
          />
          <Select
            value={brandId}
            onChange={(e) => {
              setPage(1);
              setBrandId(e.target.value);
            }}
            className="!w-auto min-w-[7rem] max-w-[9rem] !py-1 !text-xs"
          >
            <option value="">Марка</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <Select
            value={supplierKey}
            onChange={(e) => {
              setPage(1);
              setSupplierKey(e.target.value);
            }}
            className="!w-auto min-w-[8rem] max-w-[11rem] !py-1 !text-xs"
            title="Доставчик"
          >
            <option value="">Доставчик</option>
            {supplierOptions.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
          <Input
            value={amountMin}
            onChange={(e) => {
              setPage(1);
              setAmountMin(e.target.value);
            }}
            placeholder="€ от"
            inputMode="decimal"
            className="!w-[4.5rem] !py-1 !text-xs"
          />
          <Input
            value={amountMax}
            onChange={(e) => {
              setPage(1);
              setAmountMax(e.target.value);
            }}
            placeholder="€ до"
            inputMode="decimal"
            className="!w-[4.5rem] !py-1 !text-xs"
          />
        </div>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-10 text-sm font-medium text-slate-500 gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Зареждане…
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</div>
      )}

      <div className="hidden md:block min-w-0">
        <Table tableClassName="w-full min-w-[1180px]">
          <thead>
            <tr>
              <SortableTh label="Продукт" field="product" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={`${ORDER_TABLE_TH} min-w-[11rem]`} />
              <OrderHeaderTh label="Фаза" className="min-w-[5.5rem]" />
              <SortableTh label="Статус" field="status" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={`${ORDER_TABLE_TH} min-w-[5.5rem]`} />
              <SortableTh label="Контакт" field="customer_name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={`${ORDER_TABLE_TH} min-w-[8rem]`} />
              <SortableTh label="Телефон" field="customer_phone" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={`${ORDER_TABLE_TH} min-w-[6.5rem]`} />
              <SortableTh label="Адрес" field="customer_address" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={`${ORDER_TABLE_TH} min-w-[9rem]`} />
              <OrderHeaderTh label="Доставчик" className="min-w-[7rem]" />
              <OrderHeaderTh label="Фактура" className="min-w-[6.5rem]" />
              <SortableTh label="Доставна" field="purchase_price" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={`${ORDER_TABLE_TH} min-w-[5.5rem]`} />
              <SortableTh label="Продажна" field="total_amount" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={`${ORDER_TABLE_TH} min-w-[5.5rem]`} />
              <SortableTh label="Дата" field="order_date" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} className={`${ORDER_TABLE_TH} min-w-[5.5rem]`} />
              <OrderHeaderTh label="Действия" className={ORDER_STICKY_ACTIONS_HEAD} />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-slate-50 group">
                <Td className={`${ORDER_TABLE_TD} max-w-[14rem]`}>
                  <OrderProductTitle row={row} className="block truncate font-semibold text-slate-800 text-left" />
                </Td>
                <Td className={`${ORDER_TABLE_TD} text-center`}>
                  <span className={orderPhasePillClass(row)}>{orderPhaseLabel(row)}</span>
                </Td>
                <Td className={`${ORDER_TABLE_TD} text-center`}>
                  <span className={statusPillClass(row.status)}>{STATUS_TEXT[row.status] ?? row.status}</span>
                </Td>
                <Td className={`${ORDER_TABLE_TD} max-w-[10rem] truncate font-medium text-slate-700 text-left`}>
                  {row.customer_name ?? row.contacts?.full_name ?? "—"}
                </Td>
                <Td className={`${ORDER_TABLE_TD} text-center whitespace-nowrap text-slate-600`}>
                  <AdminPhoneLink
                    phone={row.customer_phone ?? row.contacts?.phone}
                    showIcon={false}
                    className="font-medium text-slate-600"
                  />
                </Td>
                <Td className={`${ORDER_TABLE_TD} max-w-[11rem] truncate text-slate-600 text-left`} title={row.customer_address ?? ""}>
                  {row.customer_address ?? row.contacts?.address ?? "—"}
                </Td>
                <Td className={`${ORDER_TABLE_TD} max-w-[9rem] truncate text-slate-600 text-left`} title={orderSupplierName(row) ?? ""}>
                  {orderSupplierName(row) || "—"}
                </Td>
                <Td className={`${ORDER_TABLE_TD} max-w-[8rem] truncate font-mono text-[11px] text-center text-slate-700`} title={orderSupplierInvoice(row) ?? ""}>
                  {orderSupplierInvoice(row) || "—"}
                </Td>
                <Td className={`${ORDER_PRICE_TD} text-slate-700`}>
                  {orderPurchasePrice(row) != null ? `€${Number(orderPurchasePrice(row)).toLocaleString()}` : "—"}
                </Td>
                <Td className={`${ORDER_PRICE_TD} text-slate-900`}>
                  {orderAgreedPrice(row) != null ? `€${Number(orderAgreedPrice(row)).toLocaleString()}` : "—"}
                </Td>
                <Td className={`${ORDER_TABLE_TD} text-center text-slate-500 font-medium whitespace-nowrap tabular-nums`}>
                  {orderDateDisplay(row)}
                </Td>
                <Td className={`${ORDER_STICKY_ACTIONS} group-hover:bg-slate-50`}>
                  <div className="flex flex-col items-center gap-1">
                    <Button variant="secondary" size="sm" className="!text-[11px] font-bold w-full justify-center" onClick={() => setDetailId(row.id)}>
                      <Eye className="mr-1 inline h-3.5 w-3.5" />
                      Детайли
                    </Button>
                    {canSellDelivered(row) && (
                      <Button variant="primary" size="sm" className="!text-[11px] font-bold w-full justify-center" onClick={() => setSaleOrder(row)}>
                        <Receipt className="mr-1 inline h-3.5 w-3.5" />
                        Продажба
                      </Button>
                    )}
                  </div>
                </Td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <Td colSpan={12} className="py-8 text-center text-slate-500">
                  {section === "new" ? "Няма поръчки на нови продукти." : "Няма поръчки на втора употреба."}
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      <div className="space-y-2 md:hidden">
        {items.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            {section === "new" ? "Няма поръчки на нови продукти." : "Няма поръчки на втора употреба."}
          </div>
        )}
        {items.map((row) => (
          <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <OrderProductTitle row={row} className="line-clamp-2 text-sm font-bold text-slate-900" />
                <AdminContactMetaLine
                  name={row.customer_name ?? row.contacts?.full_name}
                  phone={row.customer_phone ?? row.contacts?.phone}
                  className="mt-1 block text-xs text-slate-500"
                />
                {(row.customer_address ?? row.contacts?.address) && (
                  <div className="mt-0.5 text-xs text-slate-500">{row.customer_address ?? row.contacts?.address}</div>
                )}
              </div>
              <div className="shrink-0 text-right">
                {orderAgreedPrice(row) != null && (
                  <div className="text-lg font-black text-slate-900">€{Number(orderAgreedPrice(row)).toLocaleString()}</div>
                )}
                <div className="mt-1 flex flex-col items-end gap-1">
                  <span className={orderPhasePillClass(row)}>{orderPhaseLabel(row)}</span>
                  <span className={statusPillClass(row.status)}>{STATUS_TEXT[row.status] ?? row.status}</span>
                </div>
              </div>
            </div>
            {(orderSupplierName(row) || orderSupplierInvoice(row) || orderPurchasePrice(row) != null) && (
              <div className="text-[11px] text-slate-500">
                {orderSupplierName(row) && <>Доставчик: {orderSupplierName(row)}</>}
                {orderPurchasePrice(row) != null && (
                  <>
                    {(orderSupplierName(row) || orderSupplierInvoice(row)) && " · "}
                    Доставна: €{Number(orderPurchasePrice(row)).toLocaleString()}
                  </>
                )}
                {orderSupplierInvoice(row) && (
                  <>
                    {(orderSupplierName(row) || orderPurchasePrice(row) != null) && " · "}
                    Фактура: {orderSupplierInvoice(row)}
                  </>
                )}
              </div>
            )}
            <div className="mt-2 text-xs text-slate-400">Дата поръчка: {orderDateDisplay(row)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" className="col-span-2 font-bold !text-xs" onClick={() => setDetailId(row.id)}>
                <Eye className="mr-1 inline h-3.5 w-3.5" />
                Детайли
              </Button>
              {canSellDelivered(row) && (
                <Button variant="primary" size="sm" className="col-span-2 font-bold !text-xs" onClick={() => setSaleOrder(row)}>
                  Продажба
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">
          {section === "new" ? "Нови" : "Втора употреба"} · общо: {meta.total}
        </span>
        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo(0, 0); }}>
            ‹ Пред.
          </Button>
          <span className="text-sm font-medium text-slate-600">
            {page} / {pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => { setPage((p) => p + 1); window.scrollTo(0, 0); }}>
            Следв. ›
          </Button>
        </div>
      </div>

      {detailId && (
        <SupplierOrderDetailModal
          orderId={detailId}
          onClose={() => setDetailId(null)}
          onCancelled={() => {
            setDetailId(null);
            void load();
            notifyAdminCalendarReload();
          }}
          onUpdated={() => void load()}
          onFulfilled={() => {
            setDetailId(null);
            void load();
            notifyAdminCalendarReload();
          }}
          onRequestSale={(order) => {
            setDetailId(null);
            setSaleOrder(order);
          }}
        />
      )}

      {saleOrder && (
        <SupplierOrderSaleModal
          order={saleOrder}
          onClose={() => setSaleOrder(null)}
          onSuccess={() => {
            void load();
            notifyAdminCalendarReload();
          }}
        />
      )}

      <ManualDeliveryModal
        open={manualDeliveryOpen}
        section={section}
        onClose={() => setManualDeliveryOpen(false)}
        onSuccess={() => void load()}
      />
    </div>
  );
}
