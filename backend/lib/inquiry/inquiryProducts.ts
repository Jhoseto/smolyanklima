import type { SupabaseClient } from "@supabase/supabase-js";
import { isPostgrestMissingRelation } from "@/lib/admin/pgMissingColumn";
import { parseProductNamesFromMessage } from "./inquiryMessage";
import { phonesMatch } from "./inquiryPhone";

export type InquiryProductRow = {
  id: string;
  inquiry_id: string;
  product_id: string | null;
  product_slug: string | null;
  product_name: string;
  created_at: string;
  image_url?: string | null;
  price?: number | null;
  price_with_mount?: number | null;
  brand_name?: string | null;
};

type CatalogProductPick = {
  id: string;
  slug: string;
  name: string;
  price: number | null;
  price_with_mount: number | null;
  brands: { name: string | null } | { name: string | null }[] | null;
  product_images: Array<{ url: string; sort_order?: number | null; is_main?: boolean | null }> | null;
};

function pickMainImageUrl(images: CatalogProductPick["product_images"]): string | null {
  if (!images?.length) return null;
  const sorted = [...images].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const main = sorted.find((img) => img.is_main)?.url ?? sorted[0]?.url;
  return main?.trim() || null;
}

function brandNameFromJoin(brands: CatalogProductPick["brands"]): string | null {
  if (!brands) return null;
  if (Array.isArray(brands)) return brands[0]?.name?.trim() || null;
  return brands.name?.trim() || null;
}

async function loadCatalogProductsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, CatalogProductPick>> {
  const map = new Map<string, CatalogProductPick>();
  if (!ids.length) return map;
  const { data, error } = await supabase
    .from("products")
    .select("id,slug,name,price,price_with_mount,brands:brand_id(name),product_images(url,sort_order,is_main)")
    .in("id", ids);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const p = row as CatalogProductPick;
    map.set(p.id, p);
  }
  return map;
}

async function loadCatalogProductsBySlugs(
  supabase: SupabaseClient,
  slugs: string[],
): Promise<Map<string, CatalogProductPick>> {
  const map = new Map<string, CatalogProductPick>();
  if (!slugs.length) return map;
  const { data, error } = await supabase
    .from("products")
    .select("id,slug,name,price,price_with_mount,brands:brand_id(name),product_images(url,sort_order,is_main)")
    .in("slug", slugs);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const p = row as CatalogProductPick;
    map.set(p.slug, p);
  }
  return map;
}

async function loadCatalogProductsByNames(
  supabase: SupabaseClient,
  names: string[],
): Promise<Map<string, CatalogProductPick>> {
  const map = new Map<string, CatalogProductPick>();
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  if (!unique.length) return map;

  const { data, error } = await supabase
    .from("products")
    .select("id,slug,name,price,price_with_mount,brands:brand_id(name),product_images(url,sort_order,is_main)")
    .in("name", unique);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const p = row as CatalogProductPick;
    map.set(p.name.trim().toLowerCase(), p);
  }

  const unmatched = unique.filter((n) => !map.has(n.toLowerCase()));
  for (const name of unmatched.slice(0, 12)) {
    const { data: one } = await supabase
      .from("products")
      .select("id,slug,name,price,price_with_mount,brands:brand_id(name),product_images(url,sort_order,is_main)")
      .ilike("name", name)
      .limit(1)
      .maybeSingle();
    if (one) {
      const p = one as CatalogProductPick;
      map.set(name.toLowerCase(), p);
    }
  }
  return map;
}

function buildLegacyInquiryProductRows(inquiry: {
  id: string;
  message?: string | null;
  product_id?: string | null;
}): InquiryProductRow[] {
  const names = parseProductNamesFromMessage(inquiry.message);
  const created_at = new Date().toISOString();

  if (!names.length && inquiry.product_id) {
    return [
      {
        id: `legacy-${inquiry.id}-0`,
        inquiry_id: inquiry.id,
        product_id: inquiry.product_id,
        product_slug: null,
        product_name: "Климатик",
        created_at,
      },
    ];
  }

  return names.map((product_name, index) => ({
    id: `legacy-${inquiry.id}-${index}`,
    inquiry_id: inquiry.id,
    product_id: index === 0 && inquiry.product_id ? inquiry.product_id : null,
    product_slug: null,
    product_name,
    created_at,
  }));
}

async function enrichInquiryProductRows(
  supabase: SupabaseClient,
  rows: InquiryProductRow[],
): Promise<InquiryProductRow[]> {
  if (!rows.length) return rows;
  const ids = [...new Set(rows.map((r) => r.product_id).filter((id): id is string => Boolean(id)))];
  const slugs = [
    ...new Set(
      rows
        .filter((r) => !r.product_id && r.product_slug)
        .map((r) => r.product_slug as string),
    ),
  ];
  const names = [
    ...new Set(
      rows
        .filter((r) => !r.product_id && !r.product_slug && r.product_name?.trim())
        .map((r) => r.product_name.trim()),
    ),
  ];

  const [byId, bySlug, byName] = await Promise.all([
    loadCatalogProductsByIds(supabase, ids),
    loadCatalogProductsBySlugs(supabase, slugs),
    loadCatalogProductsByNames(supabase, names),
  ]);

  return rows.map((row) => {
    const catalog =
      (row.product_id ? byId.get(row.product_id) : null) ??
      (row.product_slug ? bySlug.get(row.product_slug) : null) ??
      (row.product_name ? byName.get(row.product_name.trim().toLowerCase()) : null) ??
      null;
    if (!catalog) return row;
    return {
      ...row,
      product_id: row.product_id ?? catalog.id,
      product_slug: row.product_slug ?? catalog.slug,
      product_name: row.product_name || catalog.name,
      image_url: pickMainImageUrl(catalog.product_images),
      price: catalog.price != null ? Number(catalog.price) : null,
      price_with_mount: catalog.price_with_mount != null ? Number(catalog.price_with_mount) : null,
      brand_name: brandNameFromJoin(catalog.brands),
    };
  });
}

export type InquiryWithProducts = {
  id: string;
  source: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  message?: string | null;
  product_id?: string | null;
  service_type?: string | null;
  status: string;
  priority: string;
  assigned_to?: string | null;
  admin_notes?: string | null;
  created_at: string;
  updated_at?: string;
  products: InquiryProductRow[];
};

const ACTIVE_STATUSES = ["new", "in_progress"] as const;

export async function findActiveInquiryForPhone(
  supabase: SupabaseClient,
  phone: string,
): Promise<{ id: string; customer_name: string; message: string | null } | null> {
  const { data, error } = await supabase
    .from("inquiries")
    .select("id,customer_name,customer_phone,message,status,created_at")
    .in("status", [...ACTIVE_STATUSES])
    .order("created_at", { ascending: false })
    .limit(80);
  if (error || !data?.length) return null;
  const match = data.find((row) => phonesMatch(String(row.customer_phone ?? ""), phone));
  if (!match) return null;
  return {
    id: match.id as string,
    customer_name: String(match.customer_name ?? ""),
    message: (match.message as string | null) ?? null,
  };
}

export async function appendProductToInquiry(
  supabase: SupabaseClient,
  inquiryId: string,
  opts: { productId: string | null; productSlug?: string | null; productName: string },
): Promise<{ added: boolean }> {
  if (opts.productId) {
    const { data: existing, error: findErr } = await supabase
      .from("inquiry_products")
      .select("id")
      .eq("inquiry_id", inquiryId)
      .eq("product_id", opts.productId)
      .maybeSingle();
    if (findErr && isPostgrestMissingRelation(findErr, "inquiry_products")) return { added: false };
    if (findErr) throw new Error(findErr.message);
    if (existing?.id) return { added: false };
  } else if (opts.productSlug) {
    const { data: existing, error: findErr } = await supabase
      .from("inquiry_products")
      .select("id")
      .eq("inquiry_id", inquiryId)
      .eq("product_slug", opts.productSlug)
      .maybeSingle();
    if (findErr && isPostgrestMissingRelation(findErr, "inquiry_products")) return { added: false };
    if (findErr) throw new Error(findErr.message);
    if (existing?.id) return { added: false };
  }

  const { error } = await supabase.from("inquiry_products").insert({
    inquiry_id: inquiryId,
    product_id: opts.productId,
    product_slug: opts.productSlug ?? null,
    product_name: opts.productName,
  });

  if (error) {
    if (error.code === "23505") return { added: false };
    if (isPostgrestMissingRelation(error, "inquiry_products")) return { added: false };
    throw new Error(error.message);
  }
  return { added: true };
}

export async function attachProductsToInquiries<
  T extends { id: string; message?: string | null; product_id?: string | null },
>(
  supabase: SupabaseClient,
  inquiries: T[],
): Promise<Array<T & { products: InquiryProductRow[] }>> {
  if (!inquiries.length) return [];
  const ids = inquiries.map((i) => i.id);
  const byInquiry = new Map<string, InquiryProductRow[]>();
  const { data, error } = await supabase
    .from("inquiry_products")
    .select("id,inquiry_id,product_id,product_slug,product_name,created_at")
    .in("inquiry_id", ids)
    .order("created_at", { ascending: true });

  if (!error) {
    for (const row of data ?? []) {
      const inquiryId = String((row as InquiryProductRow).inquiry_id);
      const list = byInquiry.get(inquiryId) ?? [];
      list.push(row as InquiryProductRow);
      byInquiry.set(inquiryId, list);
    }
  } else if (!isPostgrestMissingRelation(error, "inquiry_products")) {
    throw new Error(error.message);
  }

  const enrichedByInquiry = new Map<string, InquiryProductRow[]>();
  for (const inq of inquiries) {
    const fromTable = byInquiry.get(inq.id) ?? [];
    const list = fromTable.length > 0 ? fromTable : buildLegacyInquiryProductRows(inq);
    if (!list.length) {
      enrichedByInquiry.set(inq.id, []);
      continue;
    }
    try {
      enrichedByInquiry.set(inq.id, await enrichInquiryProductRows(supabase, list));
    } catch {
      enrichedByInquiry.set(inq.id, list);
    }
  }

  return inquiries.map((inq) => ({
    ...inq,
    products: enrichedByInquiry.get(inq.id) ?? [],
  }));
}
