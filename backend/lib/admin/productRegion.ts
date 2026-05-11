export const PRODUCT_REGIONS = ["europe", "japan"] as const;
export type ProductRegion = (typeof PRODUCT_REGIONS)[number];

export function normalizeProductRegion(raw: unknown): ProductRegion {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (s === "japan") return "japan";
  return "europe";
}

/** Етикети в таблицата, както искате: EUROPE / JAPAN */
export function productRegionLabel(raw: unknown): "EUROPE" | "JAPAN" {
  return normalizeProductRegion(raw) === "japan" ? "JAPAN" : "EUROPE";
}

export function canEditProductRegion(role: string | null | undefined): boolean {
  return role === "master_admin" || role === "office_staff";
}
