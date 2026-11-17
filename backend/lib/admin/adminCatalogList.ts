import type { SupabaseClient } from "@supabase/supabase-js";
import { applyAdminAccessorySearchFilter } from "@/lib/admin/productSearchFilter";
import type { ProductListChipFilters } from "@/lib/admin/productListQueryFilters";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
import { coolingKwRangeForBtu } from "@/lib/catalog/productBtu";

export type AdminCatalogKind = "climatics" | "accessories" | "all";

export function selectAdminProducts(supabase: SupabaseClient, columns: string, btus: number[], hasBtuColumn = true) {
  const select = btus.length ? `${columns},product_specs!inner()` : columns;
  const query = supabase.from("products").select(select, { count: "exact" });
  if (!btus.length) return query;
  const coolingRanges = btus.flatMap((btu) => {
    const range = coolingKwRangeForBtu(btu);
    return range ? [`and(cooling_power_kw.gte.${range.min},cooling_power_kw.lte.${range.max})`] : [];
  }).join(",");
  const matches = hasBtuColumn
    ? `btu.in.(${btus.join(",")}),and(btu.is.null,or(${coolingRanges}))`
    : coolingRanges;
  return query.or(matches, { referencedTable: "product_specs" });
}

export async function readWithAdminBtuFallback<T extends { error: { code?: string; message?: string } | null }>(
  btus: number[],
  read: (hasBtuColumn: boolean) => PromiseLike<T>,
): Promise<T> {
  const response = await read(true);
  return btus.length && isPostgrestMissingColumn(response.error, "btu") ? read(false) : response;
}

export type AdminCatalogListFilters = {
  q?: string;
  stockStatuses?: ProductListChipFilters["stockStatuses"];
  publicCatalogFlags?: ProductListChipFilters["publicCatalogFlags"];
  brandId?: string;
  priceMin?: number;
  priceMax?: number;
  sortBy: "name" | "price" | "purchase_price" | "product_condition" | "purchased_at" | "stock_location";
  sortDir: "asc" | "desc";
  page: number;
  perPage: number;
};

/** Accessories have a new condition, are never featured, and have no climate or supply fields. */
export function canIncludeAccessories(filters: ProductListChipFilters & {
  typeId?: string;
  supplierId?: string;
  containerId?: string;
  stockLocation?: string;
  productRegion?: string;
  purchasedFrom?: string;
  purchasedTo?: string;
  hasSerial?: "with" | "without";
  hasPurchasePrice?: "with" | "without";
  btuFilters: number[];
}): boolean {
  return (!filters.conditions.length || filters.conditions.includes("new"))
    && (!filters.featuredFlags.length || filters.featuredFlags.includes("regular"))
    && !filters.typeId && !filters.supplierId && !filters.containerId
    && !filters.stockLocation && !filters.productRegion && !filters.btuFilters.length
    && !filters.purchasedFrom && !filters.purchasedTo
    && filters.hasSerial !== "with" && filters.hasPurchasePrice !== "with";
}

const ACCESSORY_SELECT =
  "id,slug,name,price,stock_status,stock_quantity,is_active,source_url,created_at,brand_id,kind,brands:brand_id(name)";

const ACCESSORY_STUB_SELECT = "id,name,price";

type AccessoryRow = {
  id: string;
  slug: string;
  name: string;
  price: number;
  stock_status: string;
  stock_quantity: number;
  is_active: boolean;
  source_url?: string | null;
  created_at: string;
  brand_id: string | null;
  kind: string;
  brands?: { name?: string | null } | null;
};

function accessoryTypeLabel(kind: string | null | undefined): string {
  if (kind === "spare_part") return "Резервна част";
  if (kind === "consumable") return "Консуматив";
  return "Аксесоар";
}

export function mapAccessoryToAdminListRow(row: AccessoryRow) {
  return {
    catalog_item: "accessory" as const,
    id: row.id,
    slug: row.slug,
    name: row.name,
    price: row.price,
    purchase_price: null,
    product_condition: "new" as const,
    is_featured: false,
    is_active: row.is_active,
    show_in_public_catalog: row.is_active,
    featured_position: null,
    featured_badge: null,
    stock_status: row.stock_status,
    stock_location: null,
    stock_quantity: row.stock_quantity,
    sold_quantity: 0,
    created_at: row.created_at,
    purchased_at: null,
    supplier_id: null,
    source_url: row.source_url ?? null,
    indoor_unit_serial: null,
    outdoor_unit_serial: null,
    supplier_invoice_number: null,
    product_region: null,
    model_code: null,
    brand_id: row.brand_id,
    brands: row.brands ?? null,
    product_types: { name: accessoryTypeLabel(row.kind) },
    supplier: null,
    accessory_kind: row.kind,
  };
}

function applyAccessoryFilters(
  supabase: SupabaseClient,
  filters: AdminCatalogListFilters,
  select: string,
  withCount: boolean,
) {
  let query = supabase.from("accessories").select(select, withCount ? { count: "exact" } : undefined);
  if (filters.q?.trim()) {
    query = applyAdminAccessorySearchFilter(query, filters.q);
  }
  if (filters.stockStatuses?.length) {
    if (filters.stockStatuses.length === 1) {
      query = query.eq("stock_status", filters.stockStatuses[0]);
    } else {
      query = query.in("stock_status", filters.stockStatuses);
    }
  }
  if (filters.brandId) query = query.eq("brand_id", filters.brandId);
  if (filters.publicCatalogFlags?.length === 1) {
    query = query.eq("is_active", filters.publicCatalogFlags[0] === "visible");
  }
  if (filters.priceMin !== undefined) query = query.gte("price", filters.priceMin);
  if (filters.priceMax !== undefined) query = query.lte("price", filters.priceMax);
  return query;
}

export async function listAdminAccessories(
  supabase: SupabaseClient,
  filters: AdminCatalogListFilters,
): Promise<{ data: ReturnType<typeof mapAccessoryToAdminListRow>[]; total: number }> {
  const from = (filters.page - 1) * filters.perPage;
  const to = from + filters.perPage - 1;
  let query = applyAccessoryFilters(supabase, filters, ACCESSORY_SELECT, true);
  if (filters.sortBy === "price" || filters.sortBy === "name") {
    query = query.order(filters.sortBy, { ascending: filters.sortDir === "asc" });
  }
  if (filters.sortBy !== "name") query = query.order("name", { ascending: true });
  const res = await query.order("id").range(from, to);
  if (res.error) throw new Error(res.error.message);
  const rows = ((res.data ?? []) as unknown as AccessoryRow[]).map(mapAccessoryToAdminListRow);
  return { data: rows, total: res.count ?? 0 };
}

export type ProductCatalogStub = {
  id: string;
  name: string;
  price: number;
  product_condition: string;
  purchased_at: string | null;
  purchase_price: number | null;
  stock_location: string | null;
};

type MergeStub = ProductCatalogStub & {
  catalog_item: "product" | "accessory";
};

function compareStubs(a: MergeStub, b: MergeStub, sortBy: AdminCatalogListFilters["sortBy"], sortDir: "asc" | "desc") {
  const av = a[sortBy];
  const bv = b[sortBy];
  if (av == null && bv != null) return sortDir === "asc" ? 1 : -1;
  if (av != null && bv == null) return sortDir === "asc" ? -1 : 1;
  if (av != null && bv != null) {
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv), "bg");
    if (cmp !== 0) return sortDir === "asc" ? cmp : -cmp;
  }
  return a.name.localeCompare(b.name, "bg") || a.id.localeCompare(b.id);
}

type ReadCatalogPage<T> = (from: number, to: number) => PromiseLike<{
  data: T[] | null;
  count: number | null;
  error: { message: string } | null;
}>;

/** Include all rows tied at the page boundary before applying Bulgarian name ordering. */
export async function readCatalogStubs<T>(
  readPage: ReadCatalogPage<T>,
  pageEnd: number,
  sortGroup?: (row: T) => string | number | null,
): Promise<{ rows: T[]; total: number }> {
  const rows: T[] = [];
  const chunkSize = 1000;
  while (true) {
    const take = sortGroup && rows.length <= pageEnd
      ? Math.min(chunkSize, pageEnd + 1 - rows.length)
      : chunkSize;
    const { data, count, error } = await readPage(rows.length, rows.length + take - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) return { rows, total: count ?? rows.length };
    rows.push(...data);
    if (count !== null) {
      if (rows.length >= count || (sortGroup && rows.length > pageEnd
          && sortGroup(rows[pageEnd - 1]) !== sortGroup(rows[rows.length - 1]))) {
        return { rows, total: count };
      }
    } else if (data.length < take) {
      return { rows, total: rows.length };
    }
  }
}

/** Keep PostgREST GET URLs below common gateway limits even for a full 500-row page. */
export async function readCatalogRowsByIds<T>(
  ids: string[],
  readBatch: (batch: string[]) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const batches = [];
  for (let start = 0; start < ids.length; start += 100) {
    batches.push(readBatch(ids.slice(start, start + 100)));
  }
  const responses = await Promise.all(batches);
  return responses.flatMap(({ data, error }) => {
    if (error) throw new Error(error.message);
    return data ?? [];
  });
}

export async function listAdminCatalogMerged(
  supabase: SupabaseClient,
  filters: AdminCatalogListFilters,
  readProducts: ReadCatalogPage<ProductCatalogStub>,
  readProductDetails: (ids: string[]) => Promise<Record<string, unknown>[]>,
) {
  const pageEnd = filters.page * filters.perPage;
  const sortBy = filters.sortBy;
  const [productIndex, accessoryIndex] = await Promise.all([
    // Names can have a different database collation. Compare the whole name index in Bulgarian.
    readCatalogStubs(readProducts, pageEnd, sortBy === "name" ? undefined : (row) => row[sortBy]),
    readCatalogStubs((from, to) => {
      let query = applyAccessoryFilters(supabase, filters, ACCESSORY_STUB_SELECT, true);
      if (sortBy === "price") query = query.order("price", { ascending: filters.sortDir === "asc" });
      return query.order("id").range(from, to).returns<Pick<AccessoryRow, "id" | "name" | "price">[]>();
    }, pageEnd, sortBy === "price" ? (row) => row.price : undefined),
  ]);

  const accessoryStubs: MergeStub[] = accessoryIndex.rows.map((row) => ({
    ...row,
    catalog_item: "accessory",
    product_condition: "new",
    purchase_price: null,
    purchased_at: null,
    stock_location: null,
  }));

  const productStubs = productIndex.rows.map((row) => ({ ...row, catalog_item: "product" as const }));
  const merged = [...productStubs, ...accessoryStubs].sort((a, b) => compareStubs(a, b, filters.sortBy, filters.sortDir));
  const total = productIndex.total + accessoryIndex.total;

  const from = (filters.page - 1) * filters.perPage;
  const pageStubs = merged.slice(from, from + filters.perPage);
  if (pageStubs.length === 0) {
    return { data: [], total };
  }

  const productIds = pageStubs.filter((s) => s.catalog_item === "product").map((s) => s.id);
  const accessoryIds = pageStubs.filter((s) => s.catalog_item === "accessory").map((s) => s.id);

  const [products, accessories] = await Promise.all([
    readProductDetails(productIds),
    readCatalogRowsByIds(accessoryIds, (batch) =>
      supabase.from("accessories").select(ACCESSORY_SELECT).in("id", batch).returns<AccessoryRow[]>(),
    ),
  ]);

  const productById = new Map(
    products.map((r) => [
      r.id as string,
      { ...r, id: r.id as string, catalog_item: "product" as const },
    ]),
  );
  const accessoryById = new Map(
    accessories.map((r) => [r.id, mapAccessoryToAdminListRow(r)]),
  );

  const data = pageStubs.map((stub) =>
    stub.catalog_item === "accessory" ? accessoryById.get(stub.id) : productById.get(stub.id),
  ).filter((row) => row !== undefined);
  return { data, total };
}
