export type SaleMountPhaseFilter = "pending_mount" | "completed" | "cancelled";
export type SaleDataFlagFilter = "invoice" | "purchase";

const ALL_MOUNT_PHASES: SaleMountPhaseFilter[] = ["pending_mount", "completed", "cancelled"];

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

export function toggleSaleChipFilter<T>(current: readonly T[], value: T): T[] {
  return current.includes(value) ? current.filter((x) => x !== value) : [...current, value];
}
