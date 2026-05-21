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

const PRODUCT_PAGE_SIZE = 800;
const SPEC_IN_CHUNK = 100;
const KW_SPEC_PAGE = 1000;

function isMissingRpc(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = String(err.message ?? "");
  return (
    err.code === "PGRST202" ||
    /catalog_btu_option_counts/i.test(msg) ||
    /Could not find the function/i.test(msg)
  );
}

function isMissingProductConditionColumn(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    String(err.code ?? "") === "42703" || String(err.message ?? "").includes("product_condition")
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function normalizeNominal(
  btu: number | null | undefined,
  coolingKw: number | null | undefined,
): number | null {
  const nominal = btu != null ? Math.round(Number(btu)) : inferBtuFromCoolingKw(coolingKw);
  if (nominal == null || !(CATALOG_BTU_OPTIONS as readonly number[]).includes(nominal)) return null;
  return nominal;
}

/** SQL агрегация по product_specs.btu (миграция 0064). */
async function fetchCountsViaRpc(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  cond?: "new" | "used",
): Promise<Map<number, number> | null> {
  const { data, error } = await supabase.rpc("catalog_btu_option_counts", {
    p_cond: cond ?? null,
  });
  if (error) {
    if (isMissingRpc(error)) return null;
    throw error;
  }
  const counts = new Map<number, number>();
  for (const row of (data ?? []) as Array<{ nominal_btu?: number; product_count?: number }>) {
    const btu = normalizeNominal(row.nominal_btu, null);
    const n = row.product_count != null ? Number(row.product_count) : 0;
    if (btu == null || n <= 0) continue;
    counts.set(btu, (counts.get(btu) ?? 0) + n);
  }
  return counts;
}

async function loadPublicProductIdSet(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  cond?: "new" | "used",
): Promise<Set<string>> {
  const ids = new Set<string>();
  let filterByCondition = Boolean(cond);
  let offset = 0;

  while (true) {
    let q = applyPublicCatalogFilter(supabase.from("products").select("id"));
    if (filterByCondition && cond) q = q.eq("product_condition", cond);
    const { data, error } = await q.range(offset, offset + PRODUCT_PAGE_SIZE - 1);
    if (error) {
      if (filterByCondition && cond && isMissingProductConditionColumn(error)) {
        filterByCondition = false;
        offset = 0;
        ids.clear();
        continue;
      }
      throw error;
    }
    const batch = (data ?? []) as Array<{ id?: string }>;
    for (const r of batch) {
      if (r.id) ids.add(r.id);
    }
    if (batch.length < PRODUCT_PAGE_SIZE) break;
    offset += PRODUCT_PAGE_SIZE;
  }
  return ids;
}

/** Продукти без btu, но с kW — допълва броячите след RPC. */
async function supplementKwInferredCounts(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  counts: Map<number, number>,
  cond?: "new" | "used",
) {
  const publicIds = await loadPublicProductIdSet(supabase, cond);
  if (publicIds.size === 0) return;

  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("product_specs")
      .select("product_id,cooling_power_kw")
      .is("btu", null)
      .not("cooling_power_kw", "is", null)
      .range(offset, offset + KW_SPEC_PAGE - 1);
    if (error) {
      if (isPostgrestMissingColumn(error, "btu")) return;
      throw error;
    }
    const batch = (data ?? []) as Array<{ product_id?: string; cooling_power_kw?: number | null }>;
    for (const row of batch) {
      if (!row.product_id || !publicIds.has(row.product_id)) continue;
      const nominal = normalizeNominal(null, row.cooling_power_kw);
      if (nominal == null) continue;
      counts.set(nominal, (counts.get(nominal) ?? 0) + 1);
    }
    if (batch.length < KW_SPEC_PAGE) break;
    offset += KW_SPEC_PAGE;
  }
}

/** Fallback без RPC: id на парчета + specs на парчета. */
async function fetchCountsChunked(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  cond?: "new" | "used",
): Promise<Map<number, number>> {
  const productIds = [...(await loadPublicProductIdSet(supabase, cond))];
  const counts = new Map<number, number>();
  const seen = new Map<number, Set<string>>();
  if (productIds.length === 0) return counts;

  let specCols = "product_id,btu,cooling_power_kw";
  let includeBtu = true;

  for (const chunk of chunkArray(productIds, SPEC_IN_CHUNK)) {
    const run = () => supabase.from("product_specs").select(specCols).in("product_id", chunk);
    let { data, error } = await run();
    if (error && includeBtu && isPostgrestMissingColumn(error, "btu")) {
      includeBtu = false;
      specCols = "product_id,cooling_power_kw";
      ({ data, error } = await run());
    }
    if (error) throw error;

    for (const row of (data ?? []) as Array<{
      product_id?: string;
      btu?: number | null;
      cooling_power_kw?: number | null;
    }>) {
      if (!row.product_id) continue;
      const nominal = normalizeNominal(row.btu, row.cooling_power_kw);
      if (nominal == null) continue;
      const bucket = seen.get(nominal) ?? new Set<string>();
      if (bucket.has(row.product_id)) continue;
      bucket.add(row.product_id);
      seen.set(nominal, bucket);
      counts.set(nominal, bucket.size);
    }
  }
  return counts;
}

function countsToResult(
  counts: Map<number, number>,
  onlyWithProducts: boolean,
): Array<{ btu: number; productCount: number }> {
  let result = CATALOG_BTU_OPTIONS.map((btu) => ({
    btu,
    productCount: counts.get(btu) ?? 0,
  }));
  if (onlyWithProducts) {
    result = result.filter((row) => row.productCount > 0);
  }
  return result;
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
  const { cond, onlyWithProducts } = parsed.data;
  const supabase = createSupabaseServiceRoleClient();

  try {
    let counts = await fetchCountsViaRpc(supabase, cond);

    if (counts) {
      await supplementKwInferredCounts(supabase, counts, cond);
    } else {
      counts = await fetchCountsChunked(supabase, cond);
    }

    const result = countsToResult(counts, onlyWithProducts);
    const res = withCors(req, NextResponse.json({ data: result }));
    res.headers.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[catalog/btu-options]", message);
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
