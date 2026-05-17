export type CatalogStockStatus = "in_stock" | "out_of_stock" | "on_order";

/** При продажба „по поръчка“ не става „изчерпан“ — само „в наличност“ може да мине към изчерпан. */
export function enforceStockStatusAfterSale(
  previousStatus: string | null | undefined,
  requestedStatus: string | null | undefined,
): string | undefined {
  if (requestedStatus === undefined || requestedStatus === null) return undefined;
  if (previousStatus === "on_order" && requestedStatus === "out_of_stock") {
    return "on_order";
  }
  return requestedStatus;
}
