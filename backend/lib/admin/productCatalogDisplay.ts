/** UI-only helpers for the admin products catalog list (Approach A). */

export type ProductCatalogListRow = {
  id: string;
  name: string;
  stock_status: string;
  product_condition: "new" | "used" | string;
  brand_id?: string | null;
  model_code?: string | null;
  catalog_item?: "product" | "accessory" | string;
  brands?: { name?: string } | null;
};

export type CatalogDisplayRow<T extends ProductCatalogListRow = ProductCatalogListRow> = {
  row: T;
  /** Stable key for React lists — product id or exhausted group key. */
  groupKey: string;
  /** 1 for normal rows; >1 when multiple exhausted units are collapsed. */
  groupedCount: number;
  isGroupedExhausted: boolean;
};

function isAccessoryRow(p: Pick<ProductCatalogListRow, "catalog_item">): boolean {
  return p.catalog_item === "accessory";
}

function isExhaustedProduct(p: ProductCatalogListRow): boolean {
  return !isAccessoryRow(p) && p.stock_status === "out_of_stock";
}

/** Продадени климатици (изчерпани) — само в Продажби, не в таблицата Продукти. */
export function isHiddenSoldProductFromAdminList(p: ProductCatalogListRow): boolean {
  return isExhaustedProduct(p);
}

/** @deprecated Използвай isHiddenSoldProductFromAdminList. */
export function isHiddenExhaustedUsedProduct(p: ProductCatalogListRow): boolean {
  return isHiddenSoldProductFromAdminList(p);
}

/**
 * PostgREST filter за админ таблица Продукти: само налични и по поръчка.
 * Изчерпаните (продадени) записи са само в Продажби.
 */
export const CATALOG_VISIBLE_PRODUCTS_OR_FILTER =
  "stock_status.eq.in_stock,stock_status.eq.on_order";

export function filterProductsCatalogItems<T extends ProductCatalogListRow>(items: T[]): T[] {
  return items.filter((row) => !isHiddenSoldProductFromAdminList(row));
}

/** Group key: brand + model (or name fallback) + condition. */
export function exhaustedProductGroupKey(p: ProductCatalogListRow): string {
  const brand = (p.brand_id ?? p.brands?.name ?? "").trim().toLowerCase();
  const model = (p.model_code ?? "").trim().toLowerCase();
  const name = (p.name ?? "").trim().toLowerCase();
  const modelPart = model || name;
  return `${brand}|${modelPart}|${p.product_condition}`;
}

export function productShowsSupplierInvoice(stockStatus: string | null | undefined): boolean {
  return stockStatus === "in_stock" || stockStatus === "on_order";
}

export function isGroupedExhaustedSelectable(entry: CatalogDisplayRow): boolean {
  return !(entry.isGroupedExhausted && entry.groupedCount > 1);
}

/**
 * Collapse multiple exhausted product rows with the same brand+model+condition
 * into one display row. Available (`in_stock` / `on_order`) rows stay individual.
 */
export function buildProductCatalogDisplayRows<T extends ProductCatalogListRow>(
  items: T[],
): CatalogDisplayRow<T>[] {
  const result: CatalogDisplayRow<T>[] = [];
  const exhaustedGroups = new Map<string, CatalogDisplayRow<T>>();

  for (const row of filterProductsCatalogItems(items)) {
    if (!isExhaustedProduct(row)) {
      result.push({
        row,
        groupKey: row.id,
        groupedCount: 1,
        isGroupedExhausted: false,
      });
      continue;
    }

    const groupKey = exhaustedProductGroupKey(row);
    const existing = exhaustedGroups.get(groupKey);
    if (existing) {
      existing.groupedCount += 1;
      continue;
    }

    const entry: CatalogDisplayRow<T> = {
      row,
      groupKey,
      groupedCount: 1,
      isGroupedExhausted: true,
    };
    exhaustedGroups.set(groupKey, entry);
    result.push(entry);
  }

  return result;
}
