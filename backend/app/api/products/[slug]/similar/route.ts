import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { applyPublicCatalogFilter } from "@/lib/catalog/publicProductVisibility";
import {
  dedupeProductRowsByModel,
  pickTopSimilarProducts,
  type SimilarProductRow,
} from "@/lib/catalog/similarProducts";
import { stripImportSourceFromDescription } from "@/lib/import/stripImportSourceFromDescription";
import { withCloudinaryWebOptimization } from "@/lib/services/cloudinaryService";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

function isProductPublicLookupUuid(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim());
}

const CANDIDATE_SELECT_WITH_MODEL =
  "id,slug,name,description,price,price_with_mount,product_condition,brand_id,type_id,model_code,stock_status,sold_quantity,created_at,is_featured,rating,reviews_count";
const CANDIDATE_SELECT_BASE =
  "id,slug,name,description,price,price_with_mount,brand_id,type_id,stock_status,created_at,is_featured,rating,reviews_count";

const SPECS_SELECT =
  "product_id,coverage_m2,noise_db,cooling_power_kw,heating_power_kw,refrigerant,wifi,energy_class_cool,energy_class_heat,seer,scop,warranty_months";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const key = String(slug ?? "").trim();
  const limit = Math.min(6, Math.max(1, Number(new URL(req.url).searchParams.get("limit")) || 3));

  const supabase = createSupabaseServiceRoleClient();

  const loadSource = async (includeCondition: boolean, includeModel: boolean) => {
    const cols = includeModel
      ? includeCondition
        ? CANDIDATE_SELECT_WITH_MODEL
        : CANDIDATE_SELECT_WITH_MODEL.replace(",product_condition", "")
      : includeCondition
        ? CANDIDATE_SELECT_BASE + ",product_condition"
        : CANDIDATE_SELECT_BASE;
    const q = applyPublicCatalogFilter((supabase.from("products") as any).select(cols));
    if (isProductPublicLookupUuid(key)) return q.eq("id", key).maybeSingle();
    return q.eq("slug", key).maybeSingle();
  };

  let { data: source, error: sourceErr } = await loadSource(true, true);
  if (
    sourceErr &&
    (String((sourceErr as any).code ?? "") === "42703" ||
      /product_condition|model_code|sold_quantity/.test(String((sourceErr as any).message ?? "")))
  ) {
    ({ data: source, error: sourceErr } = await loadSource(false, false));
  }
  if (sourceErr) return withCors(req, NextResponse.json({ error: sourceErr.message }, { status: 500 }));
  if (!source) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

  const sourceId = source.id as string;
  const sourceTypeId = source.type_id as string | null;

  const { data: sourceSpecs } = await supabase
    .from("product_specs")
    .select(SPECS_SELECT)
    .eq("product_id", sourceId)
    .limit(1);

  const sourceRow: SimilarProductRow = {
    ...(source as SimilarProductRow),
    product_specs: (sourceSpecs ?? []).map(({ product_id: _pid, ...rest }) => rest),
  };

  const buildCandidatesQuery = (includeCondition: boolean, includeModel: boolean) => {
    const cols = includeModel
      ? includeCondition
        ? CANDIDATE_SELECT_WITH_MODEL
        : CANDIDATE_SELECT_WITH_MODEL.replace(",product_condition", "")
      : includeCondition
        ? CANDIDATE_SELECT_BASE + ",product_condition"
        : CANDIDATE_SELECT_BASE;
    let q = applyPublicCatalogFilter((supabase.from("products") as any).select(cols)).neq("id", sourceId);
    if (sourceTypeId) q = q.eq("type_id", sourceTypeId);
    return q
      .order("stock_status", { ascending: true })
      .order("sold_quantity", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true })
      .limit(800);
  };

  let candRes: any = await buildCandidatesQuery(true, true);
  if (
    candRes.error &&
    (String(candRes.error.code ?? "") === "42703" ||
      /product_condition|model_code|sold_quantity/.test(String(candRes.error.message ?? "")))
  ) {
    candRes = await buildCandidatesQuery(false, false);
  }
  if (candRes.error) return withCors(req, NextResponse.json({ error: candRes.error.message }, { status: 500 }));

  const deduped = dedupeProductRowsByModel((candRes.data ?? []) as SimilarProductRow[]);
  const candidateIds = deduped.map((r) => r.id);

  if (candidateIds.length === 0) {
    return withCors(req, NextResponse.json({ data: [] }));
  }

  const { data: specRows, error: specErr } = await supabase
    .from("product_specs")
    .select(SPECS_SELECT)
    .in("product_id", candidateIds);
  if (specErr) return withCors(req, NextResponse.json({ error: specErr.message }, { status: 500 }));

  const specsByProduct = new Map<string, SimilarProductRow["product_specs"]>();
  for (const row of specRows ?? []) {
    const pid = (row as { product_id: string }).product_id;
    const { product_id: _pid, ...rest } = row as Record<string, unknown> & { product_id: string };
    const arr = specsByProduct.get(pid) ?? [];
    arr.push(rest as NonNullable<SimilarProductRow["product_specs"]>[number]);
    specsByProduct.set(pid, arr);
  }

  const withSpecs = deduped.map((r) => ({
    ...r,
    product_specs: specsByProduct.get(r.id) ?? [],
  }));

  const picked = pickTopSimilarProducts(sourceRow, withSpecs, limit);
  if (picked.length === 0) {
    return withCors(req, NextResponse.json({ data: [] }));
  }

  const pickedIds = picked.map((p) => p.id);
  const brandIds = Array.from(new Set(picked.map((p) => p.brand_id).filter(Boolean))) as string[];
  const typeIds = Array.from(new Set(picked.map((p) => p.type_id).filter(Boolean))) as string[];

  const [brandsRes, typesRes, imagesRes, pfRes] = await Promise.all([
    brandIds.length > 0
      ? supabase.from("brands").select("id,slug,name").in("id", brandIds)
      : Promise.resolve({ data: [], error: null } as any),
    typeIds.length > 0
      ? supabase.from("product_types").select("id,name").in("id", typeIds)
      : Promise.resolve({ data: [], error: null } as any),
    supabase.from("product_images").select("product_id,url,sort_order,is_main").in("product_id", pickedIds),
    supabase.from("product_features").select("product_id,feature_id").in("product_id", pickedIds),
  ]);

  if (brandsRes.error) return withCors(req, NextResponse.json({ error: brandsRes.error.message }, { status: 500 }));
  if (typesRes.error) return withCors(req, NextResponse.json({ error: typesRes.error.message }, { status: 500 }));
  if (imagesRes.error) return withCors(req, NextResponse.json({ error: imagesRes.error.message }, { status: 500 }));
  if (pfRes.error) return withCors(req, NextResponse.json({ error: pfRes.error.message }, { status: 500 }));

  const brandById = new Map((brandsRes.data ?? []).map((b: any) => [b.id, b]));
  const typeById = new Map((typesRes.data ?? []).map((t: any) => [t.id, t]));

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
    featureIds.length > 0
      ? await supabase.from("features").select("id,slug,name").in("id", featureIds)
      : ({ data: [], error: null } as any);
  if (featRes.error) return withCors(req, NextResponse.json({ error: featRes.error.message }, { status: 500 }));
  const featById = new Map((featRes.data ?? []).map((f: any) => [f.id, f]));
  const featsByProduct = new Map<string, any[]>();
  for (const link of pfRes.data ?? []) {
    const pid = (link as any).product_id as string;
    const f = featById.get((link as any).feature_id);
    if (!f) continue;
    const arr = featsByProduct.get(pid) ?? [];
    arr.push({ features: { slug: f.slug, name: f.name } });
    featsByProduct.set(pid, arr);
  }

  const pickedById = new Map(picked.map((p) => [p.id, p]));
  const stitched = pickedIds
    .map((pid) => {
      const r = pickedById.get(pid);
      if (!r) return null;
      return {
        ...r,
        description: stripImportSourceFromDescription((r as any).description),
        brands: brandById.get(r.brand_id as string) ?? null,
        product_types: typeById.get(r.type_id as string) ?? null,
        product_specs: r.product_specs ?? [],
        product_images: imagesByProduct.get(pid) ?? [],
        product_features: featsByProduct.get(pid) ?? [],
      };
    })
    .filter(Boolean);

  return withCors(req, NextResponse.json({ data: stitched }));
}
