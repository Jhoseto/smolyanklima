"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { SectionTitle, Card, Input, Select, Button, Table, Th, Td } from "../ui";
import { RefreshCw, CheckCircle2, Ban, Eye, ArrowUpDown, ArrowUp, ArrowDown, Sparkles, Recycle, FilterX, Plus } from "lucide-react";
import { ProductQuickViewButton } from "../ProductQuickView";
import { SaleDetailModal } from "./SaleDetailModal";
import { ManualSaleModal } from "./ManualSaleModal";
import {
  SALE_CANCEL_REASONS,
  SALE_CANCEL_REASON_LABELS,
  saleCancelReasonLabel,
  type SaleCancelReason,
} from "@/lib/admin/saleCancelReason";
import { saleSupplierInvoice, saleSupplierName } from "@/lib/admin/saleWorkItemMeta";
import {
  mountPhaseCsv,
  toggleSaleChipFilter,
  type SaleDataFlagFilter,
  type SaleMountPhaseFilter,
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
  products?: {
    id?: string;
    name?: string;
    slug?: string;
    model_code?: string | null;
    product_condition?: "new" | "used" | null;
    supplier_invoice_number?: string | null;
  } | null;
};

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
  | "customer_address"
  | "supplier"
  | "supplier_invoice"
  | "purchase_price"
  | "total_amount"
  | "sale_date";

type SortDir = "asc" | "desc";

const DATE_DESC_FIELDS: SortField[] = ["sale_date", "purchase_price", "total_amount"];
const TEXT_ASC_FIELDS: SortField[] = [
  "product",
  "customer_name",
  "customer_phone",
  "customer_address",
  "supplier",
  "supplier_invoice",
  "sale_install_state",
  "status",
];

function defaultSortDir(field: SortField): SortDir {
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
  return (
    <Th className={`p-0 ${className}`}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`w-full px-3 py-2 inline-flex items-center gap-0.5 text-left text-xs font-bold transition-colors hover:bg-slate-100 ${
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

export default function AdminHistoryPage() {
  const [section, setSection] = useState<SaleSection>("new");
  const [items, setItems] = useState<WorkRow[]>([]);
  const [q, setQ] = useState("");
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
  const [cancelReason, setCancelReason] = useState<SaleCancelReason | "">("");
  const [detailSaleId, setDetailSaleId] = useState<string | null>(null);
  const [manualSaleOpen, setManualSaleOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortField>("sale_date");
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
    if (mountPhases.length) n += 1;
    if (dataFlags.length) n += dataFlags.length;
    if (productRegion) n += 1;
    if (brandId) n += 1;
    if (supplierKey) n += 1;
    if (amountMin.trim()) n += 1;
    if (amountMax.trim()) n += 1;
    if (fromDate || toDate) n += 1;
    if (q.trim()) n += 1;
    return n;
  }, [mountPhases, dataFlags, productRegion, brandId, supplierKey, amountMin, amountMax, fromDate, toDate, q]);

  function resetFilters() {
    setPage(1);
    setQ("");
    setMountPhases([]);
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
    sp.set("eventCode", "sale");
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
    sp.set("page", String(page));
    sp.set("perPage", "30");
    sp.set("productCondition", section);
    sp.set("sortBy", sortBy);
    sp.set("sortDir", sortDir);
    return sp.toString();
  }, [q, mountPhases, dataFlags, productRegion, brandId, supplierKey, amountMin, amountMax, fromDate, toDate, page, section, sortBy, sortDir]);

  async function load() {
    setError(null);
    try {
      const res = await fetch(`/api/admin/work-items?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Грешка");
      setItems(json.data ?? []);
      setMeta(json.meta ?? { page: 1, perPage: 30, total: 0 });
    } catch (e: unknown) {
      setError(String(e instanceof Error ? e.message : e));
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

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 leading-tight">
          <SectionTitle
            title="Панел на продажбите"
            hint="Разделено на нови и втора употреба. Статус по монтаж: чака монтаж / завършен / отказана."
          />
        </h1>
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={() => setManualSaleOpen(true)} className="gap-2 shadow-sm">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Ръчна продажба</span>
          </Button>
          <Button variant="secondary" onClick={() => void load()} className="gap-2 shadow-sm">
            <RefreshCw className="w-4 h-4" />
            <span className="hidden sm:inline">Обнови</span>
          </Button>
        </div>
      </div>

      <div className="flex rounded-xl border border-slate-200 p-0.5 bg-white w-full sm:w-auto sm:min-w-[320px] shadow-sm">
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setSection("new");
          }}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-colors ${
            section === "new"
              ? "bg-brand-blue-500 text-white shadow-sm"
              : "text-slate-500 hover:bg-brand-blue-50 hover:text-brand-blue-700"
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Нови
        </button>
        <button
          type="button"
          onClick={() => {
            setPage(1);
            setSection("used");
          }}
          className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-xs font-bold transition-colors ${
            section === "used"
              ? "bg-amber-600 text-white shadow-sm"
              : "text-slate-500 hover:bg-amber-50 hover:text-amber-800"
          }`}
        >
          <Recycle className="w-3.5 h-3.5" />
          Втора употреба
        </button>
      </div>

      <Card className="p-2.5 md:p-3 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <Input
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
            placeholder="Клиент, телефон, продукт, бележка, доставчик, фактура…"
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

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
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

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm font-medium">{error}</div>}

      {/* Desktop table */}
      <div className="hidden md:block">
        <Table>
          <thead>
            <tr>
              <SortableTh label="Продукт" field="product" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Статус монтаж" field="sale_install_state" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Оперативен" field="status" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Контакт" field="customer_name" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Телефон" field="customer_phone" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Адрес" field="customer_address" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Доставчик" field="supplier" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Фактура" field="supplier_invoice" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Доставна" field="purchase_price" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Продажна" field="total_amount" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <SortableTh label="Дата продажба" field="sale_date" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {items.map((row) => {
              const productName = row.products?.name ?? "—";
              const showActions = canPendingActions(row);
              const cancelLabel = saleCancelReasonLabel(row.cancel_reason);
              return (
                <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                  <Td className="max-w-[200px] min-w-0">
                    <ProductQuickViewButton
                      productId={row.products?.id}
                      productName={productName}
                      className="block truncate text-sm font-semibold text-slate-800"
                    />
                    {cancelLabel && (
                      <div className="text-[10px] text-red-700 font-medium mt-0.5 truncate" title={cancelLabel}>
                        {cancelLabel}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <span className={mountPhasePillClass(row)}>{mountPhaseLabel(row)}</span>
                  </Td>
                  <Td>
                    <span className={statusPillClass(row.status)}>{STATUS_TEXT[row.status]}</span>
                  </Td>
                  <Td className="font-medium text-slate-700">{row.customer_name || "—"}</Td>
                  <Td className="text-slate-600">{row.customer_phone || "—"}</Td>
                  <Td className="text-slate-600 max-w-[180px] truncate" title={row.customer_address ?? ""}>
                    {row.customer_address || "—"}
                  </Td>
                  <Td className="text-slate-600 max-w-[120px] truncate" title={saleSupplierName(row) ?? ""}>
                    {saleSupplierName(row) || "—"}
                  </Td>
                  <Td className="text-slate-700 max-w-[100px] truncate font-mono text-[11px]" title={saleSupplierInvoice(row) ?? ""}>
                    {saleSupplierInvoice(row) || "—"}
                  </Td>
                  <Td className="font-semibold text-slate-700">
                    {row.purchase_price != null ? `€${Number(row.purchase_price).toLocaleString()}` : "—"}
                  </Td>
                  <Td className="font-semibold text-slate-900">
                    {row.total_amount != null
                      ? `€${Number(row.total_amount).toLocaleString()}`
                      : row.unit_price != null
                        ? `€${Number(row.unit_price).toLocaleString()}`
                        : "—"}
                  </Td>
                  <Td className="text-xs text-slate-500 font-medium">
                    {saleDateDisplay(row)}
                  </Td>
                  <Td className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="!text-xs font-bold"
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
                            className="!text-xs font-bold"
                            disabled={actionRowId === row.id}
                            onClick={() => setConfirm({ kind: "complete", row })}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                            Завърши
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            className="!text-xs font-bold"
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
                <Td colSpan={11} className="text-center py-8 text-slate-500">
                  {section === "new" ? "Няма продажби на нови продукти." : "Няма продажби на втора употреба."}
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
            {section === "new" ? "Няма продажби на нови продукти." : "Няма продажби на втора употреба."}
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
                  <div className="font-bold text-slate-900 text-sm">{row.customer_name || "Неизвестен клиент"}</div>
                  {row.customer_phone && (
                    <a href={`tel:${row.customer_phone}`} className="text-xs text-brand-blue-500 font-medium mt-0.5 block">
                      {row.customer_phone}
                    </a>
                  )}
                  {row.customer_address && <div className="text-xs text-slate-500 mt-0.5">{row.customer_address}</div>}
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

      <div className="flex justify-between items-center">
        <span className="text-sm text-slate-500 font-medium">
          {section === "new" ? "Нови" : "Втора употреба"} · общо: {meta.total}
        </span>
        <div className="flex items-center gap-2 md:gap-3">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            ‹ Пред.
          </Button>
          <span className="text-sm font-medium text-slate-600">
            {page} / {pages}
          </span>
          <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Следв. ›
          </Button>
        </div>
      </div>

      <SaleDetailModal saleId={detailSaleId} onClose={() => setDetailSaleId(null)} onChanged={() => void load()} />

      {manualSaleOpen && (
        <ManualSaleModal
          section={section}
          onClose={() => setManualSaleOpen(false)}
          onSuccess={() => void load()}
        />
      )}

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
