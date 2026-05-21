import {
  ADMIN_PRICE_FILTER_MAX,
  ADMIN_PRICE_FILTER_MIN,
} from "./PriceRangeSlider";
import type { ProductStockLocation } from "@/lib/admin/productStockLocation";
import type { ProductRegion } from "@/lib/admin/productRegion";

export const ADMIN_PRODUCTS_LIST_FILTERS_KEY = "sk-admin-products-list-filters-v1";
const LEGACY_PER_PAGE_KEY = "admin-products-per-page";

export type CatalogKindFilter = "climatics" | "accessories" | "all";
export type SortField = "name" | "price" | "purchase_price" | "product_condition" | "purchased_at";
export type SortDir = "asc" | "desc";
export const PRODUCTS_PER_PAGE_OPTS = [10, 20, 50, 100] as const;
export type ProductsPerPage = (typeof PRODUCTS_PER_PAGE_OPTS)[number];

export type AdminProductsListFiltersSnapshot = {
  version: 1;
  q: string;
  catalogKind: CatalogKindFilter;
  condition: "" | "new" | "used";
  featured: "" | "featured" | "regular";
  publicCatalog: "" | "visible" | "hidden";
  stockStatus: "" | "in_stock" | "out_of_stock" | "on_order";
  stockLocationFilter: "" | ProductStockLocation;
  productRegionFilter: "" | ProductRegion;
  brandId: string;
  btuFilter: string;
  typeId: string;
  supplierId: string;
  priceRange: [number, number];
  hasSerial: "" | "with" | "without";
  hasPurchasePrice: "" | "with" | "without";
  purchasedFrom: string;
  purchasedTo: string;
  sortBy: SortField;
  sortDir: SortDir;
  page: number;
  perPage: ProductsPerPage;
  filtersOpen: boolean;
};

export const DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS: AdminProductsListFiltersSnapshot = {
  version: 1,
  q: "",
  catalogKind: "climatics",
  condition: "",
  featured: "",
  publicCatalog: "",
  stockStatus: "",
  stockLocationFilter: "",
  productRegionFilter: "",
  brandId: "",
  btuFilter: "",
  typeId: "",
  supplierId: "",
  priceRange: [ADMIN_PRICE_FILTER_MIN, ADMIN_PRICE_FILTER_MAX],
  hasSerial: "",
  hasPurchasePrice: "",
  purchasedFrom: "",
  purchasedTo: "",
  sortBy: "name",
  sortDir: "asc",
  page: 1,
  perPage: 20,
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

function isPerPage(v: unknown): v is ProductsPerPage {
  return typeof v === "number" && (PRODUCTS_PER_PAGE_OPTS as readonly number[]).includes(v);
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

function readLegacyPerPage(): ProductsPerPage | null {
  if (typeof window === "undefined") return null;
  try {
    const n = Number(localStorage.getItem(LEGACY_PER_PAGE_KEY));
    return isPerPage(n) ? n : null;
  } catch {
    return null;
  }
}

export function loadAdminProductsListFilters(): AdminProductsListFiltersSnapshot {
  if (typeof window === "undefined") return { ...DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS };

  try {
    const raw = localStorage.getItem(ADMIN_PRODUCTS_LIST_FILTERS_KEY);
    if (!raw) {
      const legacyPerPage = readLegacyPerPage();
      return {
        ...DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS,
        ...(legacyPerPage ? { perPage: legacyPerPage } : {}),
      };
    }
    const parsed = JSON.parse(raw) as Partial<AdminProductsListFiltersSnapshot>;
    const stockLoc = parsed.stockLocationFilter;
    const region = parsed.productRegionFilter;

    return {
      version: 1,
      q: typeof parsed.q === "string" ? parsed.q : "",
      catalogKind: isCatalogKind(parsed.catalogKind) ? parsed.catalogKind : "climatics",
      condition: parsed.condition === "new" || parsed.condition === "used" ? parsed.condition : "",
      featured:
        parsed.featured === "featured" || parsed.featured === "regular" ? parsed.featured : "",
      publicCatalog:
        parsed.publicCatalog === "visible" || parsed.publicCatalog === "hidden"
          ? parsed.publicCatalog
          : "",
      stockStatus:
        parsed.stockStatus === "in_stock" ||
        parsed.stockStatus === "out_of_stock" ||
        parsed.stockStatus === "on_order"
          ? parsed.stockStatus
          : "",
      stockLocationFilter:
        stockLoc === "showroom" || stockLoc === "warehouse" ? stockLoc : "",
      productRegionFilter: region === "europe" || region === "japan" ? region : "",
      brandId: typeof parsed.brandId === "string" ? parsed.brandId : "",
      btuFilter: typeof parsed.btuFilter === "string" ? parsed.btuFilter : "",
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
      page: typeof parsed.page === "number" && parsed.page >= 1 ? Math.floor(parsed.page) : 1,
      perPage: isPerPage(parsed.perPage) ? parsed.perPage : readLegacyPerPage() ?? 20,
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
    localStorage.setItem(LEGACY_PER_PAGE_KEY, String(snapshot.perPage));
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
