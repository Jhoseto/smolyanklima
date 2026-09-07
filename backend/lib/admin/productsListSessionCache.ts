import type { LinkedRepairProtocolSummary } from "@/lib/admin/productServiceProtocol";

export type ProductsListSessionEntry = {
  items: unknown[];
  totalCount: number;
  repairProtocolByProductId: Record<string, LinkedRepairProtocolSummary>;
  fetchedAt: number;
};

export type ProductsMetaSessionEntry = {
  brands: { id: string; name: string }[];
  types: { id: string; name: string }[];
  suppliersById: Record<string, string>;
  containers: { id: string; name: string }[];
  adminRole: string;
  canEditMasterPricesInline: boolean;
  canMutateProductRows: boolean;
  fetchedAt: number;
};

const LIST_CACHE = new Map<string, ProductsListSessionEntry>();
/** Само за мигновено показване при навигация — не е източник на истина. */
const LIST_TTL_MS = 2 * 60_000;
const META_TTL_MS = 2 * 60_000;

let metaCache: ProductsMetaSessionEntry | null = null;

export function getProductsListSessionCache(qs: string): ProductsListSessionEntry | null {
  const entry = LIST_CACHE.get(qs);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > LIST_TTL_MS) {
    LIST_CACHE.delete(qs);
    return null;
  }
  return entry;
}

export function setProductsListSessionCache(
  qs: string,
  patch: Omit<ProductsListSessionEntry, "fetchedAt"> & { fetchedAt?: number },
): void {
  const prev = LIST_CACHE.get(qs);
  LIST_CACHE.set(qs, {
    items: patch.items,
    totalCount: patch.totalCount,
    repairProtocolByProductId:
      patch.repairProtocolByProductId ?? prev?.repairProtocolByProductId ?? {},
    fetchedAt: patch.fetchedAt ?? Date.now(),
  });
}

export function patchProductsListSessionRepairProtocols(
  qs: string,
  repairProtocolByProductId: Record<string, LinkedRepairProtocolSummary>,
): void {
  const entry = LIST_CACHE.get(qs);
  if (!entry) return;
  LIST_CACHE.set(qs, {
    ...entry,
    repairProtocolByProductId,
    fetchedAt: entry.fetchedAt,
  });
}

export function invalidateProductsListSessionCache(): void {
  LIST_CACHE.clear();
}

export function getProductsMetaSessionCache(): ProductsMetaSessionEntry | null {
  if (!metaCache) return null;
  if (Date.now() - metaCache.fetchedAt > META_TTL_MS) {
    metaCache = null;
    return null;
  }
  return metaCache;
}

export function setProductsMetaSessionCache(entry: Omit<ProductsMetaSessionEntry, "fetchedAt">): void {
  metaCache = { ...entry, fetchedAt: Date.now() };
}

export function invalidateProductsMetaSessionCache(): void {
  metaCache = null;
}

export function invalidateAllProductsSessionCache(): void {
  invalidateProductsListSessionCache();
  invalidateProductsMetaSessionCache();
}
