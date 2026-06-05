import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  countRepresentativesByCategory,
  fetchPublicCatalogRepresentatives,
  resolveCategoryTypeIds,
} from "@/lib/catalog/publicCatalogDedup";
import {
  fetchCatalogRepresentativesForFacets,
  parseCatalogFacetFiltersFromSearchParams,
  resolveCatalogFacetIdRestriction,
  type CatalogFacetFilters,
} from "@/lib/catalog/catalogListFilters";

const QuerySchema = z.object({
  cond: z.enum(["new", "used"]).optional(),
  q: z.string().optional(),
  b: z.string().optional(),
  btu: z.string().optional(),
  e: z.string().optional(),
  f: z.string().optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
});

function hasFacetFilters(filters: CatalogFacetFilters): boolean {
  return Boolean(
    filters.q?.trim() ||
      (filters.brandNames?.length ?? 0) > 0 ||
      (filters.btuFilters?.length ?? 0) > 0 ||
      (filters.energyClasses?.length ?? 0) > 0 ||
      (filters.featureTerms?.length ?? 0) > 0 ||
      (typeof filters.min === "number" && Number.isFinite(filters.min)) ||
      (typeof filters.max === "number" && Number.isFinite(filters.max)),
  );
}

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/** Брой уникални модели по категория; при филтри — същите критерии като GET /api/products (без `cat`). */
export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid query" }, { status: 400 }));
  }

  const supabase = createSupabaseServiceRoleClient();
  const facetFilters: CatalogFacetFilters = {
    ...parseCatalogFacetFiltersFromSearchParams(params),
    cond: parsed.data.cond,
    min: parsed.data.min,
    max: parsed.data.max,
  };

  try {
    const typeIdsByCategory = await resolveCategoryTypeIds(supabase);
    let reps;

    if (hasFacetFilters(facetFilters)) {
      const { idRestriction, filterBrandIds } = await resolveCatalogFacetIdRestriction(supabase, facetFilters);
      reps = await fetchCatalogRepresentativesForFacets(supabase, idRestriction, filterBrandIds, {
        cond: facetFilters.cond,
        min: facetFilters.min,
        max: facetFilters.max,
      });
    } else {
      reps = await fetchPublicCatalogRepresentatives(supabase, { cond: facetFilters.cond });
    }

    const counts = countRepresentativesByCategory(reps, typeIdsByCategory);
    const res = withCors(req, NextResponse.json({ data: counts }));
    res.headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    return res;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}
