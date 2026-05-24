import type { SupabaseClient } from "@supabase/supabase-js";
import { inferBtuFromCoolingKw } from "@/lib/catalog/productBtu";

export const CATALOG_SORT_VALUES = [
  "recommended",
  "rating-desc",
  "price-asc",
  "price-desc",
  "kw-asc",
  "kw-desc",
  "btu-asc",
  "btu-desc",
  "coverage-asc",
  "coverage-desc",
  "seer-desc",
  "scop-desc",
  "name-asc",
  "energy-class",
  "noise-asc",
] as const;

export type CatalogSortValue = (typeof CATALOG_SORT_VALUES)[number];

export const DEFAULT_CATALOG_SORT: CatalogSortValue = "seer-desc";

export type CatalogRepresentativeRow = {
  id: string;
  name?: string | null;
  brand_id?: string | null;
  model_code?: string | null;
  stock_status?: string | null;
  price?: number | null;
  sold_quantity?: number | null;
  created_at?: string | null;
  is_featured?: boolean | null;
  rating?: number | null;
  reviews_count?: number | null;
};

export type CatalogSpecSortRow = {
  product_id: string;
  btu?: number | null;
  cooling_power_kw?: number | null;
  heating_power_kw?: number | null;
  coverage_m2?: number | null;
  seer?: number | null;
  scop?: number | null;
  noise_db?: number | null;
  energy_class_cool?: string | null;
};

const ENERGY_CLASS_RANK: Record<string, number> = {
  "A+++": 4,
  "A++": 3,
  "A+": 2,
  A: 1,
};

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function btuSortValue(spec: CatalogSpecSortRow | undefined): number {
  if (!spec) return Number.POSITIVE_INFINITY;
  const direct = spec.btu != null ? Number(spec.btu) : null;
  if (direct != null && Number.isFinite(direct)) return direct;
  const inferred = inferBtuFromCoolingKw(spec.cooling_power_kw);
  return inferred != null ? inferred : Number.POSITIVE_INFINITY;
}

function energyRank(cls: string | null | undefined): number {
  const key = String(cls ?? "").trim().toUpperCase();
  return ENERGY_CLASS_RANK[key] ?? 0;
}

function cmpNum(a: number, b: number, asc: boolean): number {
  if (a === b) return 0;
  if (!Number.isFinite(a)) return 1;
  if (!Number.isFinite(b)) return -1;
  return asc ? a - b : b - a;
}

function chunkIds(ids: string[], size = 100): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

export async function fetchSpecSortMap(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<Map<string, CatalogSpecSortRow>> {
  const map = new Map<string, CatalogSpecSortRow>();
  if (productIds.length === 0) return map;

  const cols = "product_id,btu,cooling_power_kw,heating_power_kw,coverage_m2,seer,scop,noise_db,energy_class_cool";
  for (const chunk of chunkIds(productIds)) {
    const primary = await supabase.from("product_specs").select(cols).in("product_id", chunk);
    let rows: CatalogSpecSortRow[];

    if (primary.error && /btu/.test(String(primary.error.message ?? ""))) {
      const fallback = await supabase
        .from("product_specs")
        .select("product_id,cooling_power_kw,heating_power_kw,coverage_m2,seer,scop,noise_db,energy_class_cool")
        .in("product_id", chunk);
      if (fallback.error) throw new Error(fallback.error.message);
      rows = (fallback.data ?? []) as CatalogSpecSortRow[];
    } else {
      if (primary.error) throw new Error(primary.error.message);
      rows = (primary.data ?? []) as CatalogSpecSortRow[];
    }

    for (const row of rows) {
      if (row.product_id) map.set(row.product_id, row);
    }
  }
  return map;
}

export function needsSpecSort(sort: string | undefined): boolean {
  return (
    sort === "kw-asc" ||
    sort === "kw-desc" ||
    sort === "btu-asc" ||
    sort === "btu-desc" ||
    sort === "coverage-asc" ||
    sort === "coverage-desc" ||
    sort === "seer-desc" ||
    sort === "scop-desc" ||
    sort === "energy-class" ||
    sort === "noise-asc"
  );
}

/** Сортира представителите преди pagination (глобален ред в каталога). */
export function sortRepresentatives(
  rows: CatalogRepresentativeRow[],
  specById: Map<string, CatalogSpecSortRow>,
  sort: CatalogSortValue | string | undefined,
): CatalogRepresentativeRow[] {
  const s = sort ?? DEFAULT_CATALOG_SORT;
  const sorted = [...rows];

  sorted.sort((a, b) => {
    const sa = specById.get(a.id);
    const sb = specById.get(b.id);

    let primary = 0;
    switch (s) {
      case "price-asc":
        primary = cmpNum(num(a.price, 0), num(b.price, 0), true);
        break;
      case "price-desc":
        primary = cmpNum(num(a.price, 0), num(b.price, 0), false);
        break;
      case "rating-desc":
        primary = cmpNum(num(a.rating, 0), num(b.rating, 0), false);
        break;
      case "recommended": {
        const feat = Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
        if (feat !== 0) return feat;
        primary = cmpNum(num(a.reviews_count, 0), num(b.reviews_count, 0), false);
        if (primary !== 0) break;
        primary = cmpNum(num(a.rating, 0), num(b.rating, 0), false);
        break;
      }
      case "kw-asc":
        primary = cmpNum(num(sa?.cooling_power_kw, Infinity), num(sb?.cooling_power_kw, Infinity), true);
        if (primary === 0) {
          primary = cmpNum(num(sa?.heating_power_kw, Infinity), num(sb?.heating_power_kw, Infinity), true);
        }
        break;
      case "kw-desc":
        primary = cmpNum(num(sa?.cooling_power_kw, -1), num(sb?.cooling_power_kw, -1), false);
        if (primary === 0) {
          primary = cmpNum(num(sa?.heating_power_kw, -1), num(sb?.heating_power_kw, -1), false);
        }
        break;
      case "btu-asc":
        primary = cmpNum(btuSortValue(sa), btuSortValue(sb), true);
        break;
      case "btu-desc":
        primary = cmpNum(btuSortValue(sa), btuSortValue(sb), false);
        break;
      case "coverage-asc":
        primary = cmpNum(num(sa?.coverage_m2, Infinity), num(sb?.coverage_m2, Infinity), true);
        break;
      case "coverage-desc":
        primary = cmpNum(num(sa?.coverage_m2, -1), num(sb?.coverage_m2, -1), false);
        break;
      case "seer-desc":
        primary = cmpNum(num(sa?.seer, -1), num(sb?.seer, -1), false);
        break;
      case "scop-desc":
        primary = cmpNum(num(sa?.scop, -1), num(sb?.scop, -1), false);
        break;
      case "name-asc":
        primary = String(a.name ?? "").localeCompare(String(b.name ?? ""), "bg");
        break;
      case "noise-asc":
        primary = cmpNum(num(sa?.noise_db, 999), num(sb?.noise_db, 999), true);
        break;
      case "energy-class":
        primary = energyRank(sb?.energy_class_cool) - energyRank(sa?.energy_class_cool);
        break;
      default:
        primary = cmpNum(num(a.reviews_count, 0), num(b.reviews_count, 0), false);
        if (primary === 0) primary = cmpNum(num(a.rating, 0), num(b.rating, 0), false);
    }

    if (primary !== 0) return primary;

    // Стабилен tie-break: in_stock, по-малко продадени, по-стар запис.
    const stockOrder = (x: CatalogRepresentativeRow) => (x.stock_status === "in_stock" ? 0 : 1);
    const st = stockOrder(a) - stockOrder(b);
    if (st !== 0) return st;
    const sold = cmpNum(num(a.sold_quantity, 0), num(b.sold_quantity, 0), true);
    if (sold !== 0) return sold;
    return String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""));
  });

  return sorted;
}
