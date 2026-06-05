import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeIlikeTerm } from "@/lib/security/sanitizeSearchTerm";
import { parseBtuCsvParam, resolveProductIdsForBtuList } from "@/lib/catalog/productBtu";
import { applyPublicCatalogFilter } from "@/lib/catalog/publicProductVisibility";
import type { DedupRepresentative } from "@/lib/catalog/publicCatalogDedup";

const MAX_PRODUCT_ID_IN = 100;

export type CatalogFacetFilters = {
  q?: string;
  cond?: "new" | "used";
  brandNames?: string[];
  btuFilters?: number[];
  energyClasses?: string[];
  featureTerms?: string[];
  min?: number;
  max?: number;
};

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

function chunkIds(ids: string[], size = MAX_PRODUCT_ID_IN): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

async function filterPublicProductIds(supabase: SupabaseClient, ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const found: string[] = [];
  for (const chunk of chunkIds(ids)) {
    const { data, error } = await applyPublicCatalogFilter(supabase.from("products").select("id")).in(
      "id",
      chunk,
    );
    if (error) throw error;
    for (const row of data ?? []) {
      const id = (row as { id?: string }).id;
      if (id) found.push(id);
    }
  }
  return found;
}

export function parseCatalogFacetFiltersFromSearchParams(params: Record<string, string>): CatalogFacetFilters {
  return {
    q: params.q,
    cond: params.cond === "new" || params.cond === "used" ? params.cond : undefined,
    brandNames: splitCsv(params.b),
    btuFilters: parseBtuCsvParam(params.btu),
    energyClasses: splitCsv(params.e),
    featureTerms: splitCsv(params.f),
    min: params.min != null && params.min !== "" ? Number(params.min) : undefined,
    max: params.max != null && params.max !== "" ? Number(params.max) : undefined,
  };
}

/** Същата id-рестрикция като GET /api/products, без филтър по категория (slug). */
export async function resolveCatalogFacetIdRestriction(
  supabase: SupabaseClient,
  filters: CatalogFacetFilters,
): Promise<{ idRestriction: string[] | null | "empty"; filterBrandIds: string[] | null }> {
  let idRestriction: string[] | null | "empty" = null;
  let filterBrandIds: string[] | null = null;

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

  const { q, cond, brandNames = [], btuFilters = [], energyClasses = [], featureTerms = [] } = filters;

  if (q?.trim()) {
    const term = sanitizeIlikeTerm(q);
    if (term) {
      const { data: searchRows, error: rpcErr } = await supabase.rpc("search_product_ids", {
        search_query: term,
        result_limit: 5000,
      });
      let ids: string[] = [];
      if (rpcErr) {
        const { data: fb, error: fbErr } = await applyPublicCatalogFilter(
          supabase.from("products").select("id"),
        ).or(`name.ilike.%${term}%,description.ilike.%${term}%`);
        if (fbErr) throw new Error(fbErr.message);
        ids = (fb ?? []).map((r: { id: string }) => r.id);
      } else {
        ids = (searchRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
      }
      mergeProductIds(await filterPublicProductIds(supabase, ids));
    }
  }

  if (brandNames.length > 0) {
    const { data: brows } = await supabase.from("brands").select("id").in("name", brandNames);
    filterBrandIds = (brows ?? []).map((r: { id: string }) => r.id);
    if (filterBrandIds.length === 0) mergeProductIds([]);
  }

  if (btuFilters.length > 0) {
    const specIds = await resolveProductIdsForBtuList(supabase, btuFilters);
    if (specIds.length === 0) {
      mergeProductIds([]);
    } else {
      mergeProductIds(await filterPublicProductIds(supabase, specIds));
    }
  }

  if (energyClasses.length > 0) {
    const specProductIds = new Set<string>();
    let offset = 0;
    const pageSize = 1000;
    while (true) {
      const { data: srows, error: sErr } = await supabase
        .from("product_specs")
        .select("product_id")
        .in("energy_class_cool", energyClasses)
        .range(offset, offset + pageSize - 1);
      if (sErr) throw new Error(sErr.message);
      const batch = (srows ?? []) as Array<{ product_id?: string }>;
      for (const row of batch) {
        if (row.product_id) specProductIds.add(row.product_id);
      }
      if (batch.length < pageSize) break;
      offset += pageSize;
    }
    mergeProductIds(await filterPublicProductIds(supabase, [...specProductIds]));
  }

  for (const term of featureTerms) {
    const { data: feats } = await supabase.from("features").select("id").ilike("name", `%${term}%`);
    const featIds = (feats ?? []).map((r: { id: string }) => r.id);
    if (featIds.length === 0) {
      mergeProductIds([]);
      break;
    }
    const { data: links } = await supabase.from("product_features").select("product_id").in("feature_id", featIds);
    const ids = [...new Set((links ?? []).map((r: { product_id: string }) => r.product_id))];
    mergeProductIds(await filterPublicProductIds(supabase, ids));
  }

  return { idRestriction, filterBrandIds };
}

const DEDUP_SELECT =
  "id,brand_id,model_code,type_id,stock_status,price,sold_quantity,created_at,product_condition";

/** Dedup представители с type_id — за броене по категория при активни филтри. */
export async function fetchCatalogRepresentativesForFacets(
  supabase: SupabaseClient,
  idRestriction: string[] | null | "empty",
  filterBrandIds: string[] | null,
  filters: Pick<CatalogFacetFilters, "cond" | "min" | "max">,
): Promise<DedupRepresentative[]> {
  if (idRestriction === "empty") return [];

  const { cond, min, max } = filters;

  const buildDedupQuery = (includeCondition: boolean, restrictIds: string[] | null | "empty" = idRestriction) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = applyPublicCatalogFilter((supabase.from("products") as any).select(
      includeCondition ? DEDUP_SELECT : DEDUP_SELECT.replace(",product_condition", ""),
    ));
    if (filterBrandIds && filterBrandIds.length > 0) q = q.in("brand_id", filterBrandIds);
    if (restrictIds !== null && restrictIds !== "empty" && restrictIds.length <= MAX_PRODUCT_ID_IN) {
      q = q.in("id", restrictIds);
    }
    if (typeof min === "number" && Number.isFinite(min)) q = q.gte("price", min);
    if (typeof max === "number" && Number.isFinite(max)) q = q.lte("price", max);
    if (includeCondition && cond) q = q.eq("product_condition", cond);
    q = q.order("stock_status", { ascending: true });
    q = q.order("sold_quantity", { ascending: true, nullsFirst: true });
    q = q.order("created_at", { ascending: true });
    return q.limit(2000);
  };

  async function fetchDedupRows(includeCondition: boolean): Promise<Array<Record<string, unknown>>> {
    const largeIdList =
      idRestriction !== null && idRestriction !== "empty" && idRestriction.length > MAX_PRODUCT_ID_IN
        ? idRestriction
        : null;

    if (!largeIdList) {
      let res = await buildDedupQuery(includeCondition);
      if (
        res.error &&
        includeCondition &&
        (String(res.error.code ?? "") === "42703" ||
          /product_condition|model_code|sold_quantity/.test(String(res.error.message ?? "")))
      ) {
        res = await buildDedupQuery(false);
      }
      if (res.error && /model_code/.test(String(res.error.message ?? ""))) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        res = await applyPublicCatalogFilter((supabase.from("products") as any).select("id,brand_id,type_id")).limit(
          2000,
        );
      }
      if (res.error) throw new Error(res.error.message);
      return (res.data ?? []) as Array<Record<string, unknown>>;
    }

    const merged: Array<Record<string, unknown>> = [];
    for (const chunk of chunkIds(largeIdList)) {
      let res = await buildDedupQuery(includeCondition, chunk);
      if (
        res.error &&
        includeCondition &&
        (String(res.error.code ?? "") === "42703" ||
          /product_condition|model_code|sold_quantity/.test(String(res.error.message ?? "")))
      ) {
        res = await buildDedupQuery(false, chunk);
      }
      if (res.error) throw new Error(res.error.message);
      merged.push(...((res.data ?? []) as Array<Record<string, unknown>>));
    }
    return merged;
  }

  const rows = await fetchDedupRows(true);
  const seen = new Set<string>();
  const out: DedupRepresentative[] = [];
  for (const row of rows) {
    const brand = String(row.brand_id ?? "");
    const model = String(row.model_code ?? "").trim().toLowerCase();
    const key = brand && model ? `${brand}:${model}` : `__instance:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: String(row.id),
      brandId: (row.brand_id as string | null) ?? null,
      typeId: (row.type_id as string | null) ?? null,
    });
  }
  return out;
}
