import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { optimizeImageRowUrls } from "@/lib/services/cloudinaryService";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { applyPublicCatalogFilter } from "@/lib/catalog/publicProductVisibility";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

function isProductPublicLookupUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const key = String(slug ?? "").trim();
  // Use service role for public reads (server-side only) to avoid RLS embed issues.
  const supabase = createSupabaseServiceRoleClient();

  const SELECT_WITH_CONDITION =
    "id,slug,name,description,price,price_with_mount,product_condition,is_featured,rating,reviews_count,meta_title,meta_description,brand_id,type_id";
  const SELECT_BASE =
    "id,slug,name,description,price,price_with_mount,is_featured,rating,reviews_count,meta_title,meta_description,brand_id,type_id";

  const loadProduct = async (includeCondition: boolean) => {
    const selectCols: string = includeCondition ? SELECT_WITH_CONDITION : SELECT_BASE;
    const q = applyPublicCatalogFilter((supabase.from("products") as any).select(selectCols));
    if (isProductPublicLookupUuid(key)) {
      return q.eq("id", key).maybeSingle();
    }
    return q.eq("slug", key).maybeSingle();
  };

  let { data: p, error: pErr } = await loadProduct(true);
  const isMissingConditionColumn =
    !!pErr &&
    (String((pErr as any).code ?? "") === "42703" ||
      String((pErr as any).message ?? "").includes("product_condition"));
  if (isMissingConditionColumn) {
    ({ data: p, error: pErr } = await loadProduct(false));
  }

  if (pErr) return withCors(req, NextResponse.json({ error: pErr.message }, { status: 500 }));
  if (!p) {
    return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  const SPECS_SELECT_WITH_DIMENSIONS =
    "coverage_m2,noise_db,cooling_power_kw,heating_power_kw,refrigerant,wifi,energy_class_cool,energy_class_heat,seer,scop,warranty_months,weight_indoor_kg,weight_outdoor_kg,dim_indoor_length_mm,dim_indoor_width_mm,dim_indoor_height_mm,dim_outdoor_length_mm,dim_outdoor_width_mm,dim_outdoor_height_mm";
  const SPECS_SELECT_BASE =
    "coverage_m2,noise_db,cooling_power_kw,heating_power_kw,refrigerant,wifi,energy_class_cool,energy_class_heat,seer,scop,warranty_months";

  let specsRes = await supabase
    .from("product_specs")
    .select(SPECS_SELECT_WITH_DIMENSIONS)
    .eq("product_id", p.id);
  if (
    specsRes.error &&
    (String((specsRes.error as any).code ?? "") === "42703" ||
      /weight_(indoor|outdoor)_kg|dim_(indoor|outdoor)_(length|width|height)_mm/.test(
        String((specsRes.error as any).message ?? ""),
      ))
  ) {
    specsRes = (await supabase
      .from("product_specs")
      .select(SPECS_SELECT_BASE)
      .eq("product_id", p.id)) as typeof specsRes;
  }

  const [bRes, tRes, iRes, pfRes] = await Promise.all([
    supabase.from("brands").select("id,slug,name").eq("id", (p as any).brand_id).maybeSingle(),
    supabase.from("product_types").select("id,name").eq("id", (p as any).type_id).maybeSingle(),
    supabase.from("product_images").select("url,sort_order,is_main").eq("product_id", p.id).order("sort_order", { ascending: true }),
    supabase.from("product_features").select("feature_id").eq("product_id", p.id),
  ]);
  const sRes = specsRes;

  if (bRes.error) return withCors(req, NextResponse.json({ error: bRes.error.message }, { status: 500 }));
  if (tRes.error) return withCors(req, NextResponse.json({ error: tRes.error.message }, { status: 500 }));
  if (sRes.error) return withCors(req, NextResponse.json({ error: sRes.error.message }, { status: 500 }));
  if (iRes.error) return withCors(req, NextResponse.json({ error: iRes.error.message }, { status: 500 }));
  if (pfRes.error) return withCors(req, NextResponse.json({ error: pfRes.error.message }, { status: 500 }));

  const featIds = (pfRes.data ?? []).map((r: any) => r.feature_id).filter(Boolean);
  const featRes =
    featIds.length > 0 ? await supabase.from("features").select("id,slug,name").in("id", featIds) : { data: [], error: null };
  if ((featRes as any).error) return withCors(req, NextResponse.json({ error: (featRes as any).error.message }, { status: 500 }));
  const featById = new Map(((featRes as any).data ?? []).map((f: any) => [f.id, f]));

  const data = {
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    price: p.price,
    price_with_mount: p.price_with_mount,
    product_condition: (p as any).product_condition ?? "new",
    is_featured: p.is_featured,
    rating: p.rating,
    reviews_count: p.reviews_count,
    meta_title: p.meta_title,
    meta_description: p.meta_description,
    brands: bRes.data ?? null,
    product_types: tRes.data ?? null,
    product_specs: sRes.data ?? [],
    product_images: optimizeImageRowUrls(iRes.data ?? []),
    product_features: (pfRes.data ?? [])
      .map((r: any) => featById.get(r.feature_id))
      .filter(Boolean)
      .map((f: any) => ({ features: { slug: f.slug, name: f.name } })),
  };

  return withCors(req, NextResponse.json({ data }));
}

