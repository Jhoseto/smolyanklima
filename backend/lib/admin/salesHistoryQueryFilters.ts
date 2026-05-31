export type SaleMountPhaseFilter = "pending_mount" | "completed" | "cancelled";
export type SaleDataFlagFilter = "invoice" | "purchase";
export type SaleProductConditionFilter = "new" | "used";

const ALL_MOUNT_PHASES: SaleMountPhaseFilter[] = ["pending_mount", "completed", "cancelled"];
const ALL_PRODUCT_CONDITIONS: SaleProductConditionFilter[] = ["new", "used"];

export function parseMountPhaseCsv(raw: string | undefined): SaleMountPhaseFilter[] {
  if (!raw?.trim()) return [];
  const allowed = new Set(ALL_MOUNT_PHASES);
  const out: SaleMountPhaseFilter[] = [];
  for (const token of raw.split(",").map((s) => s.trim())) {
    if (allowed.has(token as SaleMountPhaseFilter) && !out.includes(token as SaleMountPhaseFilter)) {
      out.push(token as SaleMountPhaseFilter);
    }
  }
  return out;
}

export function mountPhaseCsv(values: readonly SaleMountPhaseFilter[]): string | undefined {
  return values.length ? values.join(",") : undefined;
}

export function parseProductConditionCsv(raw: string | undefined): SaleProductConditionFilter[] {
  if (!raw?.trim()) return [];
  const allowed = new Set(ALL_PRODUCT_CONDITIONS);
  const out: SaleProductConditionFilter[] = [];
  for (const token of raw.split(",").map((s) => s.trim())) {
    if (allowed.has(token as SaleProductConditionFilter) && !out.includes(token as SaleProductConditionFilter)) {
      out.push(token as SaleProductConditionFilter);
    }
  }
  return out;
}

export function productConditionCsv(values: readonly SaleProductConditionFilter[]): string | undefined {
  return values.length ? values.join(",") : undefined;
}

export function saleProductConditionFilterLabel(values: readonly SaleProductConditionFilter[]): string {
  if (values.length === 0) return "Всички";
  if (values.length === 2) return "Нови + Втора употреба";
  return values[0] === "new" ? "Нови климатици" : "Втора употреба";
}

export function toggleSaleChipFilter<T>(current: readonly T[], value: T): T[] {
  return current.includes(value) ? current.filter((x) => x !== value) : [...current, value];
}
