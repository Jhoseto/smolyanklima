import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { withCloudinaryWebOptimization } from "@/lib/services/cloudinaryService";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const QuerySchema = z.object({
  q: z.string().optional(),
  cat: z.string().optional(),
  b: z.string().optional(),
  e: z.string().optional(),
  f: z.string().optional(),
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

function intersectIds(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
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
  const brandNames = splitCsv(b);
  const energyClasses = splitCsv(e);
  const featureTerms = splitCsv(f);

  const supabase = createSupabaseServiceRoleClient();

  /** `null` = no id restriction; non-null array = restrict to these ids; `empty` = impossible match */
  let idRestriction: string[] | null | "empty" = null;

  function mergeProductIds(ids: string[]): void {
    if (ids.length === 0) {
      idRestriction = "empty";
      return;
    }
    if (idRestriction === "empty") return;
    const prev = idRestriction;
    idRestriction = prev === null ? ids : intersectIds(prev, ids);
    if (idRestriction.length === 0) idRestriction = "empty";
  }

  // Search (FTS + ILIKE via RPC; fallback if migration not applied yet)
  if (q && q.trim()) {
    const term = q.trim();
    const { data: searchRows, error: rpcErr } = await supabase.rpc("search_product_ids", {
      search_query: term,
      result_limit: 5000,
    });
    let ids: string[] = [];
    if (rpcErr) {
      const { data: fb, error: fbErr } = await supabase
        .from("products")
        .select("id")
        .eq("is_active", true)
        .or(`name.ilike.%${term}%,description.ilike.%${term}%`);
      if (fbErr) return withCors(req, NextResponse.json({ error: fbErr.message }, { status: 500 }));
      ids = (fb ?? []).map((r: { id: string }) => r.id);
    } else {
      ids = (searchRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
    }
    mergeProductIds(ids);
  }

  // Category slug → product_type ids
  if (cat && cat !== "all") {
    const { data: catRow } = await supabase.from("categories").select("id").eq("slug", cat).maybeSingle();
    if (!catRow?.id) {
      mergeProductIds([]);
    } else {
      const { data: ctRows } = await supabase
        .from("category_types")
        .select("product_type")
        .eq("category_id", catRow.id);
      const typeNames = (ctRows ?? []).map((r) => r.product_type).filter(Boolean);
      if (typeNames.length === 0) {
        mergeProductIds([]);
      } else {
        const { data: types } = await supabase.from("product_types").select("id").in("name", typeNames);
        const typeIds = (types ?? []).map((t: { id: string }) => t.id);
        const { data: prows } = await supabase.from("products").select("id").eq("is_active", true).in("type_id", typeIds);
        mergeProductIds((prows ?? []).map((p: { id: string }) => p.id));
      }
    }
  }

  // Brand names → brand_id → product ids
  if (brandNames.length > 0) {
    const { data: brows } = await supabase.from("brands").select("id").in("name", brandNames);
    const brandIds = (brows ?? []).map((r: { id: string }) => r.id);
    if (brandIds.length === 0) {
      mergeProductIds([]);
    } else {
      const { data: prows } = await supabase.from("products").select("id").eq("is_active", true).in("brand_id", brandIds);
      mergeProductIds((prows ?? []).map((p: { id: string }) => p.id));
    }
  }

  // Energy classes via product_specs
  if (energyClasses.length > 0) {
    const { data: srows } = await supabase
      .from("product_specs")
      .select("product_id")
      .in("energy_class_cool", energyClasses);
    const ids = [...new Set((srows ?? []).map((r: { product_id: string }) => r.product_id).filter(Boolean))];
    mergeProductIds(ids);
  }

  // Features: AND — product must match every term (ilike on feature name)
  for (const term of featureTerms) {
    const { data: feats } = await supabase.from("features").select("id").ilike("name", `%${term}%`);
    const featIds = (feats ?? []).map((r: { id: string }) => r.id);
    if (featIds.length === 0) {
      mergeProductIds([]);
      break;
    }
    const { data: links } = await supabase.from("product_features").select("product_id").in("feature_id", featIds);
    const ids = [...new Set((links ?? []).map((r: { product_id: string }) => r.product_id))];
    mergeProductIds(ids);
  }

  if (idRestriction === "empty") {
    return withCors(
      req,
      NextResponse.json({
        data: [],
        meta: { page, perPage, total: 0 },
      }),
    );
  }

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

  if (idRestriction !== null && idRestriction !== "empty") query = query.in("id", idRestriction);
  if (typeof min === "number") query = query.gte("price", min);
  if (typeof max === "number") query = query.lte("price", max);

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
    case "energy-class":
      query = query.order("id", { ascending: true });
      break;
    case "noise-asc":
      query = query.order("id", { ascending: true });
      break;
    default:
      query = query.order("is_featured", { ascending: false }).order("price", { ascending: true });
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  let { data, error, count } = await query.range(from, to);

  if (error) {
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  let rows = (data ?? []) as Array<Record<string, unknown>>;

  // Client-visible sort for specs-backed fields (same-page only; total count still correct)
  if ((s === "noise-asc" || s === "energy-class") && rows.length > 1) {
    const pids = rows.map((r) => r.id as string);
    const { data: specRows } = await supabase
      .from("product_specs")
      .select("product_id,noise_db,energy_class_cool")
      .in("product_id", pids);
    const specByPid = new Map((specRows ?? []).map((r: any) => [r.product_id as string, r]));
    rows = [...rows].sort((a, b) => {
      const sa = specByPid.get(a.id as string);
      const sb = specByPid.get(b.id as string);
      if (s === "noise-asc") {
        const na = Number(sa?.noise_db ?? 999);
        const nb = Number(sb?.noise_db ?? 999);
        return na - nb;
      }
      const ea = String(sa?.energy_class_cool ?? "");
      const eb = String(sb?.energy_class_cool ?? "");
      return eb.localeCompare(ea);
    });
  }

  const brandIds = Array.from(new Set(rows.map((r) => r.brand_id).filter(Boolean))) as string[];
  const typeIds = Array.from(new Set(rows.map((r) => r.type_id).filter(Boolean))) as string[];
  const productIds = rows.map((r) => r.id as string);

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
    arr.push({
      url: withCloudinaryWebOptimization((irow as any).url),
      sort_order: (irow as any).sort_order,
      is_main: (irow as any).is_main,
    });
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
    brands: brandById.get(r.brand_id as string) ?? null,
    product_types: typeById.get(r.type_id as string) ?? null,
    product_specs: specsByProduct.get(r.id as string) ?? [],
    product_images: imagesByProduct.get(r.id as string) ?? [],
    product_features: featsByProduct.get(r.id as string) ?? [],
  }));

  return withCors(
    req,
    NextResponse.json({
      data: stitched,
      meta: { page, perPage, total: count ?? 0 },
    }),
  );
}
