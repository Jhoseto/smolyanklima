import { canonicalPhoneDigits } from "@/lib/admin/phoneSearchPattern";

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

export type SalesReportClientRow = {
  key: string;
  name: string;
  phone: string | null;
  count: number;
  revenue: number;
  purchase: number;
  margin: number;
  avgSale: number;
  revenueSharePercent: number;
  marginPercent: number | null;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  pendingMountCount: number;
  completedCount: number;
  cancelledCount: number;
  topBrand: string | null;
  topProduct: string | null;
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
    topClientsRevenue: number;
    topClientsRevenueSharePercent: number | null;
  };
  byMonth: Array<{ month: string; label: string; count: number; revenue: number; purchase: number; margin: number }>;
  byMountPhase: Array<{ key: string; label: string; count: number }>;
  byOperationalStatus: Array<{ key: string; label: string; count: number }>;
  bySupplier: Array<{ name: string; count: number; revenue: number }>;
  byBrand: Array<{ name: string; count: number; revenue: number }>;
  byProduct: Array<{ name: string; count: number; revenue: number }>;
  topClients: SalesReportClientRow[];
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

function saleDateIso(row: SaleReportRow): string | null {
  return row.completed_at ?? row.due_date ?? null;
}

function clientGroupKey(row: SaleReportRow): string {
  const phone = canonicalPhoneDigits(row.customer_phone);
  if (phone.length >= 8) return `p:${phone}`;
  const name = row.customer_name?.trim().toLowerCase();
  if (name && name.length >= 2) return `n:${name}`;
  return `u:${row.id}`;
}

function displayClientName(row: SaleReportRow): string {
  const name = row.customer_name?.trim();
  if (name) return name;
  const phone = row.customer_phone?.trim();
  if (phone) return phone;
  return "Без име";
}

function displayClientPhone(row: SaleReportRow): string | null {
  const phone = row.customer_phone?.trim();
  return phone || null;
}

function bumpCountMap(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function topKeyFromCountMap(map: Map<string, number>): string | null {
  let best: string | null = null;
  let bestCount = 0;
  for (const [key, count] of map) {
    if (count > bestCount) {
      best = key;
      bestCount = count;
    }
  }
  return best;
}

type ClientAgg = {
  key: string;
  name: string;
  phone: string | null;
  count: number;
  revenue: number;
  purchase: number;
  purchaseRows: number;
  pendingMountCount: number;
  completedCount: number;
  cancelledCount: number;
  firstSaleDate: string | null;
  lastSaleDate: string | null;
  brandCounts: Map<string, number>;
  productCounts: Map<string, number>;
};

function bumpClientAgg(map: Map<string, ClientAgg>, row: SaleReportRow, revenue: number, purchase: number | null) {
  const key = clientGroupKey(row);
  const cur =
    map.get(key) ??
    ({
      key,
      name: displayClientName(row),
      phone: displayClientPhone(row),
      count: 0,
      revenue: 0,
      purchase: 0,
      purchaseRows: 0,
      pendingMountCount: 0,
      completedCount: 0,
      cancelledCount: 0,
      firstSaleDate: null,
      lastSaleDate: null,
      brandCounts: new Map(),
      productCounts: new Map(),
    } satisfies ClientAgg);

  cur.count += 1;
  cur.revenue += revenue;
  if (purchase != null) {
    cur.purchase += purchase;
    cur.purchaseRows += 1;
  }

  const rowName = row.customer_name?.trim();
  if (rowName && (rowName.length > cur.name.length || cur.name === "Без име")) {
    cur.name = rowName;
  }
  const rowPhone = displayClientPhone(row);
  if (rowPhone && !cur.phone) cur.phone = rowPhone;

  const mp = mountPhaseKey(row);
  if (mp === "pending_mount") cur.pendingMountCount += 1;
  if (mp === "completed") cur.completedCount += 1;
  if (mp === "cancelled") cur.cancelledCount += 1;

  const saleDate = saleDateIso(row);
  if (saleDate) {
    if (!cur.firstSaleDate || saleDate < cur.firstSaleDate) cur.firstSaleDate = saleDate;
    if (!cur.lastSaleDate || saleDate > cur.lastSaleDate) cur.lastSaleDate = saleDate;
  }

  const brand = brandName(row);
  if (brand) bumpCountMap(cur.brandCounts, brand);
  bumpCountMap(cur.productCounts, productName(row));

  map.set(key, cur);
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

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
  const clientMap = new Map<string, ClientAgg>();

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

    const custKey = clientGroupKey(row);
    if (!custKey.startsWith("u:")) customerKeys.add(custKey);
    bumpClientAgg(clientMap, row, revenue, purchase);

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

  const topNByCount = <T extends { count: number }>(arr: T[], n: number) =>
    [...arr].sort((a, b) => b.count - a.count).slice(0, n);

  const topClients: SalesReportClientRow[] = [...clientMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 20)
    .map((c) => {
      const margin = c.purchaseRows > 0 ? c.revenue - c.purchase : 0;
      return {
        key: c.key,
        name: c.name,
        phone: c.phone,
        count: c.count,
        revenue: roundMoney(c.revenue),
        purchase: roundMoney(c.purchase),
        margin: roundMoney(margin),
        avgSale: c.count ? roundMoney(c.revenue / c.count) : 0,
        revenueSharePercent: totalRevenue > 0 ? roundMoney((c.revenue / totalRevenue) * 1000) / 10 : 0,
        marginPercent:
          c.purchaseRows > 0 && c.revenue > 0 ? roundMoney((margin / c.revenue) * 1000) / 10 : null,
        firstSaleDate: c.firstSaleDate,
        lastSaleDate: c.lastSaleDate,
        pendingMountCount: c.pendingMountCount,
        completedCount: c.completedCount,
        cancelledCount: c.cancelledCount,
        topBrand: topKeyFromCountMap(c.brandCounts),
        topProduct: topKeyFromCountMap(c.productCounts),
      };
    });

  const topClientsRevenue = roundMoney(topClients.reduce((acc, c) => acc + c.revenue, 0));
  const topClientsRevenueSharePercent =
    totalRevenue > 0 ? roundMoney((topClientsRevenue / totalRevenue) * 1000) / 10 : null;

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
      topClientsRevenue,
      topClientsRevenueSharePercent,
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
    byProduct: topNByCount(
      [...productMap.entries()].map(([name, v]) => ({ name, count: v.count, revenue: Math.round(v.revenue * 100) / 100 })),
      8,
    ),
    topClients,
    priceBuckets: BUCKETS.map((b) => ({ label: b.label, count: bucketMap.get(b.label) ?? 0 })).filter((b) => b.count > 0),
    revenueVsPurchaseMonthly: byMonth.map((m) => ({
      month: m.month,
      label: m.label,
      revenue: m.revenue,
      purchase: m.purchase,
    })),
  };
}
