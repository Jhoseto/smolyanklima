import {
  ADMIN_PRICE_FILTER_MAX,
  ADMIN_PRICE_FILTER_MIN,
} from "./PriceRangeSlider";
import type { ProductStockLocation } from "@/lib/admin/productStockLocation";
import type { ProductRegion } from "@/lib/admin/productRegion";
import type {
  FeaturedFilter,
  ProductConditionFilter,
  PublicCatalogFilter,
  StockStatusFilter,
} from "@/lib/admin/productListQueryFilters";

export const ADMIN_PRODUCTS_LIST_FILTERS_KEY = "sk-admin-products-list-filters-v2";
/** Брой артикула на страница в админ таблицата продукти. */
export const ADMIN_PRODUCTS_LIST_PER_PAGE = 500;
const LEGACY_PER_PAGE_KEY = "admin-products-per-page";
const LEGACY_FILTERS_V1_KEY = "sk-admin-products-list-filters-v1";

export type CatalogKindFilter = "climatics" | "accessories" | "all";
export type SortField = "name" | "price" | "purchase_price" | "product_condition" | "purchased_at";
export type SortDir = "asc" | "desc";
export type AdminProductsListFiltersSnapshot = {
  version: 3;
  q: string;
  catalogKind: CatalogKindFilter;
  conditions: ProductConditionFilter[];
  featuredFlags: FeaturedFilter[];
  publicCatalogFlags: PublicCatalogFilter[];
  stockStatuses: StockStatusFilter[];
  stockLocationFilter: "" | ProductStockLocation;
  productRegionFilter: "" | ProductRegion;
  brandId: string;
  btuFilters: string[];
  typeId: string;
  supplierId: string;
  priceRange: [number, number];
  hasSerial: "" | "with" | "without";
  hasPurchasePrice: "" | "with" | "without";
  purchasedFrom: string;
  purchasedTo: string;
  sortBy: SortField;
  sortDir: SortDir;
  filtersOpen: boolean;
};

export const DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS: AdminProductsListFiltersSnapshot = {
  version: 3,
  q: "",
  catalogKind: "climatics",
  conditions: [],
  featuredFlags: [],
  publicCatalogFlags: [],
  stockStatuses: [],
  stockLocationFilter: "",
  productRegionFilter: "",
  brandId: "",
  btuFilters: [],
  typeId: "",
  supplierId: "",
  priceRange: [ADMIN_PRICE_FILTER_MIN, ADMIN_PRICE_FILTER_MAX],
  hasSerial: "",
  hasPurchasePrice: "",
  purchasedFrom: "",
  purchasedTo: "",
  sortBy: "name",
  sortDir: "asc",
  filtersOpen: false,
};

function isCatalogKind(v: unknown): v is CatalogKindFilter {
  return v === "climatics" || v === "accessories" || v === "all";
}

function isSortField(v: unknown): v is SortField {
  return v === "name" || v === "price" || v === "purchase_price" || v === "product_condition" || v === "purchased_at";
}

function isSortDir(v: unknown): v is SortDir {
  return v === "asc" || v === "desc";
}

function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

function parseConditionArray(raw: unknown): ProductConditionFilter[] {
  return parseStringArray(raw).filter((x): x is ProductConditionFilter => x === "new" || x === "used");
}

function parseStockStatusArray(raw: unknown): StockStatusFilter[] {
  return parseStringArray(raw).filter(
    (x): x is StockStatusFilter => x === "in_stock" || x === "on_order",
  );
}

function parseFeaturedArray(raw: unknown): FeaturedFilter[] {
  return parseStringArray(raw).filter((x): x is FeaturedFilter => x === "featured" || x === "regular");
}

function parsePublicCatalogArray(raw: unknown): PublicCatalogFilter[] {
  return parseStringArray(raw).filter((x): x is PublicCatalogFilter => x === "visible" || x === "hidden");
}

function migrateSingleToArray<T extends string>(value: unknown, allowed: readonly T[]): T[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return allowed.includes(value as T) ? [value as T] : [];
}

function parsePriceRange(raw: unknown): [number, number] {
  if (!Array.isArray(raw) || raw.length !== 2) {
    return [ADMIN_PRICE_FILTER_MIN, ADMIN_PRICE_FILTER_MAX];
  }
  const lo = Number(raw[0]);
  const hi = Number(raw[1]);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
    return [ADMIN_PRICE_FILTER_MIN, ADMIN_PRICE_FILTER_MAX];
  }
  const min = Math.max(ADMIN_PRICE_FILTER_MIN, Math.min(lo, hi));
  const max = Math.min(ADMIN_PRICE_FILTER_MAX, Math.max(lo, hi));
  return [Math.min(min, max), Math.max(min, max)];
}

function readStoredFiltersRaw(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(ADMIN_PRODUCTS_LIST_FILTERS_KEY) ??
    localStorage.getItem(LEGACY_FILTERS_V1_KEY)
  );
}

export function loadAdminProductsListFilters(): AdminProductsListFiltersSnapshot {
  if (typeof window === "undefined") return { ...DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS };

  try {
    const raw = readStoredFiltersRaw();
    if (!raw) {
      return { ...DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS };
    }
    const parsed = JSON.parse(raw) as Partial<AdminProductsListFiltersSnapshot> & {
      page?: number;
      perPage?: number;
      version?: number;
      condition?: string;
      featured?: string;
      publicCatalog?: string;
      stockStatus?: string;
      btuFilter?: string;
    };
    const stockLoc = parsed.stockLocationFilter;
    const region = parsed.productRegionFilter;

    const conditions =
      parsed.version === 3 && Array.isArray(parsed.conditions)
        ? parseConditionArray(parsed.conditions)
        : migrateSingleToArray(parsed.condition, ["new", "used"] as const);
    const stockStatuses =
      parsed.version === 3 && Array.isArray(parsed.stockStatuses)
        ? parseStockStatusArray(parsed.stockStatuses)
        : migrateSingleToArray(parsed.stockStatus, ["in_stock", "on_order"] as const);
    const featuredFlags =
      parsed.version === 3 && Array.isArray(parsed.featuredFlags)
        ? parseFeaturedArray(parsed.featuredFlags)
        : migrateSingleToArray(parsed.featured, ["featured", "regular"] as const);
    const publicCatalogFlags =
      parsed.version === 3 && Array.isArray(parsed.publicCatalogFlags)
        ? parsePublicCatalogArray(parsed.publicCatalogFlags)
        : migrateSingleToArray(parsed.publicCatalog, ["visible", "hidden"] as const);
    const btuFilters =
      parsed.version === 3 && Array.isArray(parsed.btuFilters)
        ? parseStringArray(parsed.btuFilters)
        : typeof parsed.btuFilter === "string" && parsed.btuFilter.trim()
          ? [parsed.btuFilter.trim()]
          : [];

    return {
      version: 3,
      q: typeof parsed.q === "string" ? parsed.q : "",
      catalogKind: isCatalogKind(parsed.catalogKind) ? parsed.catalogKind : "climatics",
      conditions,
      featuredFlags,
      publicCatalogFlags,
      stockStatuses,
      stockLocationFilter:
        stockLoc === "showroom" || stockLoc === "warehouse" || stockLoc === "service" ? stockLoc : "",
      productRegionFilter: region === "europe" || region === "japan" ? region : "",
      brandId: typeof parsed.brandId === "string" ? parsed.brandId : "",
      btuFilters,
      typeId: typeof parsed.typeId === "string" ? parsed.typeId : "",
      supplierId: typeof parsed.supplierId === "string" ? parsed.supplierId : "",
      priceRange: parsePriceRange(parsed.priceRange),
      hasSerial: parsed.hasSerial === "with" || parsed.hasSerial === "without" ? parsed.hasSerial : "",
      hasPurchasePrice:
        parsed.hasPurchasePrice === "with" || parsed.hasPurchasePrice === "without"
          ? parsed.hasPurchasePrice
          : "",
      purchasedFrom: typeof parsed.purchasedFrom === "string" ? parsed.purchasedFrom : "",
      purchasedTo: typeof parsed.purchasedTo === "string" ? parsed.purchasedTo : "",
      sortBy: isSortField(parsed.sortBy) ? parsed.sortBy : "name",
      sortDir: isSortDir(parsed.sortDir) ? parsed.sortDir : "asc",
      filtersOpen: Boolean(parsed.filtersOpen),
    };
  } catch {
    return { ...DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS };
  }
}

export function saveAdminProductsListFilters(snapshot: AdminProductsListFiltersSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ADMIN_PRODUCTS_LIST_FILTERS_KEY, JSON.stringify(snapshot));
    localStorage.removeItem(LEGACY_FILTERS_V1_KEY);
    localStorage.removeItem(LEGACY_PER_PAGE_KEY);
  } catch {
    /* quota / private mode */
  }
}

export function clearAdminProductsListFilters(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(ADMIN_PRODUCTS_LIST_FILTERS_KEY);
  } catch {
    /* ignore */
  }
}
