/** Публичен каталог: явно публикувани продукти; без изчерпани. */
export type PublicCatalogProductRow = {
  show_in_public_catalog?: boolean | null;
  stock_status?: string | null;
};

export function isOnPublicCatalog(p: PublicCatalogProductRow): boolean {
  if (p.stock_status === "out_of_stock") return false;
  return p.show_in_public_catalog === true;
}

/** PostgREST filter за публични продукти. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function applyPublicCatalogFilter<T = any>(query: T): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any;
  return q.eq("show_in_public_catalog", true).neq("stock_status", "out_of_stock") as T;
}

/** @deprecated Използвай applyPublicCatalogFilter. */
export const PUBLIC_CATALOG_STOCK_STATUSES: readonly string[] = ["in_stock", "on_order"];
