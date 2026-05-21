import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { applyPublicCatalogFilter } from "@/lib/catalog/publicProductVisibility";
import { CATALOG_BTU_OPTIONS, inferBtuFromCoolingKw } from "@/lib/catalog/productBtu";
import {
  countRepresentativesByCategory,
  fetchPublicCatalogRepresentatives,
  resolveCategoryTypeIds,
} from "@/lib/catalog/publicCatalogDedup";

const QuerySchema = z.object({
  cond: z.enum(["new", "used"]).optional(),
});

function normalizeNominal(btu: number | null | undefined, coolingKw: number | null | undefined): number | null {
  const nominal = btu != null ? Math.round(Number(btu)) : inferBtuFromCoolingKw(coolingKw);
  if (nominal == null || !(CATALOG_BTU_OPTIONS as readonly number[]).includes(nominal)) return null;
  return nominal;
}

async function fetchPriceBounds(supabase: ReturnType<typeof createSupabaseServiceRoleClient>, cond?: "new" | "used") {
  const run = (withCondition: boolean) =>
    Promise.all([
      (withCondition && cond
        ? applyPublicCatalogFilter(supabase.from("products").select("price")).eq("product_condition", cond)
        : applyPublicCatalogFilter(supabase.from("products").select("price")))
        .order("price", { ascending: true })
        .limit(1),
      (withCondition && cond
        ? applyPublicCatalogFilter(supabase.from("products").select("price")).eq("product_condition", cond)
        : applyPublicCatalogFilter(supabase.from("products").select("price")))
        .order("price", { ascending: false })
        .limit(1),
    ]);

  let [asc, desc] = await run(Boolean(cond));
  const missing =
    cond &&
    ((asc.error && String(asc.error.message ?? "").includes("product_condition")) ||
      (desc.error && String(desc.error.message ?? "").includes("product_condition")));
  if (missing) [asc, desc] = await run(false);
  if (asc.error) throw new Error(asc.error.message);
  if (desc.error) throw new Error(desc.error.message);
  const min = Number(asc.data?.[0]?.price ?? 0);
  const max = Number(desc.data?.[0]?.price ?? 0);
  return { min, max: max || min };
}

function brandOptionsFromRepresentatives(
  brands: Array<{ id: string; name: string }>,
  reps: Awaited<ReturnType<typeof fetchPublicCatalogRepresentatives>>,
) {
  const counts = new Map<string, number>();
  for (const r of reps) {
    if (!r.brandId) continue;
    counts.set(r.brandId, (counts.get(r.brandId) ?? 0) + 1);
  }
  return brands
    .map((b) => ({ name: b.name, productCount: counts.get(b.id) ?? 0 }))
    .filter((b) => b.productCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));
}

async function fetchBtuOptions(supabase: ReturnType<typeof createSupabaseServiceRoleClient>, cond?: "new" | "used") {
  const { data, error } = await supabase.rpc("catalog_btu_option_counts", { p_cond: cond ?? null });
  const counts = new Map<number, number>();
  if (!error) {
    for (const row of (data ?? []) as Array<{ nominal_btu?: number; product_count?: number }>) {
      const btu = normalizeNominal(row.nominal_btu, null);
      const n = row.product_count != null ? Number(row.product_count) : 0;
      if (btu != null && n > 0) counts.set(btu, (counts.get(btu) ?? 0) + n);
    }
  }
  return CATALOG_BTU_OPTIONS.map((btu) => ({ btu, productCount: counts.get(btu) ?? 0 })).filter(
    (r) => r.productCount > 0,
  );
}

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/** Обединява price-bounds, category-counts, brand-options, btu-options в един round-trip. */
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid query" }, { status: 400 }));
  }
  const cond = parsed.data.cond;
  const supabase = createSupabaseServiceRoleClient();

  try {
    const [priceBounds, btuOptions, reps, typeIdsByCategory, brandRows] = await Promise.all([
      fetchPriceBounds(supabase, cond),
      fetchBtuOptions(supabase, cond),
      fetchPublicCatalogRepresentatives(supabase, { cond }),
      resolveCategoryTypeIds(supabase),
      supabase.from("brands").select("id,name,is_active").eq("is_active", true).order("name", { ascending: true }),
    ]);

    if (brandRows.error) throw new Error(brandRows.error.message);

    const categoryCounts = countRepresentativesByCategory(reps, typeIdsByCategory);
    const brandOptions = brandOptionsFromRepresentatives(
      (brandRows.data ?? []) as Array<{ id: string; name: string }>,
      reps,
    );

    const res = withCors(
      req,
      NextResponse.json({
        data: {
          priceBounds,
          categoryCounts,
          brandOptions,
          btuOptions,
        },
      }),
    );
    res.headers.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[catalog/meta]", message);
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
