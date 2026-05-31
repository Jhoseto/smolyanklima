import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeIlikeTerm } from "@/lib/security/sanitizeSearchTerm";

export type AdminCatalogKind = "climatics" | "accessories" | "all";

export type AdminCatalogListFilters = {
  q?: string;
  stockStatuses?: ("in_stock" | "out_of_stock" | "on_order")[];
  brandId?: string;
  priceMin?: number;
  priceMax?: number;
  sortBy: "name" | "price" | "purchase_price" | "product_condition" | "purchased_at";
  sortDir: "asc" | "desc";
  page: number;
  perPage: number;
};

const ACCESSORY_SELECT =
  "id,slug,name,price,stock_status,stock_quantity,is_active,source_url,created_at,brand_id,kind,brands:brand_id(name)";

const ACCESSORY_STUB_SELECT = "id,name,price,created_at";

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
    const t = sanitizeIlikeTerm(filters.q);
    if (t) query = query.or(`name.ilike.%${t}%,slug.ilike.%${t}%,description.ilike.%${t}%`);
  }
  if (filters.stockStatuses?.length) {
    if (filters.stockStatuses.length === 1) {
      query = query.eq("stock_status", filters.stockStatuses[0]);
    } else {
      query = query.in("stock_status", filters.stockStatuses);
    }
  }
  if (filters.brandId) query = query.eq("brand_id", filters.brandId);
  if (filters.priceMin !== undefined) query = query.gte("price", filters.priceMin);
  if (filters.priceMax !== undefined) query = query.lte("price", filters.priceMax);
  return query;
}

function accessoryOrderCol(sortBy: AdminCatalogListFilters["sortBy"]) {
  return sortBy === "price" ? "price" : "name";
}

export async function listAdminAccessories(
  supabase: SupabaseClient,
  filters: AdminCatalogListFilters,
): Promise<{ data: ReturnType<typeof mapAccessoryToAdminListRow>[]; total: number }> {
  const from = (filters.page - 1) * filters.perPage;
  const to = from + filters.perPage - 1;
  const orderCol = accessoryOrderCol(filters.sortBy);
  const res = await applyAccessoryFilters(supabase, filters, ACCESSORY_SELECT, true)
    .order(orderCol, { ascending: filters.sortDir === "asc" })
    .order("name", { ascending: true })
    .range(from, to);
  if (res.error) throw new Error(res.error.message);
  const rows = ((res.data ?? []) as unknown as AccessoryRow[]).map(mapAccessoryToAdminListRow);
  return { data: rows, total: res.count ?? 0 };
}

type MergeStub = {
  catalog_item: "product" | "accessory";
  id: string;
  name: string;
  price: number;
  product_condition?: string | null;
  purchased_at?: string | null;
  created_at?: string | null;
};

function sortValue(row: MergeStub, sortBy: AdminCatalogListFilters["sortBy"]): string | number {
  switch (sortBy) {
    case "price":
      return row.price;
    case "product_condition":
      return row.product_condition ?? "";
    case "purchased_at":
      return row.purchased_at ?? "";
    default:
      return row.name;
  }
}

function compareStubs(a: MergeStub, b: MergeStub, sortBy: AdminCatalogListFilters["sortBy"], sortDir: "asc" | "desc") {
  const av = sortValue(a, sortBy);
  const bv = sortValue(b, sortBy);
  let cmp = 0;
  if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
  else cmp = String(av).localeCompare(String(bv), "bg");
  if (cmp === 0) cmp = a.name.localeCompare(b.name, "bg");
  return sortDir === "asc" ? cmp : -cmp;
}

const MERGE_LIST_CAP = 4000;

export async function listAdminCatalogMerged(
  supabase: SupabaseClient,
  filters: AdminCatalogListFilters,
  productStubs: MergeStub[],
  productTotal: number,
): Promise<{ data: ReturnType<typeof mapAccessoryToAdminListRow>[]; total: number }> {
  const accRes = await applyAccessoryFilters(supabase, filters, ACCESSORY_STUB_SELECT, true).limit(MERGE_LIST_CAP);
  if (accRes.error) throw new Error(accRes.error.message);

  const accessoryStubs: MergeStub[] = ((accRes.data ?? []) as unknown as { id: string; name: string; price: number; created_at: string }[]).map(
    (r) => ({
      catalog_item: "accessory" as const,
      id: r.id,
      name: r.name,
      price: r.price,
      product_condition: "new",
      purchased_at: null,
      created_at: r.created_at,
    }),
  );

  const cappedProducts = productStubs.length >= MERGE_LIST_CAP;
  const cappedAccessories = (accRes.data?.length ?? 0) >= MERGE_LIST_CAP;
  const total = productTotal + (accRes.count ?? 0);
  const merged = [...productStubs, ...accessoryStubs].sort((a, b) => compareStubs(a, b, filters.sortBy, filters.sortDir));

  const from = (filters.page - 1) * filters.perPage;
  const pageStubs = merged.slice(from, from + filters.perPage);
  if (pageStubs.length === 0) {
    return { data: [], total: cappedProducts || cappedAccessories ? Math.min(total, MERGE_LIST_CAP * 2) : total };
  }

  const productIds = pageStubs.filter((s) => s.catalog_item === "product").map((s) => s.id);
  const accessoryIds = pageStubs.filter((s) => s.catalog_item === "accessory").map((s) => s.id);

  const [productsRes, accessoriesRes] = await Promise.all([
    productIds.length
      ? supabase
          .from("products")
          .select(
            "id,slug,name,price,purchase_price,product_condition,is_featured,is_active,show_in_public_catalog,stock_status,stock_quantity,sold_quantity,created_at,purchased_at,brand_id,brands:brand_id(name),product_types:type_id(name)",
          )
          .in("id", productIds)
      : Promise.resolve({ data: [], error: null }),
    accessoryIds.length
      ? supabase.from("accessories").select(ACCESSORY_SELECT).in("id", accessoryIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsRes.error) throw new Error(productsRes.error.message);
  if (accessoriesRes.error) throw new Error(accessoriesRes.error.message);

  const productById = new Map(
    ((productsRes.data ?? []) as Record<string, unknown>[]).map((r) => [
      r.id as string,
      { ...r, catalog_item: "product" as const },
    ]),
  );
  const accessoryById = new Map(
    ((accessoriesRes.data ?? []) as unknown as AccessoryRow[]).map((r) => [r.id, mapAccessoryToAdminListRow(r)]),
  );

  const data = pageStubs.map((stub) => {
    if (stub.catalog_item === "accessory") return accessoryById.get(stub.id)!;
    return productById.get(stub.id)!;
  });

  return {
    data: data as ReturnType<typeof mapAccessoryToAdminListRow>[],
    total: cappedProducts || cappedAccessories ? Math.min(total, MERGE_LIST_CAP * 2) : total,
  };
}
