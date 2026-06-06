import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchPublicCatalogBrandOptions } from "@/lib/catalog/publicCatalogDedup";

/**
 * Връща марки с брой уникални модели в публичния каталог (dedup като картичките).
 *
 * GET /api/catalog/brand-options?cond=new|used&onlyWithProducts=true|false
 */

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

  try {
    const result = await fetchPublicCatalogBrandOptions(supabase, { cond, onlyWithProducts });
    const res = withCors(req, NextResponse.json({ data: result }));
    res.headers.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
