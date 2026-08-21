/** Физическо място на артикула (витрина / склад / сервиз) — отделно от `stock_status` (каталог / продажба). */
export const PRODUCT_STOCK_LOCATIONS = ["showroom", "warehouse", "service"] as const;
export type ProductStockLocation = (typeof PRODUCT_STOCK_LOCATIONS)[number];

export function normalizeProductStockLocation(raw: unknown): ProductStockLocation {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (s === "showroom" || s === "warehouse" || s === "service") return s;
  return "warehouse";
}

export function productStockLocationLabel(loc: unknown): string {
  const n = normalizeProductStockLocation(loc);
  if (n === "showroom") return "В магазин";
  if (n === "service") return "В сервиз";
  return "В склада";
}

/** Кратък етикет за компактни badge-и в списъци/таблици. */
export function productStockLocationLabelCompact(loc: unknown): string {
  const n = normalizeProductStockLocation(loc);
  if (n === "showroom") return "Магазин";
  if (n === "service") return "Сервиз";
  return "Склад";
}

/** Tailwind класове за badge цвят по местоположение. */
export function productStockLocationBadgeClass(loc: unknown): string {
  const n = normalizeProductStockLocation(loc);
  if (n === "showroom") return "bg-violet-100 text-violet-900";
  if (n === "service") return "bg-amber-100 text-amber-900";
  return "bg-slate-100 text-slate-800";
}

export function canEditProductStockLocation(role: string | null | undefined): boolean {
  return role === "master_admin" || role === "office_staff";
}
