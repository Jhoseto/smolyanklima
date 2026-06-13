"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useDebounce } from "@/lib/hooks/useDebounce";
import { SectionTitle, Card, Input, Select, Button, Table, Th, Td, AdminPhoneLink, useAdminBackHandler } from "../ui";
import { RefreshCw, CheckCircle2, Ban, Eye, ArrowUpDown, ArrowUp, ArrowDown, Sparkles, Recycle, FilterX, Plus, BarChart3 } from "lucide-react";
import { ProductQuickViewButton } from "../ProductQuickView";
import { SaleDetailModal } from "./SaleDetailModal";
import { ManualSaleModal } from "./ManualSaleModal";
import {
  ContactHistoryModal,
  ContactNameButton,
  type ContactHistoryTarget,
} from "../contacts/ContactHistoryModal";
import { SalesHistoryReportPanel } from "./SalesHistoryReportPanel";
import { ServiceSalesTable, ServiceStatusChips, type ServiceSortField } from "./ServiceSalesTable";
import { ServiceDetailModal } from "./ServiceDetailModal";
import {
  SALES_PANEL_TABS,
  PAID_SERVICE_EVENT_LABELS,
  salesPanelEventCode,
  type SalesPanelTabId,
} from "@/lib/admin/serviceEventCodes";
import {
  SALE_CANCEL_REASONS,
  SALE_CANCEL_REASON_LABELS,
  saleCancelReasonLabel,
  type SaleCancelReason,
} from "@/lib/admin/saleCancelReason";
import { saleSupplierInvoice, saleSupplierName } from "@/lib/admin/saleWorkItemMeta";
import {
  mountPhaseCsv,
  productConditionCsv,
  saleProductConditionFilterLabel,
  toggleSaleChipFilter,
  type SaleDataFlagFilter,
  type SaleMountPhaseFilter,
  type SaleProductConditionFilter,
} from "@/lib/admin/salesHistoryQueryFilters";
import type { ProductRegion } from "@/lib/admin/productRegion";
import { groupSupplierNames, mergeSupplierGroups, type GroupedSupplier } from "@/lib/admin/supplierNameNormalize";

type EventCode =
  | "item_added"
  | "item_removed"
  | "sale"
  | "service_installation"
  | "service_maintenance"
  | "service_on_site"
  | "service_in_shop"
  | "consultation";

type WorkRow = {
  id: string;
  type: "sale" | "service" | "stock_in" | "stock_out" | "task";
  event_code?: EventCode | null;
  status: "planned" | "in_progress" | "done" | "cancelled";
  title: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  quantity?: number | null;
  unit_price?: number | null;
  total_amount?: number | null;
  purchase_price?: number | null;
  supplier_name?: string | null;
  supplier_invoice_number?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  created_at: string;
  notes?: string | null;
  sale_install_state?: "pending_mount" | "completed" | null;
  cancel_reason?: string | null;
  contact_id?: string | null;
  contacts?:
    | { id: string; full_name?: string | null; phone?: string | null }
    | Array<{ id: string; full_name?: string | null; phone?: string | null }>
    | null;
  products?: {
    id?: string;
    name?: string;
    slug?: string;
    model_code?: string | null;
    product_condition?: "new" | "used" | null;
    supplier_invoice_number?: string | null;
    indoor_unit_serial?: string | null;
    outdoor_unit_serial?: string | null;
  } | null;
};

function contactTargetFromRow(row: WorkRow): ContactHistoryTarget {
  const embedded = Array.isArray(row.contacts) ? row.contacts[0] : row.contacts;
  return {
    contactId: embedded?.id ?? row.contact_id ?? null,
    customerName: row.customer_name,
    customerPhone: row.customer_phone ?? embedded?.phone ?? null,
  };
}

type SaleSection = "new" | "used";

function statusPillClass(status: WorkRow["status"]): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap border";
  if (status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (status === "in_progress") return `${base} bg-brand-blue-100 border-brand-blue-200 text-brand-blue-700`;
  if (status === "cancelled") return `${base} bg-red-100 border-red-200 text-red-800`;
  return `${base} bg-amber-100 border-amber-200 text-amber-800`;
}

const STATUS_TEXT: Record<WorkRow["status"], string> = {
  planned: "Чака",
  in_progress: "В процес",
  done: "Изпълнена",
  cancelled: "Отказана",
};

function mountPhaseLabel(row: WorkRow): string {
  if (row.status === "cancelled") return "Отказана";
  if (row.sale_install_state === "pending_mount") return "Чака монтаж";
  if (row.sale_install_state === "completed") return "Завършен";
  if (row.status === "done") return "Завършен";
  return "Чака монтаж";
}

function mountPhasePillClass(row: WorkRow): string {
  const base = "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap border";
  const label = mountPhaseLabel(row);
  if (label === "Завършен") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (label === "Отказана") return `${base} bg-red-100 border-red-200 text-red-900`;
  return `${base} bg-amber-100 border-amber-200 text-amber-900`;
}

const SALE_SERIAL_TD =
  "text-[8px] leading-none font-mono text-slate-600 truncate !py-0.5 !px-1 max-w-0";

const SALE_TABLE_TH = "!text-[10px] !px-1 !py-1 whitespace-nowrap";

const SALE_PRICE_TH = `${SALE_TABLE_TH} text-center`;

const SALE_PRICE_TD =
  "font-semibold whitespace-nowrap text-[10px] text-center tabular-nums !px-1";

const SALE_STICKY_ACTIONS =
  "sticky right-0 z-20 bg-white shadow-[-6px_0_8px_-4px_rgba(15,23,42,0.12)] !px-1.5 !py-1 w-[7.5rem] min-w-[7.5rem] max-w-[7.5rem]";

const SALE_STICKY_ACTIONS_HEAD = `${SALE_STICKY_ACTIONS} bg-slate-50`;

const SALE_COMPACT_PILL =
  "inline-flex items-center px-1 py-px rounded text-[9px] font-bold whitespace-nowrap border leading-none";

function tableMountPhaseLabel(row: WorkRow): string {
  if (row.status === "cancelled") return "Отказ";
  if (row.sale_install_state === "pending_mount") return "Чака";
  if (row.sale_install_state === "completed") return "Готов";
  if (row.status === "done") return "Готов";
  return "Чака";
}

function tableMountPhasePillClass(row: WorkRow): string {
  const label = tableMountPhaseLabel(row);
  if (label === "Готов") return `${SALE_COMPACT_PILL} bg-green-100 border-green-200 text-green-800`;
  if (label === "Отказ") return `${SALE_COMPACT_PILL} bg-red-100 border-red-200 text-red-900`;
  return `${SALE_COMPACT_PILL} bg-amber-100 border-amber-200 text-amber-900`;
}

function tableStatusPillClass(status: WorkRow["status"]): string {
  const base = SALE_COMPACT_PILL;
  if (status === "done") return `${base} bg-green-100 border-green-200 text-green-800`;
  if (status === "in_progress") return `${base} bg-brand-blue-100 border-brand-blue-200 text-brand-blue-700`;
  if (status === "cancelled") return `${base} bg-red-100 border-red-200 text-red-800`;
  return `${base} bg-amber-100 border-amber-200 text-amber-800`;
}

const TABLE_STATUS_TEXT: Record<WorkRow["status"], string> = {
  planned: "Чака",
  in_progress: "Процес",
  done: "Готово",
  cancelled: "Отказ",
};

function saleDateDisplay(row: WorkRow): string {
  const raw = row.completed_at ?? row.due_date ?? null;
  if (!raw) return "—";
  try {
    return new Date(raw).toLocaleDateString("bg-BG");
  } catch {
    return "—";
  }
}

type ConfirmKind = "complete" | "cancel";

type SortField =
  | "product"
  | "sale_install_state"
  | "status"
  | "customer_name"
  | "customer_phone"
  | "supplier"
  | "supplier_invoice"
  | "purchase_price"
  | "total_amount"
  | "sale_date";

/** Продажби + услуги (адрес само при сервизни табове). */
type HistorySortField = SortField | ServiceSortField;

type SortDir = "asc" | "desc";

const DATE_DESC_FIELDS: HistorySortField[] = ["sale_date", "purchase_price", "total_amount"];
const TEXT_ASC_FIELDS: HistorySortField[] = [
  "product",
  "customer_name",
  "customer_phone",
  "customer_address",
  "supplier",
  "supplier_invoice",
  "sale_install_state",
  "status",
];

function defaultSortDir(field: HistorySortField): SortDir {
  if (DATE_DESC_FIELDS.includes(field)) return "desc";
  if (TEXT_ASC_FIELDS.includes(field)) return "asc";
  return "asc";
}

function sortHint(field: SortField, sortBy: SortField, sortDir: SortDir, label: string): string {
  if (sortBy !== field) return `Сортирай по „${label}“`;
  if (field === "sale_date") {
    return sortDir === "desc" ? "Най-новите продажби отгоре" : "Най-старите продажби отгоре";
  }
  if (field === "customer_name") {
    return sortDir === "asc" ? "Контакти А → Я" : "Контакти Я → А";
  }
  if (field === "purchase_price" || field === "total_amount") {
    return sortDir === "desc" ? "Най-големите суми отгоре" : "Най-малките суми отгоре";
  }
  if (TEXT_ASC_FIELDS.includes(field)) {
    return sortDir === "asc" ? "А → Я" : "Я → А";
  }
  return sortDir === "asc" ? "Възходящо" : "Низходящо";
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
  const compact = className.includes("!text-[10px]");
  const centered = className.includes("text-center");
  return (
    <Th className={`p-0 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`w-full inline-flex items-center gap-0.5 font-bold transition-colors hover:bg-slate-100 ${
          centered ? "justify-center" : "text-left"
        } ${compact ? "px-1 py-1 text-[10px]" : "px-3 py-2 text-xs"} ${
          isActive ? "text-brand-blue-700 bg-brand-blue-50/60" : "text-slate-600"
        }`}
        title={sortHint(field, sortBy, sortDir, label)}
      >
        <span className="truncate">{label}</span>
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
      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
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

function emptySalesMessage(conditions: SaleProductConditionFilter[]): string {
  if (conditions.length === 1 && conditions[0] === "new") return "Няма продажби на нови продукти.";
  if (conditions.length === 1 && conditions[0] === "used") return "Няма продажби на втора употреба.";
  return "Няма продажби по избраните критерии.";
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

function emptyServiceMessage(tab: SalesPanelTabId): string {
  if (tab === "products") return "Няма записи.";
  const label = PAID_SERVICE_EVENT_LABELS[tab];
  return `Няма записи за „${label}“.`;
}

function toggleChipFilter<T extends string>(current: T[], value: T): T[] {
  return current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
}

export default function AdminHistoryPage() {
  const [salesTab, setSalesTab] = useState<SalesPanelTabId>("products");
  const [serviceStatuses, setServiceStatuses] = useState<WorkRow["status"][]>([]);
  const [productConditions, setProductConditions] = useState<SaleProductConditionFilter[]>([]);
  const [items, setItems] = useState<WorkRow[]>([]);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [mountPhases, setMountPhases] = useState<SaleMountPhaseFilter[]>([]);
  const [dataFlags, setDataFlags] = useState<SaleDataFlagFilter[]>([]);
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
  const [actionRowId, setActionRowId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: ConfirmKind; row: WorkRow } | null>(null);
  useAdminBackHandler(Boolean(confirm), () => setConfirm(null), "history-confirm");
  const [cancelReason, setCancelReason] = useState<SaleCancelReason | "">("");
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [manualSaleOpen, setManualSaleOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportGenerateToken, setReportGenerateToken] = useState(0);
  const [isMasterAdmin, setIsMasterAdmin] = useState(false);
  const [detailServiceId, setDetailServiceId] = useState<string | null>(null);
  const [contactHistoryTarget, setContactHistoryTarget] = useState<ContactHistoryTarget | null>(null);
  const [sortBy, setSortBy] = useState<HistorySortField>("sale_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [loading, setLoading] = useState(false);

  const isProductSales = salesTab === "products";

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/admin/whoami", { credentials: "include" });
        const json = (await res.json().catch(() => ({}))) as { data?: { admin?: { role?: string } | null } };
        if (!cancelled && res.ok) {
          setIsMasterAdmin(json.data?.admin?.role === "master_admin");
        }
      } catch {
        if (!cancelled) setIsMasterAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const manualSaleSection: SaleSection =
    productConditions.length === 1 ? productConditions[0] : "new";

  const activeFiltersCount = useMemo(() => {
    let n = 0;
    if (isProductSales) {
      if (productConditions.length > 0) n += 1;
      if (mountPhases.length) n += 1;
      if (dataFlags.length) n += dataFlags.length;
      if (productRegion) n += 1;
      if (brandId) n += 1;
      if (supplierKey) n += 1;
    } else if (serviceStatuses.length) {
      n += 1;
    }
    if (amountMin.trim()) n += 1;
    if (amountMax.trim()) n += 1;
    if (fromDate || toDate) n += 1;
    if (debouncedQ.trim()) n += 1;
    return n;
  }, [isProductSales, productConditions, mountPhases, dataFlags, productRegion, brandId, supplierKey, serviceStatuses, amountMin, amountMax, fromDate, toDate, debouncedQ]);

  function switchSalesTab(tab: SalesPanelTabId) {
    setPage(1);
    setSalesTab(tab);
    setSortBy("sale_date");
    setSortDir("desc");
    if (tab === "products") {
      setServiceStatuses([]);
    } else {
      setProductConditions([]);
      setMountPhases([]);
      setDataFlags([]);
      setProductRegion("");
      setBrandId("");
      setSupplierKey("");
    }
  }

  function resetFilters() {
    setPage(1);
    setQ("");
    setProductConditions([]);
    setMountPhases([]);
    setDataFlags([]);
    setProductRegion("");
    setBrandId("");
    setSupplierKey("");
    setServiceStatuses([]);
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
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    sp.set("eventCode", salesPanelEventCode(salesTab));
    if (isProductSales) {
      const mountCsv = mountPhaseCsv(mountPhases);
      if (mountCsv) sp.set("mountPhase", mountCsv);
      if (supplierKey.trim()) sp.set("supplierKey", supplierKey.trim());
      if (dataFlags.includes("invoice")) sp.set("hasSupplierInvoice", "yes");
      if (dataFlags.includes("purchase")) sp.set("hasPurchasePrice", "yes");
      if (productRegion) sp.set("productRegion", productRegion);
      if (brandId) sp.set("brandId", brandId);
      const conditionCsv = productConditionCsv(productConditions);
      if (conditionCsv) sp.set("productCondition", conditionCsv);
    } else if (serviceStatuses.length > 0) {
      sp.set("statusCsv", serviceStatuses.join(","));
    }
    const min = amountMin.trim() ? Number(amountMin.replace(",", ".")) : NaN;
    const max = amountMax.trim() ? Number(amountMax.replace(",", ".")) : NaN;
    if (Number.isFinite(min)) sp.set("amountMin", String(min));
    if (Number.isFinite(max)) sp.set("amountMax", String(max));
    if (fromDate) sp.set("from", fromDate);
    if (toDate) sp.set("to", toDate);
    sp.set("page", String(page));
    sp.set("perPage", "30");
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    return sp.toString();
  }, [debouncedQ, salesTab, isProductSales, mountPhases, dataFlags, productRegion, brandId, supplierKey, amountMin, amountMax, fromDate, toDate, page, productConditions, serviceStatuses, sortBy, sortDir]);

  const reportQs = useMemo(() => {
    const sp = new URLSearchParams();
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    const mountCsv = mountPhaseCsv(mountPhases);
    if (mountCsv) sp.set("mountPhase", mountCsv);
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
    const conditionCsv = productConditionCsv(productConditions);
    if (conditionCsv) sp.set("productCondition", conditionCsv);
    return sp.toString();
  }, [debouncedQ, mountPhases, dataFlags, productRegion, brandId, supplierKey, amountMin, amountMax, fromDate, toDate, productConditions]);

  const reportFiltersHint = useMemo(() => {
    const parts: string[] = [saleProductConditionFilterLabel(productConditions)];
    if (fromDate || toDate) {
      parts.push(`${fromDate || "…"} → ${toDate || "…"}`);
    } else if (periodPreset === "month") {
      parts.push("Този месец");
    } else if (periodPreset === "90d") {
      parts.push("Последни 90 дни");
    } else if (periodPreset) {
      parts.push(`${periodPreset} г.`);
    }
    if (q.trim()) parts.push(`Търсене: „${q.trim()}“`);
    if (mountPhases.length) parts.push(`Монтаж: ${mountPhases.length} статуса`);
    if (brandId) {
      const b = brands.find((x) => x.id === brandId);
      if (b) parts.push(`Марка: ${b.name}`);
    }
    if (supplierKey) {
      const s = supplierOptions.find((x) => x.key === supplierKey);
      parts.push(`Доставчик: ${s?.label ?? supplierKey}`);
    }
    if (productRegion === "europe") parts.push("Регион: Европа");
    if (productRegion === "japan") parts.push("Регион: Япония");
    if (amountMin.trim() || amountMax.trim()) {
      parts.push(`€ ${amountMin || "0"} – ${amountMax || "∞"}`);
    }
    return parts.join(" · ");
  }, [
    productConditions,
    fromDate,
    toDate,
    periodPreset,
    q,
    mountPhases,
    brandId,
    brands,
    supplierKey,
    supplierOptions,
    productRegion,
    amountMin,
    amountMax,
  ]);

  function generateReport() {
    setReportOpen(true);
    setReportGenerateToken((t) => t + 1);
  }

  async function load() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/work-items?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
      setMeta(json.meta ?? { page: 1, perPage: 30, total: 0 });
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

  async function performComplete(row: WorkRow) {
    setActionRowId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items/${row.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleInstallState: "completed" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка");
      await load();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setActionRowId(null);
      setConfirm(null);
    }
  }

  async function performCancel(row: WorkRow, reason: SaleCancelReason) {
    setActionRowId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items/${row.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled", cancelReason: reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "Грешка");
      await load();
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setActionRowId(null);
      setConfirm(null);
      setCancelReason("");
    }
  }

  const pages = Math.max(1, Math.ceil(meta.total / meta.perPage));

  const canPendingActions = (row: WorkRow) =>
    row.sale_install_state === "pending_mount" && row.status !== "cancelled";

  function openCancelConfirm(row: WorkRow) {
    setCancelReason("");
    setConfirm({ kind: "cancel", row });
  }

  function closeConfirm() {
    if (actionRowId) return;
    setConfirm(null);
    setCancelReason("");
  }

  function handleSort(field: SortField) {
    setPage(1);
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(defaultSortDir(field));
    }
  }

  function handleServiceSort(field: ServiceSortField) {
    setPage(1);
    if (sortBy === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDir(defaultSortDir(field));
    }
  }

  const activeTabLabel = SALES_PANEL_TABS.find((t) => t.id === salesTab)?.label ?? "Продажби";

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle
            title="Панел на продажбите"
            hint={
              isProductSales
                ? "Климатици — нови и втора употреба. Отделни табове за монтаж, профилактика и сервиз."
                : `${activeTabLabel} — услуги с цена от календара. Консултациите не се показват тук.`
            }
          />
        </h1>
        <div className="flex items-center gap-2">
          {isProductSales && (
            <Button variant="primary" onClick={() => setManualSaleOpen(true)} className="gap-2 shadow-sm">
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Ръчна продажба</span>
            </Button>
          )}
          <Button variant="secondary" onClick={() => void load()} className="gap-2 shadow-sm">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Обнови</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-0.5">
        {SALES_PANEL_TABS.map((tab) => {
          const active = salesTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => switchSalesTab(tab.id)}
              className={`px-3 min-h-[44px] text-xs font-bold rounded-t-lg border-b-2 transition-colors ${
                active
                  ? "border-brand-blue-500 text-brand-blue-700 bg-brand-blue-50/60"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <Card className="p-2.5 md:p-3 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder={
              isProductSales
                ? "Клиент, телефон, продукт, сериен №, бележка, доставчик…"
                : "Клиент, телефон, заглавие, бележка…"
            }
            className="flex-1 text-sm"
          />
          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
            <span className="text-[10px] font-semibold text-slate-500 tabular-nums whitespace-nowrap">
              Намерени: <span className="text-slate-900">{meta.total}</span>
            </span>
            {activeFiltersCount > 0 && (
              <Button variant="secondary" size="sm" onClick={resetFilters} className="gap-1 !py-1 !px-2 !text-[11px]">
                <FilterX className="w-3 h-3" /> Изчисти ({activeFiltersCount})
              </Button>
            )}
          </div>
        </div>

        {isProductSales ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Състояние:</span>
            <ChipToggle
              active={productConditions.includes("new")}
              onClick={() => {
                setPage(1);
                setProductConditions((p) => toggleSaleChipFilter(p, "new"));
              }}
            >
              <span className="inline-flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Нови
              </span>
            </ChipToggle>
            <ChipToggle
              active={productConditions.includes("used")}
              tone="amber"
              onClick={() => {
                setPage(1);
                setProductConditions((p) => toggleSaleChipFilter(p, "used"));
              }}
            >
              <span className="inline-flex items-center gap-1">
                <Recycle className="w-3 h-3" />
                Втора употреба
              </span>
            </ChipToggle>
            <span className="hidden sm:inline h-4 w-px bg-slate-200 mx-0.5" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Монтаж:</span>
            <ChipToggle
              active={mountPhases.includes("pending_mount")}
              tone="warning"
              onClick={() => {
                setPage(1);
                setMountPhases((p) => toggleSaleChipFilter(p, "pending_mount"));
              }}
            >
              Чака
            </ChipToggle>
            <ChipToggle
              active={mountPhases.includes("completed")}
              tone="success"
              onClick={() => {
                setPage(1);
                setMountPhases((p) => toggleSaleChipFilter(p, "completed"));
              }}
            >
              Завършен
            </ChipToggle>
            <ChipToggle
              active={mountPhases.includes("cancelled")}
              tone="danger"
              onClick={() => {
                setPage(1);
                setMountPhases((p) => toggleSaleChipFilter(p, "cancelled"));
              }}
            >
              Отказана
            </ChipToggle>
            <span className="hidden sm:inline h-4 w-px bg-slate-200 mx-0.5" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Данни:</span>
            <ChipToggle
              active={dataFlags.includes("invoice")}
              onClick={() => {
                setPage(1);
                setDataFlags((p) => toggleSaleChipFilter(p, "invoice"));
              }}
            >
              Фактура
            </ChipToggle>
            <ChipToggle
              active={dataFlags.includes("purchase")}
              onClick={() => {
                setPage(1);
                setDataFlags((p) => toggleSaleChipFilter(p, "purchase"));
              }}
            >
              Доставна
            </ChipToggle>
            <span className="hidden sm:inline h-4 w-px bg-slate-200 mx-0.5" aria-hidden />
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
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
            <ServiceStatusChips
              statuses={serviceStatuses}
              onToggle={(s) => {
                setPage(1);
                setServiceStatuses((p) => toggleChipFilter(p, s));
              }}
              ChipToggle={ChipToggle}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mr-0.5">Период:</span>
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
          <span className="hidden sm:inline h-4 w-px bg-slate-200 mx-1" aria-hidden />
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
            className={`!w-auto min-w-[7rem] max-w-[9rem] !py-1 !text-xs ${isProductSales ? "" : "hidden"}`}
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
            className={`!w-auto min-w-[8rem] max-w-[11rem] !py-1 !text-xs ${isProductSales ? "" : "hidden"}`}
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
          {isMasterAdmin && isProductSales && (
            <Button
              variant="secondary"
              size="sm"
              onClick={generateReport}
              className="ml-auto gap-1.5 border-[#00B4D8]/35 bg-gradient-to-r from-white to-[#e6f9fd]/80 text-[#0077B6] shadow-sm hover:border-[#00B4D8]/60 hover:from-[#e6f9fd]/50"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Създай отчет
            </Button>
          )}
        </div>
      </Card>

      {isMasterAdmin && isProductSales && (
        <SalesHistoryReportPanel
          open={reportOpen}
          onClose={() => setReportOpen(false)}
          queryString={reportQs}
          sectionLabel={saleProductConditionFilterLabel(productConditions)}
          filtersHint={reportFiltersHint}
          generateToken={reportGenerateToken}
        />
      )}

      {loading && (
        <div className="flex items-center justify-center py-10 text-sm font-medium text-slate-500 gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Зареждане…
        </div>
      )}
      {!loading && error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

      {isProductSales ? (
        <>
      {/* Desktop table */}
      <div className="hidden md:block min-w-0">
        <Table
          tableClassName="table-fixed min-w-[920px]"
          className="[&_td]:!text-[11px] [&_td]:!py-1 [&_td]:!px-1"
        >
          <colgroup>
            <col className="w-[13%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[10%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[8%]" />
            <col className="w-[7%]" />
            <col className="w-[6%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[6%]" />
            <col className="w-[7.5rem]" />
          </colgroup>
          <thead>
            <tr>
              <SortableTh label="Продукт" field="product" sortBy={sortBy as SortField} sortDir={sortDir} onSort={handleSort} className={SALE_TABLE_TH} />
              <SortableTh label="Монтаж" field="sale_install_state" sortBy={sortBy as SortField} sortDir={sortDir} onSort={handleSort} className={SALE_TABLE_TH} />
              <SortableTh label="Статус" field="status" sortBy={sortBy as SortField} sortDir={sortDir} onSort={handleSort} className={SALE_TABLE_TH} />
              <SortableTh label="Контакт" field="customer_name" sortBy={sortBy as SortField} sortDir={sortDir} onSort={handleSort} className={SALE_TABLE_TH} />
              <SortableTh label="Тел." field="customer_phone" sortBy={sortBy as SortField} sortDir={sortDir} onSort={handleSort} className={SALE_TABLE_TH} />
              <Th className={`${SALE_TABLE_TH} !text-[8px]`}>Вътр.</Th>
              <Th className={`${SALE_TABLE_TH} !text-[8px]`}>Външ.</Th>
              <SortableTh label="Дост." field="supplier" sortBy={sortBy as SortField} sortDir={sortDir} onSort={handleSort} className={SALE_TABLE_TH} />
              <SortableTh label="Факт." field="supplier_invoice" sortBy={sortBy as SortField} sortDir={sortDir} onSort={handleSort} className={SALE_TABLE_TH} />
              <SortableTh label="Дост.€" field="purchase_price" sortBy={sortBy as SortField} sortDir={sortDir} onSort={handleSort} className={SALE_PRICE_TH} />
              <SortableTh label="Прод.€" field="total_amount" sortBy={sortBy as SortField} sortDir={sortDir} onSort={handleSort} className={SALE_PRICE_TH} />
              <SortableTh label="Дата" field="sale_date" sortBy={sortBy as SortField} sortDir={sortDir} onSort={handleSort} className={SALE_TABLE_TH} />
              <Th className={SALE_STICKY_ACTIONS_HEAD} aria-label="Действия" />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const productName = row.products?.name ?? "—";
              const showActions = canPendingActions(row);
              const cancelLabel = saleCancelReasonLabel(row.cancel_reason);
              return (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors group">
                  <Td className="max-w-0 truncate">
                    <ProductQuickViewButton
                      productId={row.products?.id}
                      productName={productName}
                      className="block truncate text-[11px] font-semibold text-slate-800"
                    />
                    {cancelLabel && (
                      <div className="text-[9px] text-red-700 font-medium truncate" title={cancelLabel}>
                        {cancelLabel}
                      </div>
                    )}
                  </Td>
                  <Td className="text-center">
                    <span className={tableMountPhasePillClass(row)}>{tableMountPhaseLabel(row)}</span>
                  </Td>
                  <Td className="text-center">
                    <span className={tableStatusPillClass(row.status)}>{TABLE_STATUS_TEXT[row.status]}</span>
                  </Td>
                  <Td className="max-w-0 truncate">
                    <ContactNameButton
                      name={row.customer_name}
                      contactId={contactTargetFromRow(row).contactId}
                      customerPhone={row.customer_phone}
                      onOpen={setContactHistoryTarget}
                      className="text-[11px] text-slate-700"
                    />
                  </Td>
                  <Td className="text-slate-600 max-w-0 truncate whitespace-nowrap">
                    <AdminPhoneLink phone={row.customer_phone} showIcon={false} className="font-medium text-slate-600 !text-[10px]" />
                  </Td>
                  <Td className={SALE_SERIAL_TD} title={row.products?.indoor_unit_serial ?? ""}>
                    {row.products?.indoor_unit_serial?.trim() || "—"}
                  </Td>
                  <Td className={SALE_SERIAL_TD} title={row.products?.outdoor_unit_serial ?? ""}>
                    {row.products?.outdoor_unit_serial?.trim() || "—"}
                  </Td>
                  <Td className="text-slate-600 max-w-0 truncate" title={saleSupplierName(row) ?? ""}>
                    {saleSupplierName(row) || "—"}
                  </Td>
                  <Td className="text-slate-700 max-w-0 truncate font-mono text-[10px]" title={saleSupplierInvoice(row) ?? ""}>
                    {saleSupplierInvoice(row) || "—"}
                  </Td>
                  <Td className={`${SALE_PRICE_TD} text-slate-700`}>
                    {row.purchase_price != null ? `€${Number(row.purchase_price).toLocaleString()}` : "—"}
                  </Td>
                  <Td className={`${SALE_PRICE_TD} text-slate-900`}>
                    {row.total_amount != null
                      ? `€${Number(row.total_amount).toLocaleString()}`
                      : row.unit_price != null
                        ? `€${Number(row.unit_price).toLocaleString()}`
                        : "—"}
                  </Td>
                  <Td className="text-[10px] text-slate-500 font-medium whitespace-nowrap tabular-nums">
                    {saleDateDisplay(row)}
                  </Td>
                  <Td className={`${SALE_STICKY_ACTIONS} group-hover:bg-slate-50 text-right`}>
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="!text-[10px] font-bold whitespace-nowrap"
                        onClick={() => setDetailSaleId(row.id)}
                      >
                        <Eye className="w-3.5 h-3.5 inline mr-1" />
                        Детайли
                      </Button>
                      {showActions && (
                        <>
                          <Button
                            variant="secondary"
                            size="sm"
                            className="!text-[10px] font-bold whitespace-nowrap"
                            disabled={actionRowId === row.id}
                            onClick={() => setConfirm({ kind: "complete", row })}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                            Завърши
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="!text-[10px] font-bold whitespace-nowrap"
                            disabled={actionRowId === row.id}
                            onClick={() => openCancelConfirm(row)}
                          >
                            <Ban className="w-3.5 h-3.5 inline mr-1" />
                            Отказ
                          </Button>
                        </>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <Td colSpan={13} className="text-center py-8 text-slate-500">
                  {emptySalesMessage(productConditions)}
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Mobile card list */}
      <div className="md:hidden space-y-2">
        {items.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 text-center text-slate-500 text-sm">
            {emptySalesMessage(productConditions)}
          </div>
        )}
        {items.map((row) => {
          const amount = row.total_amount != null ? row.total_amount : row.unit_price;
          const productName = row.products?.name ?? "—";
          const showActions = canPendingActions(row);
          const cancelLabel = saleCancelReasonLabel(row.cancel_reason);
          return (
            <div key={row.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <ProductQuickViewButton
                    productId={row.products?.id}
                    productName={productName}
                    className="block truncate text-[11px] font-bold uppercase text-slate-500"
                  />
                  <ContactNameButton
                    name={row.customer_name || "Неизвестен клиент"}
                    contactId={contactTargetFromRow(row).contactId}
                    customerPhone={row.customer_phone}
                    onOpen={setContactHistoryTarget}
                    className="font-bold text-slate-900 text-sm block"
                  />
                  {row.customer_phone && (
                    <AdminPhoneLink
                      phone={row.customer_phone}
                      className="text-xs font-medium mt-0.5 block"
                      showIcon={false}
                    />
                  )}
                  {(row.products?.indoor_unit_serial || row.products?.outdoor_unit_serial) && (
                    <div className="text-[8px] font-mono text-slate-500 mt-0.5 flex flex-wrap gap-x-2 gap-y-0 leading-none">
                      {row.products?.indoor_unit_serial?.trim() && (
                        <span className="truncate max-w-full" title={row.products.indoor_unit_serial}>
                          В: {row.products.indoor_unit_serial.trim()}
                        </span>
                      )}
                      {row.products?.outdoor_unit_serial?.trim() && (
                        <span className="truncate max-w-full" title={row.products.outdoor_unit_serial}>
                          Вн: {row.products.outdoor_unit_serial.trim()}
                        </span>
                      )}
                    </div>
                  )}
                  {cancelLabel && <div className="text-[11px] text-red-700 font-semibold mt-1">{cancelLabel}</div>}
                </div>
                <div className="text-right shrink-0">
                  {amount != null ? (
                    <div className="text-lg font-black text-slate-900">€{Number(amount).toLocaleString()}</div>
                  ) : (
                    <div className="text-sm text-slate-400">—</div>
                  )}
                  <div className="mt-1 flex flex-col items-end gap-1">
                    <span className={mountPhasePillClass(row)}>{mountPhaseLabel(row)}</span>
                    <span className={statusPillClass(row.status)}>{STATUS_TEXT[row.status]}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Продажба
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  Продажба: {saleDateDisplay(row)}
                </span>
              </div>
              {(saleSupplierName(row) || saleSupplierInvoice(row)) && (
                <div className="text-[11px] text-slate-500 pt-1">
                  {saleSupplierName(row) && <>Доставчик: {saleSupplierName(row)}</>}
                  {saleSupplierName(row) && saleSupplierInvoice(row) && " · "}
                  {saleSupplierInvoice(row) && <>Фактура: {saleSupplierInvoice(row)}</>}
                </div>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" className="font-bold !text-xs col-span-2" onClick={() => setDetailSaleId(row.id)}>
                  Детайли
                </Button>
                {showActions && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="font-bold !text-xs"
                      disabled={actionRowId === row.id}
                      onClick={() => setConfirm({ kind: "complete", row })}
                    >
                      Завърши
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      className="font-bold !text-xs"
                      disabled={actionRowId === row.id}
                      onClick={() => openCancelConfirm(row)}
                    >
                      Отказ
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
        </>
      ) : (
        <ServiceSalesTable
          items={items}
          sortBy={sortBy as ServiceSortField}
          sortDir={sortDir}
          onSort={handleServiceSort}
          onDetail={setDetailServiceId}
          onContactOpen={setContactHistoryTarget}
          emptyMessage={emptyServiceMessage(salesTab)}
        />
      )}

      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-500 font-medium">
          {isProductSales ? saleProductConditionFilterLabel(productConditions) : activeTabLabel} · общо: {meta.total}
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

      <SaleDetailModal saleId={detailSaleId} onClose={() => setDetailSaleId(null)} onChanged={() => void load()} />
      <ServiceDetailModal serviceId={detailServiceId} onClose={() => setDetailServiceId(null)} />
      <ContactHistoryModal target={contactHistoryTarget} onClose={() => setContactHistoryTarget(null)} />

      <ManualSaleModal
        open={manualSaleOpen}
        section={manualSaleSection}
        onClose={() => setManualSaleOpen(false)}
        onSuccess={() => void load()}
      />

      {confirm && (
        <div
          className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-slate-950/50 p-0 md:p-4 backdrop-blur-sm"
          onClick={closeConfirm}
        >
          <div
            className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-t-3xl md:rounded-2xl border border-slate-200 bg-white shadow-2xl p-5 pb-safe md:pb-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pb-2 md:hidden">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>
            <div className="text-lg font-black text-slate-900">
              {confirm.kind === "complete" ? "Потвърждение: завършване" : "Потвърждение: отказ"}
            </div>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              {confirm.kind === "complete" ? (
                <>
                  Сигурни ли сте, че монтажът е извършен? Статусът на продажбата ще стане <strong>завършен</strong>, а задачата за монтаж в
                  календара — <strong>изпълнена</strong>.
                </>
              ) : (
                <>
                  Сигурни ли сте, че искате да <strong>откажете</strong> тази продажа (чака монтаж)? Продажбата и свързаният монтаж в календара
                  ще бъдат маркирани като <strong>отказани</strong>, а климатикът ще се върне като <strong>наличен</strong> в списъка с продукти.
                </>
              )}
            </p>
            <div className="mt-1 text-xs font-semibold text-slate-500 truncate" title={confirm.row.products?.name ?? confirm.row.title}>
              {confirm.row.products?.name ?? confirm.row.title}
            </div>

            {confirm.kind === "cancel" && (
              <div className="mt-4 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wide text-slate-600">Причина за отказ *</div>
                {SALE_CANCEL_REASONS.map((reason) => (
                  <label
                    key={reason}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                      cancelReason === reason
                        ? "border-red-300 bg-red-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="radio"
                      name="cancelReason"
                      value={reason}
                      checked={cancelReason === reason}
                      onChange={() => setCancelReason(reason)}
                      className="accent-red-600"
                    />
                    <span className="text-sm font-medium text-slate-800">{SALE_CANCEL_REASON_LABELS[reason]}</span>
                  </label>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="secondary" type="button" disabled={actionRowId !== null} onClick={closeConfirm}>
                Назад
              </Button>
              <Button
                variant={confirm.kind === "cancel" ? "danger" : "primary"}
                type="button"
                disabled={actionRowId !== null || (confirm.kind === "cancel" && !cancelReason)}
                onClick={() => {
                  if (confirm.kind === "complete") void performComplete(confirm.row);
                  else if (cancelReason) void performCancel(confirm.row, cancelReason);
                }}
              >
                {actionRowId ? (
                  <span className="inline-flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Изпълнение…
                  </span>
                ) : (
                  "Потвърди"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
