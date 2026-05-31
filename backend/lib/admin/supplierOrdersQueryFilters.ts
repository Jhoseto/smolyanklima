export type OrderPhaseFilter = "ordered" | "delivered" | "cancelled";
export type OrderDataFlagFilter = "invoice" | "purchase";

const ALL_ORDER_PHASES: OrderPhaseFilter[] = ["ordered", "delivered", "cancelled"];

export function parseOrderPhaseCsv(raw: string | undefined): OrderPhaseFilter[] {
  if (!raw?.trim()) return [];
  const allowed = new Set(ALL_ORDER_PHASES);
  const out: OrderPhaseFilter[] = [];
  for (const token of raw.split(",").map((s) => s.trim())) {
    if (allowed.has(token as OrderPhaseFilter) && !out.includes(token as OrderPhaseFilter)) {
      out.push(token as OrderPhaseFilter);
    }
  }
  return out;
}

export function orderPhaseCsv(values: readonly OrderPhaseFilter[]): string | undefined {
  return values.length ? values.join(",") : undefined;
}

export { toggleSaleChipFilter as toggleOrderChipFilter } from "@/lib/admin/salesHistoryQueryFilters";
