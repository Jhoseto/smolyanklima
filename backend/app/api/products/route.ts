import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const QuerySchema = z.object({
  q: z.string().optional(),
  cat: z.string().optional(),
  b: z.string().optional(), // comma-separated brand names
  e: z.string().optional(), // comma-separated energy classes
  f: z.string().optional(), // comma-separated feature names
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
  s: z
    .enum(["recommended", "price-asc", "price-desc", "energy-class", "noise-asc", "rating-desc"])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

function splitCsv(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid query" }, { status: 400 }));
  }

  const { q, cat, b, e, f, min, max, s, page = 1, perPage = 24 } = parsed.data;
  const brands = splitCsv(b);
  const energyClasses = splitCsv(e);
  const features = splitCsv(f);

  // Use service role for public reads (server-side only) to avoid RLS embed issues.
  const supabase = createSupabaseServiceRoleClient();

  // Base query: denormalized read via joins using select syntax.
  let query = supabase
    .from("products")
    .select(
      `
      id, slug, name, description, price, price_with_mount, old_price,
      is_active, is_featured, stock_status, stock_quantity, rating, reviews_count,
      meta_title, meta_description,
      brand_id, type_id
    `,
      { count: "exact" },
    )
    .eq("is_active", true);

  // Category (UI facet) → map to product_types via category_types table (names)
  if (cat && cat !== "all") {
    const { data: catRow } = await supabase.from("categories").select("id").eq("slug", cat).maybeSingle();
    if (catRow?.id) {
      const { data: ctRows } = await supabase
        .from("category_types")
        .select("product_type")
        .eq("category_id", catRow.id);
      const typeNames = (ctRows ?? []).map((r) => r.product_type).filter(Boolean);
      if (typeNames.length > 0) {
        query = query.in("product_types.name", typeNames);
      }
    }
  }

  // Brands (names)
  if (brands.length > 0) {
    query = query.in("brands.name", brands);
  }

  // Energy classes
  if (energyClasses.length > 0) {
    query = query.in("product_specs.energy_class_cool", energyClasses);
  }

  // Features (names) — filter via nested relationship
  if (features.length > 0) {
    // Supabase doesn't support deep IN easily; approximate via ilike OR.
    // Backend adapter can be improved later by using RPC.
    for (const feat of features) {
      query = query.ilike("product_features.features.name", `%${feat}%`);
    }
  }

  // Price range
  if (typeof min === "number") query = query.gte("price", min);
  if (typeof max === "number") query = query.lte("price", max);

  // Search
  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }

  // Sorting
  switch (s) {
    case "price-asc":
      query = query.order("price", { ascending: true });
      break;
    case "price-desc":
      query = query.order("price", { ascending: false });
      break;
    case "rating-desc":
      query = query.order("rating", { ascending: false });
      break;
    default:
      query = query.order("is_featured", { ascending: false }).order("price", { ascending: true });
      break;
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query.range(from, to);

  if (error) {
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  const rows = (data ?? []) as Array<any>;
  const brandIds = Array.from(new Set(rows.map((r) => r.brand_id).filter(Boolean)));
  const typeIds = Array.from(new Set(rows.map((r) => r.type_id).filter(Boolean)));
  const productIds = rows.map((r) => r.id);

  const [brandsRes, typesRes, specsRes, imagesRes, pfRes] = await Promise.all([
    brandIds.length > 0 ? supabase.from("brands").select("id,slug,name").in("id", brandIds) : Promise.resolve({ data: [], error: null } as any),
    typeIds.length > 0 ? supabase.from("product_types").select("id,name").in("id", typeIds) : Promise.resolve({ data: [], error: null } as any),
    productIds.length > 0
      ? supabase
          .from("product_specs")
          .select("product_id,coverage_m2,noise_db,cooling_power_kw,heating_power_kw,refrigerant,wifi,energy_class_cool,energy_class_heat,seer,scop,warranty_months")
          .in("product_id", productIds)
      : Promise.resolve({ data: [], error: null } as any),
    productIds.length > 0 ? supabase.from("product_images").select("product_id,url,sort_order,is_main").in("product_id", productIds) : Promise.resolve({ data: [], error: null } as any),
    productIds.length > 0 ? supabase.from("product_features").select("product_id,feature_id").in("product_id", productIds) : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (brandsRes.error) return withCors(req, NextResponse.json({ error: brandsRes.error.message }, { status: 500 }));
  if (typesRes.error) return withCors(req, NextResponse.json({ error: typesRes.error.message }, { status: 500 }));
  if (specsRes.error) return withCors(req, NextResponse.json({ error: specsRes.error.message }, { status: 500 }));
  if (imagesRes.error) return withCors(req, NextResponse.json({ error: imagesRes.error.message }, { status: 500 }));
  if (pfRes.error) return withCors(req, NextResponse.json({ error: pfRes.error.message }, { status: 500 }));

  const brandById = new Map((brandsRes.data ?? []).map((b: any) => [b.id, b]));
  const typeById = new Map((typesRes.data ?? []).map((t: any) => [t.id, t]));
  const specsByProduct = new Map<string, any[]>();
  for (const srow of specsRes.data ?? []) {
    const pid = (srow as any).product_id as string;
    const arr = specsByProduct.get(pid) ?? [];
    arr.push({ ...srow, product_id: undefined });
    specsByProduct.set(pid, arr);
  }
  const imagesByProduct = new Map<string, any[]>();
  for (const irow of imagesRes.data ?? []) {
    const pid = (irow as any).product_id as string;
    const arr = imagesByProduct.get(pid) ?? [];
    arr.push({ url: (irow as any).url, sort_order: (irow as any).sort_order, is_main: (irow as any).is_main });
    imagesByProduct.set(pid, arr);
  }

  const featureIds = Array.from(new Set((pfRes.data ?? []).map((r: any) => r.feature_id).filter(Boolean)));
  const featRes =
    featureIds.length > 0 ? await supabase.from("features").select("id,slug,name").in("id", featureIds) : ({ data: [], error: null } as any);
  if (featRes.error) return withCors(req, NextResponse.json({ error: featRes.error.message }, { status: 500 }));
  const featById = new Map((featRes.data ?? []).map((f: any) => [f.id, f as any]));
  const featsByProduct = new Map<string, any[]>();
  for (const link of pfRes.data ?? []) {
    const pid = (link as any).product_id as string;
    const f = featById.get((link as any).feature_id) as any;
    if (!f) continue;
    const arr = featsByProduct.get(pid) ?? [];
    arr.push({ features: { slug: f.slug, name: f.name } });
    featsByProduct.set(pid, arr);
  }

  const stitched = rows.map((r) => ({
    ...r,
    brands: brandById.get(r.brand_id) ?? null,
    product_types: typeById.get(r.type_id) ?? null,
    product_specs: specsByProduct.get(r.id) ?? [],
    product_images: imagesByProduct.get(r.id) ?? [],
    product_features: featsByProduct.get(r.id) ?? [],
  }));

  return withCors(
    req,
    NextResponse.json({
      data: stitched,
      meta: { page, perPage, total: count ?? 0 },
    }),
  );
}

