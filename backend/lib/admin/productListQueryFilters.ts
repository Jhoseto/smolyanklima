export type ProductConditionFilter = "new" | "used";
export type StockStatusFilter = "in_stock" | "out_of_stock" | "on_order";
export type FeaturedFilter = "featured" | "regular";
export type PublicCatalogFilter = "visible" | "hidden";

export type ProductListChipFilters = {
  conditions: ProductConditionFilter[];
  stockStatuses: StockStatusFilter[];
  featuredFlags: FeaturedFilter[];
  publicCatalogFlags: PublicCatalogFilter[];
};

const ALL_CONDITIONS: ProductConditionFilter[] = ["new", "used"];
const ALL_STOCK_STATUSES: StockStatusFilter[] = ["in_stock", "out_of_stock", "on_order"];
const ALL_FEATURED: FeaturedFilter[] = ["featured", "regular"];
const ALL_PUBLIC_CATALOG: PublicCatalogFilter[] = ["visible", "hidden"];

export function parseCsvTokens(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseCsvEnum<T extends string>(raw: string | undefined, allowed: readonly T[]): T[] {
  const allowedSet = new Set(allowed);
  const out: T[] = [];
  for (const token of parseCsvTokens(raw)) {
    if (allowedSet.has(token as T) && !out.includes(token as T)) out.push(token as T);
  }
  return out;
}

export function csvParam(values: readonly string[]): string | undefined {
  return values.length ? values.join(",") : undefined;
}

export function toggleChipFilter<T>(current: readonly T[], value: T): T[] {
  return current.includes(value) ? current.filter((x) => x !== value) : [...current, value];
}

function effectiveEnumFilter<T extends string>(selected: readonly T[], all: readonly T[]): T[] | null {
  if (selected.length === 0 || selected.length >= all.length) return null;
  return [...selected];
}

type FilterQuery = {
  eq: (column: string, value: unknown) => FilterQuery;
  in: (column: string, values: readonly unknown[]) => FilterQuery;
};

function applyEnumInFilter(
  query: FilterQuery,
  column: string,
  selected: readonly string[],
  all: readonly string[],
): FilterQuery {
  const effective = effectiveEnumFilter(selected, all);
  if (!effective) return query;
  if (effective.length === 1) return query.eq(column, effective[0]);
  return query.in(column, effective);
}

function applyBooleanPairFilter(
  query: FilterQuery,
  column: string,
  flags: readonly string[],
  trueKey: string,
  falseKey: string,
): FilterQuery {
  const hasTrue = flags.includes(trueKey);
  const hasFalse = flags.includes(falseKey);
  if (hasTrue && !hasFalse) return query.eq(column, true);
  if (hasFalse && !hasTrue) return query.eq(column, false);
  return query;
}

export function parseProductListChipFilters(params: {
  condition?: string;
  stockStatus?: string;
  featured?: string;
  publicCatalog?: string;
}): ProductListChipFilters {
  return {
    conditions: parseCsvEnum(params.condition, ALL_CONDITIONS),
    stockStatuses: parseCsvEnum(params.stockStatus, ALL_STOCK_STATUSES),
    featuredFlags: parseCsvEnum(params.featured, ALL_FEATURED),
    publicCatalogFlags: parseCsvEnum(params.publicCatalog, ALL_PUBLIC_CATALOG),
  };
}

export function applyProductListChipFilters(query: unknown, filters: ProductListChipFilters): unknown {
  let next = applyEnumInFilter(query as FilterQuery, "product_condition", filters.conditions, ALL_CONDITIONS);
  next = applyEnumInFilter(next, "stock_status", filters.stockStatuses, ALL_STOCK_STATUSES);
  next = applyBooleanPairFilter(next, "is_featured", filters.featuredFlags, "featured", "regular");
  next = applyBooleanPairFilter(next, "show_in_public_catalog", filters.publicCatalogFlags, "visible", "hidden");
  return next;
}
