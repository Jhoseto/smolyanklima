/** Публичен каталог: само артикули, които не са маркирани като изчерпани (продажба). Не се ползва `is_active`. */
export const PUBLIC_CATALOG_STOCK_STATUSES: readonly string[] = ["in_stock", "on_order"];

export function isOnPublicCatalog(stockStatus: string | null | undefined): boolean {
  return stockStatus === "in_stock" || stockStatus === "on_order";
}
