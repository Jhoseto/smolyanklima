/** Физическо място на артикула (витрина / склад) — отделно от `stock_status` (каталог / продажба). */
export const PRODUCT_STOCK_LOCATIONS = ["showroom", "warehouse"] as const;
export type ProductStockLocation = (typeof PRODUCT_STOCK_LOCATIONS)[number];

export function normalizeProductStockLocation(raw: unknown): ProductStockLocation {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "showroom" || s === "warehouse") return s;
  return "warehouse";
}

export function productStockLocationLabel(loc: unknown): string {
  const n = normalizeProductStockLocation(loc);
  if (n === "showroom") return "В магазин";
  return "В склада";
}

export function canEditProductStockLocation(role: string | null | undefined): boolean {
  return role === "master_admin" || role === "office_staff";
}
