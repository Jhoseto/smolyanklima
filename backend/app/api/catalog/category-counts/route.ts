import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  countRepresentativesByCategory,
  fetchPublicCatalogRepresentatives,
  resolveCategoryTypeIds,
} from "@/lib/catalog/publicCatalogDedup";

const QuerySchema = z.object({
  cond: z.enum(["new", "used"]).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/** Един request вместо 6× GET /api/products?page=1&perPage=1 за всяка категория. */
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid query" }, { status: 400 }));
  }

  const supabase = createSupabaseServiceRoleClient();
  try {
    const [reps, typeIdsByCategory] = await Promise.all([
      fetchPublicCatalogRepresentatives(supabase, { cond: parsed.data.cond }),
      resolveCategoryTypeIds(supabase),
    ]);
    const counts = countRepresentativesByCategory(reps, typeIdsByCategory);
    const res = withCors(req, NextResponse.json({ data: counts }));
    res.headers.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
