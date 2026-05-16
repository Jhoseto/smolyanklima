import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
import { CATALOG_BTU_OPTIONS, inferBtuFromCoolingKw } from "@/lib/catalog/productBtu";
import { applyPublicCatalogFilter } from "@/lib/catalog/publicProductVisibility";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const QuerySchema = z.object({
  cond: z.enum(["new", "used"]).optional(),
  onlyWithProducts: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid query" }, { status: 400 }));
  }
  const { cond, onlyWithProducts } = parsed.data;
  const supabase = createSupabaseServiceRoleClient();

  let productsQuery = applyPublicCatalogFilter(supabase.from("products").select("id"));
  if (cond) productsQuery = productsQuery.eq("product_condition", cond);
  const { data: productRows, error: pErr } = await productsQuery;
  if (pErr) return withCors(req, NextResponse.json({ error: pErr.message }, { status: 500 }));

  const productIds = (productRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
  if (productIds.length === 0) {
    return withCors(req, NextResponse.json({ data: [] }));
  }

  let specsRes = await supabase
    .from("product_specs")
    .select("product_id,btu,cooling_power_kw")
    .in("product_id", productIds);
  if (specsRes.error && isPostgrestMissingColumn(specsRes.error, "btu")) {
    specsRes = await supabase
      .from("product_specs")
      .select("product_id,cooling_power_kw")
      .in("product_id", productIds);
  }
  if (specsRes.error) {
    return withCors(req, NextResponse.json({ error: specsRes.error.message }, { status: 500 }));
  }

  const counts = new Map<number, number>();
  for (const row of specsRes.data ?? []) {
    const r = row as { product_id?: string; btu?: number | null; cooling_power_kw?: number | null };
    if (!r.product_id) continue;
    let nominal = r.btu != null ? Math.round(Number(r.btu)) : inferBtuFromCoolingKw(r.cooling_power_kw);
    if (nominal == null || !(CATALOG_BTU_OPTIONS as readonly number[]).includes(nominal)) continue;
    counts.set(nominal, (counts.get(nominal) ?? 0) + 1);
  }

  let result = CATALOG_BTU_OPTIONS.map((btu) => ({
    btu,
    productCount: counts.get(btu) ?? 0,
  }));
  if (onlyWithProducts) {
    result = result.filter((row) => row.productCount > 0);
  }

  return withCors(req, NextResponse.json({ data: result }));
}
