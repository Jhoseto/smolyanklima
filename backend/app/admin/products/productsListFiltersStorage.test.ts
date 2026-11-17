import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  ADMIN_PRODUCTS_LIST_FILTERS_KEY,
  DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS,
  buildAdminProductsListQueryString,
  loadAdminProductsListFilters,
  saveAdminProductsListFilters,
  type AdminProductsListFiltersSnapshot,
} from "./productsListFiltersStorage";

function createStore() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
    removeItem: (key: string) => entries.delete(key),
  };
}

const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
function switchTo(tab: object) {
  Object.defineProperty(globalThis, "window", { configurable: true, value: tab });
}

afterEach(() => {
  if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
  else Reflect.deleteProperty(globalThis, "window");
});

const filtered: AdminProductsListFiltersSnapshot = {
  ...DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS,
  q: "Daikin",
  catalogKind: "all",
  conditions: ["used"],
  featuredFlags: ["regular"],
  publicCatalogFlags: ["visible"],
  stockStatuses: ["reserved", "scrapped"],
  stockLocationFilter: "service",
  productRegionFilter: "japan",
  brandId: "brand-1",
  btuFilters: ["9", "12"],
  typeId: "type-1",
  supplierId: "supplier-1",
  containerId: "container-1",
  priceRange: [100, 2500],
  hasSerial: "with",
  hasPurchasePrice: "without",
  purchasedFrom: "2026-01-01",
  purchasedTo: "2026-02-01",
  sortBy: "purchase_price",
  sortDir: "desc",
  filtersOpen: true,
};

test("returning to or reloading a tab restores all its own filters and sort order", () => {
  const localStorage = createStore();
  const tabA = { localStorage, sessionStorage: createStore() };
  const tabB = { localStorage, sessionStorage: createStore() };
  switchTo(tabA);
  assert.deepEqual(loadAdminProductsListFilters(), DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS);
  saveAdminProductsListFilters(filtered);

  switchTo(tabB);
  assert.deepEqual(loadAdminProductsListFilters(), filtered);
  const inTabB: AdminProductsListFiltersSnapshot = { ...filtered, typeId: "multi-split", sortBy: "price" };
  saveAdminProductsListFilters(inTabB);

  switchTo({ ...tabA }); // A document reload keeps this tab's sessionStorage.
  const restored = loadAdminProductsListFilters();
  assert.deepEqual(restored, filtered);
  saveAdminProductsListFilters(restored);
  const params = new URLSearchParams(buildAdminProductsListQueryString(restored, { page: 2 }));
  assert.deepEqual(Object.fromEntries(params), {
    q: "Daikin", catalogKind: "all", condition: "used", featured: "regular",
    publicCatalog: "visible", stockStatus: "reserved,scrapped", stockLocation: "service",
    productRegion: "japan", brandId: "brand-1", btu: "9,12", typeId: "type-1",
    supplierId: "supplier-1", containerId: "container-1", priceMin: "100", priceMax: "2500",
    hasSerial: "with", hasPurchasePrice: "without", purchasedFrom: "2026-01-01",
    purchasedTo: "2026-02-01", sortBy: "purchase_price", sortDir: "desc", page: "2", perPage: "500",
  });

  switchTo({ localStorage, sessionStorage: createStore() });
  assert.deepEqual(loadAdminProductsListFilters(), inTabB);
  saveAdminProductsListFilters(DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS);
  switchTo(tabB);
  assert.deepEqual(loadAdminProductsListFilters(), inTabB);
});

test("corrupt stored data falls back to a previous version and migrates its selections", () => {
  const tab = { localStorage: createStore(), sessionStorage: createStore() };
  tab.sessionStorage.setItem(ADMIN_PRODUCTS_LIST_FILTERS_KEY, "{");
  tab.localStorage.setItem(ADMIN_PRODUCTS_LIST_FILTERS_KEY, "null");
  tab.localStorage.setItem("sk-admin-products-list-filters-v1", JSON.stringify({
    q: "legacy", condition: "new", featured: "featured", stockStatus: "reserved",
    btuFilter: "9", publicCatalog: "hidden", sortBy: "purchased_at", sortDir: "desc",
  }));
  switchTo(tab);
  const saved = loadAdminProductsListFilters();
  assert.deepEqual(saved, {
    ...DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS,
    q: "legacy", conditions: ["new"], featuredFlags: ["featured"], stockStatuses: ["reserved"],
    btuFilters: ["9"], publicCatalogFlags: ["hidden"], sortBy: "purchased_at", sortDir: "desc",
  });
  assert.deepEqual(JSON.parse(tab.sessionStorage.getItem(ADMIN_PRODUCTS_LIST_FILTERS_KEY)!), saved);
});

test("blocked browser storage still remembers selections while navigating within the tab", () => {
  const blocked = () => { throw new Error("Storage unavailable"); };
  switchTo({ get sessionStorage() { return blocked(); }, get localStorage() { return blocked(); } });
  assert.deepEqual(loadAdminProductsListFilters(), DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS);
  saveAdminProductsListFilters(filtered);
  assert.deepEqual(loadAdminProductsListFilters(), filtered);
  saveAdminProductsListFilters(DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS);
  assert.deepEqual(loadAdminProductsListFilters(), DEFAULT_ADMIN_PRODUCTS_LIST_FILTERS);
});
