import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { buildAdminSearchOrFilter } from "@/lib/admin/phoneSearchPattern";
import { parseMountPhaseCsv, parseProductConditionCsv } from "@/lib/admin/salesHistoryQueryFilters";
import { supplierFilterOrClause, normalizeSupplierKey } from "@/lib/admin/supplierNameNormalize";
import { computeSalesHistoryReport, type SaleReportRow, type SalesHistoryReport } from "@/lib/admin/computeSalesHistoryReport";

export const SalesReportQuerySchema = z.object({
  q: z.string().optional(),
  productCondition: z.string().optional(),
  mountPhase: z.string().optional(),
  supplierKey: z.string().max(160).optional(),
  supplierName: z.string().max(160).optional(),
  hasSupplierInvoice: z.enum(["yes", "no"]).optional(),
  hasPurchasePrice: z.enum(["yes", "no"]).optional(),
  brandId: z.string().uuid().optional(),
  productRegion: z.enum(["europe", "japan"]).optional(),
  amountMin: z.coerce.number().nonnegative().optional(),
  amountMax: z.coerce.number().nonnegative().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type SalesReportQuery = z.infer<typeof SalesReportQuerySchema>;

const REPORT_BATCH = 500;
const REPORT_MAX_ROWS = 5000;

export async function fetchSalesHistoryReport(
  supabase: SupabaseClient,
  query: SalesReportQuery,
): Promise<SalesHistoryReport> {
  const {
    q,
    productCondition,
    mountPhase,
    supplierKey,
    supplierName,
    hasSupplierInvoice,
    hasPurchasePrice,
    brandId,
    productRegion,
    amountMin,
    amountMax,
    from,
    to,
  } = query;

  const mountPhases = parseMountPhaseCsv(mountPhase);
  const needsProductInner = Boolean(brandId || productRegion);
  const productEmbed = needsProductInner
    ? `products:product_id!inner(name, brands:brand_id(name))`
    : `products:product_id(name, brands:brand_id(name))`;
  const selectFields = [
    "id",
    "status",
    "sale_install_state",
    "total_amount",
    "purchase_price",
    "supplier_name",
    "supplier_invoice_number",
    "customer_name",
    "customer_phone",
    "due_date",
    "completed_at",
    productEmbed,
  ].join(",");

  let dbQuery = supabase
    .from("work_items")
    .select(selectFields, { count: "exact" })
    .eq("event_code", "sale")
    .order("due_date", { ascending: true, nullsFirst: true });

  if (q?.trim()) {
    const orFilter = buildAdminSearchOrFilter(q, {
      textFields: [
        "title",
        "notes",
        "customer_name",
        "customer_phone",
        "customer_address",
        "supplier_name",
        "supplier_invoice_number",
      ],
      phoneFields: ["customer_phone"],
    });
    if (orFilter) dbQuery = dbQuery.or(orFilter);
  }

  if (mountPhases.length > 0) {
    const orParts: string[] = [];
    if (mountPhases.includes("pending_mount")) orParts.push("sale_install_state.eq.pending_mount");
    if (mountPhases.includes("completed")) orParts.push("sale_install_state.eq.completed");
    if (mountPhases.includes("cancelled")) orParts.push("status.eq.cancelled");
    if (orParts.length > 0) dbQuery = dbQuery.or(orParts.join(","));
  }

  if (productCondition) {
    const productConditions = parseProductConditionCsv(productCondition);
    if (productConditions.length === 1) {
      dbQuery = dbQuery.eq("sale_product_condition", productConditions[0]);
    } else if (productConditions.length > 1) {
      dbQuery = dbQuery.in("sale_product_condition", productConditions);
    }
  }
  if (brandId) dbQuery = dbQuery.eq("products.brand_id", brandId);
  if (productRegion) dbQuery = dbQuery.eq("products.product_region", productRegion);

  const supplierFilterRaw = (supplierKey ?? supplierName)?.trim();
  if (supplierFilterRaw) {
    dbQuery = dbQuery.or(supplierFilterOrClause(normalizeSupplierKey(supplierFilterRaw)));
  }

  if (hasSupplierInvoice === "yes") {
    dbQuery = dbQuery.not("supplier_invoice_number", "is", null).neq("supplier_invoice_number", "");
  } else if (hasSupplierInvoice === "no") {
    dbQuery = dbQuery.or("supplier_invoice_number.is.null,supplier_invoice_number.eq.");
  }

  if (hasPurchasePrice === "yes") dbQuery = dbQuery.not("purchase_price", "is", null);
  else if (hasPurchasePrice === "no") dbQuery = dbQuery.is("purchase_price", null);

  if (amountMin != null) dbQuery = dbQuery.gte("total_amount", amountMin);
  if (amountMax != null) dbQuery = dbQuery.lte("total_amount", amountMax);
  if (from) dbQuery = dbQuery.gte("due_date", from);
  if (to) dbQuery = dbQuery.lte("due_date", to);

  const allRows: SaleReportRow[] = [];
  let total = 0;
  let offset = 0;

  while (offset < REPORT_MAX_ROWS) {
    const limit = Math.min(REPORT_BATCH, REPORT_MAX_ROWS - offset);
    const { data, error, count } = await dbQuery.range(offset, offset + limit - 1);
    if (error) throw new Error(error.message);
    if (offset === 0) total = count ?? 0;
    const batch = (data ?? []) as unknown as SaleReportRow[];
    allRows.push(...batch);
    if (batch.length < limit) break;
    offset += limit;
  }

  let withInvoice = 0;
  for (const row of allRows) {
    const inv = (row as SaleReportRow & { supplier_invoice_number?: string | null }).supplier_invoice_number;
    if (inv?.trim()) withInvoice += 1;
  }

  const report = computeSalesHistoryReport(allRows, total);
  report.summary.withInvoiceData = withInvoice;
  return report;
}
