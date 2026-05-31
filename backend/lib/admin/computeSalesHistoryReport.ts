export type SaleReportRow = {
  id: string;
  status: string;
  sale_install_state?: "pending_mount" | "completed" | null;
  total_amount?: number | null;
  purchase_price?: number | null;
  supplier_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  due_date?: string | null;
  completed_at?: string | null;
  products?: {
    name?: string | null;
    brands?: { name?: string | null } | { name?: string | null }[] | null;
  } | null;
};

export type SalesHistoryReport = {
  totalMatching: number;
  sampledCount: number;
  truncated: boolean;
  summary: {
    saleCount: number;
    totalRevenue: number;
    totalPurchase: number;
    totalMargin: number;
    marginPercent: number | null;
    avgSale: number;
    avgPurchase: number | null;
    avgMargin: number | null;
    cancelledCount: number;
    pendingMountCount: number;
    completedMountCount: number;
    withInvoiceData: number;
    withPurchaseData: number;
    uniqueCustomers: number;
    minSale: number | null;
    maxSale: number | null;
  };
  byMonth: Array<{ month: string; label: string; count: number; revenue: number; purchase: number; margin: number }>;
  byMountPhase: Array<{ key: string; label: string; count: number }>;
  byOperationalStatus: Array<{ key: string; label: string; count: number }>;
  bySupplier: Array<{ name: string; count: number; revenue: number }>;
  byBrand: Array<{ name: string; count: number; revenue: number }>;
  byProduct: Array<{ name: string; count: number; revenue: number }>;
  priceBuckets: Array<{ label: string; count: number }>;
  revenueVsPurchaseMonthly: Array<{ month: string; label: string; revenue: number; purchase: number }>;
};

function brandName(row: SaleReportRow): string | null {
  const b = row.products?.brands;
  if (!b) return null;
  const one = Array.isArray(b) ? b[0] : b;
  const n = one?.name?.trim();
  return n || null;
}

function productName(row: SaleReportRow): string {
  return row.products?.name?.trim() || "Без продукт";
}

function saleDateKey(row: SaleReportRow): string | null {
  const raw = row.completed_at ?? row.due_date ?? null;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString("bg-BG", { month: "short", year: "numeric" });
}

function mountPhaseKey(row: SaleReportRow): "pending_mount" | "completed" | "cancelled" | "other" {
  if (row.status === "cancelled") return "cancelled";
  if (row.sale_install_state === "pending_mount") return "pending_mount";
  if (row.sale_install_state === "completed" || row.status === "done") return "completed";
  return "other";
}

const MOUNT_LABELS: Record<string, string> = {
  pending_mount: "Чака монтаж",
  completed: "Завършен",
  cancelled: "Отказана",
  other: "Други",
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Планирана",
  in_progress: "В процес",
  done: "Изпълнена",
  cancelled: "Отказана",
};

function bumpMap(map: Map<string, number>, key: string, delta = 1) {
  map.set(key, (map.get(key) ?? 0) + delta);
}

function bumpAgg(
  map: Map<string, { count: number; revenue: number }>,
  key: string,
  revenue: number,
) {
  const cur = map.get(key) ?? { count: 0, revenue: 0 };
  map.set(key, { count: cur.count + 1, revenue: cur.revenue + revenue });
}

export function computeSalesHistoryReport(
  rows: SaleReportRow[],
  totalMatching: number,
): SalesHistoryReport {
  let totalRevenue = 0;
  let totalPurchase = 0;
  let purchaseRows = 0;
  let cancelledCount = 0;
  let pendingMountCount = 0;
  let completedMountCount = 0;
  let minSale: number | null = null;
  let maxSale: number | null = null;
  const customerKeys = new Set<string>();

  const monthMap = new Map<string, { count: number; revenue: number; purchase: number }>();
  const mountMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  const supplierMap = new Map<string, { count: number; revenue: number }>();
  const brandMap = new Map<string, { count: number; revenue: number }>();
  const productMap = new Map<string, { count: number; revenue: number }>();
  const bucketMap = new Map<string, number>();

  const BUCKETS = [
    { max: 500, label: "до €500" },
    { max: 800, label: "€500–800" },
    { max: 1200, label: "€800–1200" },
    { max: 2000, label: "€1200–2000" },
    { max: Infinity, label: "€2000+" },
  ];

  for (const row of rows) {
    const revenue = Number(row.total_amount ?? 0);
    const purchase = row.purchase_price != null && Number.isFinite(Number(row.purchase_price)) ? Number(row.purchase_price) : null;

    totalRevenue += revenue;
    if (purchase != null) {
      totalPurchase += purchase;
      purchaseRows += 1;
    }

    if (row.status === "cancelled") cancelledCount += 1;
    const mp = mountPhaseKey(row);
    bumpMap(mountMap, mp);
    if (mp === "pending_mount") pendingMountCount += 1;
    if (mp === "completed") completedMountCount += 1;

    bumpMap(statusMap, row.status || "planned");

    const cust = (row.customer_phone ?? row.customer_name ?? "").trim().toLowerCase();
    if (cust) customerKeys.add(cust);

    if (Number.isFinite(revenue)) {
      minSale = minSale == null ? revenue : Math.min(minSale, revenue);
      maxSale = maxSale == null ? revenue : Math.max(maxSale, revenue);
      for (const b of BUCKETS) {
        if (revenue <= b.max) {
          bumpMap(bucketMap, b.label);
          break;
        }
      }
    }

    const month = saleDateKey(row);
    if (month) {
      const cur = monthMap.get(month) ?? { count: 0, revenue: 0, purchase: 0 };
      monthMap.set(month, {
        count: cur.count + 1,
        revenue: cur.revenue + revenue,
        purchase: cur.purchase + (purchase ?? 0),
      });
    }

    const supplier = row.supplier_name?.trim() || "Без доставчик";
    bumpAgg(supplierMap, supplier, revenue);

    const brand = brandName(row) || "Без марка";
    bumpAgg(brandMap, brand, revenue);

    bumpAgg(productMap, productName(row), revenue);
  }

  const saleCount = rows.length;
  const totalMargin = totalPurchase > 0 || purchaseRows > 0 ? totalRevenue - totalPurchase : 0;
  const marginPercent =
    purchaseRows > 0 && totalPurchase > 0 ? Math.round((totalMargin / totalRevenue) * 1000) / 10 : null;

  const byMonth = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      label: monthLabel(month),
      count: v.count,
      revenue: Math.round(v.revenue * 100) / 100,
      purchase: Math.round(v.purchase * 100) / 100,
      margin: Math.round((v.revenue - v.purchase) * 100) / 100,
    }));

  const topN = <T extends { revenue: number }>(arr: T[], n: number) =>
    [...arr].sort((a, b) => b.revenue - a.revenue).slice(0, n);

  return {
    totalMatching,
    sampledCount: saleCount,
    truncated: totalMatching > saleCount,
    summary: {
      saleCount,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalPurchase: Math.round(totalPurchase * 100) / 100,
      totalMargin: Math.round(totalMargin * 100) / 100,
      marginPercent,
      avgSale: saleCount ? Math.round((totalRevenue / saleCount) * 100) / 100 : 0,
      avgPurchase: purchaseRows ? Math.round((totalPurchase / purchaseRows) * 100) / 100 : null,
      avgMargin: purchaseRows ? Math.round((totalMargin / purchaseRows) * 100) / 100 : null,
      cancelledCount,
      pendingMountCount,
      completedMountCount,
      withInvoiceData: 0,
      withPurchaseData: purchaseRows,
      uniqueCustomers: customerKeys.size,
      minSale,
      maxSale,
    },
    byMonth,
    byMountPhase: [...mountMap.entries()].map(([key, count]) => ({
      key,
      label: MOUNT_LABELS[key] ?? key,
      count,
    })),
    byOperationalStatus: [...statusMap.entries()].map(([key, count]) => ({
      key,
      label: STATUS_LABELS[key] ?? key,
      count,
    })),
    bySupplier: topN(
      [...supplierMap.entries()].map(([name, v]) => ({ name, count: v.count, revenue: Math.round(v.revenue * 100) / 100 })),
      8,
    ),
    byBrand: topN(
      [...brandMap.entries()].map(([name, v]) => ({ name, count: v.count, revenue: Math.round(v.revenue * 100) / 100 })),
      8,
    ),
    byProduct: topN(
      [...productMap.entries()].map(([name, v]) => ({ name, count: v.count, revenue: Math.round(v.revenue * 100) / 100 })),
      8,
    ),
    priceBuckets: BUCKETS.map((b) => ({ label: b.label, count: bucketMap.get(b.label) ?? 0 })).filter((b) => b.count > 0),
    revenueVsPurchaseMonthly: byMonth.map((m) => ({
      month: m.month,
      label: m.label,
      revenue: m.revenue,
      purchase: m.purchase,
    })),
  };
}
