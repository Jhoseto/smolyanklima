import type { SupabaseClient } from "@supabase/supabase-js";
import { applyPublicCatalogFilter } from "@/lib/catalog/publicProductVisibility";

export const CATEGORY_TYPE_FALLBACK: Record<string, string[]> = {
  wall: ["Стенен климатик", "Дизайнерски климатик"],
  multi: ["Мулти-сплит система"],
  cassette: ["Касетъчен климатик"],
  floor: ["Подов климатик"],
  column: ["Колонен климатик"],
  ceiling: ["Таванен климатик"],
};

export const CATALOG_CATEGORY_SLUGS = ["all", "wall", "multi", "cassette", "floor", "column", "ceiling"] as const;

type DedupRow = {
  id: string;
  brand_id: string | null;
  model_code: string | null;
  type_id: string | null;
};

export type DedupRepresentative = {
  id: string;
  brandId: string | null;
  typeId: string | null;
};

export type CatalogBrandOption = { name: string; productCount: number };

const CATALOG_PAGE_SIZE = 1000;

function isMissingBrandCountsRpc(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  const msg = String(err.message ?? "");
  return (
    err.code === "PGRST202" ||
    /catalog_brand_option_counts/i.test(msg) ||
    /Could not find the function/i.test(msg)
  );
}

async function fetchBrandCountsViaRpc(
  supabase: SupabaseClient,
  cond?: "new" | "used",
): Promise<Map<string, number> | null> {
  const { data, error } = await supabase.rpc("catalog_brand_option_counts", {
    p_cond: cond ?? null,
  });
  if (error) {
    if (isMissingBrandCountsRpc(error)) return null;
    if (
      cond &&
      (String(error.code ?? "") === "42703" || String(error.message ?? "").includes("product_condition"))
    ) {
      const retry = await supabase.rpc("catalog_brand_option_counts", { p_cond: null });
      if (retry.error) {
        if (isMissingBrandCountsRpc(retry.error)) return null;
        throw new Error(retry.error.message);
      }
      return countsFromRpcRows(retry.data);
    }
    throw new Error(error.message);
  }
  return countsFromRpcRows(data);
}

function countsFromRpcRows(data: unknown): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as Array<{ brand_id?: string; product_count?: number }>) {
    if (!row.brand_id) continue;
    const n = row.product_count != null ? Number(row.product_count) : 0;
    if (n > 0) counts.set(row.brand_id, n);
  }
  return counts;
}

function dedupKey(row: Pick<DedupRow, "id" | "brand_id" | "model_code">): string {
  const brand = String(row.brand_id ?? "");
  const model = String(row.model_code ?? "").trim().toLowerCase();
  return brand && model ? `${brand}:${model}` : `__instance:${row.id}`;
}

/** Всички публични продукти (пагинирано) — същият ред като GET /api/products dedup. */
async function fetchAllPublicCatalogRows(
  supabase: SupabaseClient,
  selectCols: string,
  opts?: { cond?: "new" | "used" },
): Promise<DedupRow[]> {
  const includeCondition = Boolean(opts?.cond);
  const merged: DedupRow[] = [];
  let from = 0;

  const buildPageQuery = (withCondition: boolean) => {
    let q = applyPublicCatalogFilter(supabase.from("products").select(selectCols));
    if (withCondition && opts?.cond) q = q.eq("product_condition", opts.cond);
    return q
      .order("stock_status", { ascending: true })
      .order("sold_quantity", { ascending: true, nullsFirst: true })
      .order("created_at", { ascending: true })
      .range(from, from + CATALOG_PAGE_SIZE - 1);
  };

  let useCondition = includeCondition;
  let missingConditionColumn = false;

  for (;;) {
    let res = await buildPageQuery(useCondition);
    if (
      res.error &&
      useCondition &&
      (String(res.error.code ?? "") === "42703" ||
        String(res.error.message ?? "").includes("product_condition"))
    ) {
      missingConditionColumn = true;
      useCondition = false;
      res = await buildPageQuery(false);
    }
    if (res.error && /model_code/.test(String(res.error.message ?? ""))) {
      const fallbackCols = selectCols
        .split(",")
        .map((c) => c.trim())
        .filter((c) => c !== "model_code" && c !== "product_condition")
        .join(",");
      let fq = applyPublicCatalogFilter(supabase.from("products").select(fallbackCols))
        .order("stock_status", { ascending: true })
        .order("created_at", { ascending: true })
        .range(from, from + CATALOG_PAGE_SIZE - 1);
      res = await fq;
    }
    if (res.error) throw new Error(res.error.message);

    const batch = (res.data ?? []) as unknown as DedupRow[];
    merged.push(...batch);
    if (batch.length < CATALOG_PAGE_SIZE) break;
    from += CATALOG_PAGE_SIZE;
  }

  if (missingConditionColumn && opts?.cond) {
    return merged;
  }
  return merged;
}

function dedupeRowsToRepresentatives(rows: DedupRow[]): DedupRepresentative[] {
  const seen = new Set<string>();
  const out: DedupRepresentative[] = [];
  for (const row of rows) {
    const key = dedupKey(row);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: row.id, brandId: row.brand_id ?? null, typeId: row.type_id ?? null });
  }
  return out;
}

/** Един лек fetch + dedup по (brand_id, model_code) — споделен за meta броячи. */
export async function fetchPublicCatalogRepresentatives(
  supabase: SupabaseClient,
  opts?: { cond?: "new" | "used" },
): Promise<DedupRepresentative[]> {
  const rows = await fetchAllPublicCatalogRows(
    supabase,
    "id,brand_id,model_code,type_id,product_condition",
    opts,
  );
  return dedupeRowsToRepresentatives(rows);
}

/**
 * Марки в публичния каталог с брой уникални модели (dedup като картичките).
 * Включва всяка марка с поне един публичен продукт — не само is_active от brands.
 */
export async function fetchPublicCatalogBrandOptions(
  supabase: SupabaseClient,
  opts?: { cond?: "new" | "used"; onlyWithProducts?: boolean },
): Promise<CatalogBrandOption[]> {
  const onlyWithProducts = opts?.onlyWithProducts !== false;
  let counts = await fetchBrandCountsViaRpc(supabase, opts?.cond);
  if (!counts) {
    const reps = await fetchPublicCatalogRepresentatives(supabase, { cond: opts?.cond });
    counts = new Map<string, number>();
    for (const r of reps) {
      if (!r.brandId) continue;
      counts.set(r.brandId, (counts.get(r.brandId) ?? 0) + 1);
    }
  }

  const brandIds = [...counts.keys()];
  if (brandIds.length === 0) return [];

  const { data: brandRows, error } = await supabase.from("brands").select("id,name").in("id", brandIds);
  if (error) throw new Error(error.message);

  const nameById = new Map((brandRows ?? []).map((b: { id: string; name: string }) => [b.id, b.name]));
  let result = brandIds
    .map((id) => ({
      name: nameById.get(id) ?? "",
      productCount: counts.get(id) ?? 0,
    }))
    .filter((b) => b.name.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));

  if (onlyWithProducts) {
    result = result.filter((b) => b.productCount > 0);
  }

  return result;
}

/** category slug → set of product_type ids (от category_types + fallback имена). */
export async function resolveCategoryTypeIds(
  supabase: SupabaseClient,
): Promise<Map<string, Set<string>>> {
  const slugs = CATALOG_CATEGORY_SLUGS.filter((s) => s !== "all");
  const map = new Map<string, Set<string>>(slugs.map((s) => [s, new Set()]));

  const [{ data: cats }, { data: allTypes }] = await Promise.all([
    supabase.from("categories").select("id,slug").in("slug", slugs),
    supabase.from("product_types").select("id,name"),
  ]);

  const typeIdByName = new Map((allTypes ?? []).map((t: { id: string; name: string }) => [t.name, t.id]));

  const catIdBySlug = new Map((cats ?? []).map((c: { id: string; slug: string }) => [c.slug, c.id]));
  const catIds = [...catIdBySlug.values()];
  const { data: ctRows } =
    catIds.length > 0
      ? await supabase.from("category_types").select("category_id,product_type").in("category_id", catIds)
      : { data: [] };

  const namesByCatId = new Map<string, Set<string>>();
  for (const row of ctRows ?? []) {
    const cid = (row as { category_id: string }).category_id;
    const name = (row as { product_type: string }).product_type;
    if (!cid || !name) continue;
    const set = namesByCatId.get(cid) ?? new Set();
    set.add(name);
    namesByCatId.set(cid, set);
  }

  for (const slug of slugs) {
    const catId = catIdBySlug.get(slug);
    const names = new Set<string>([...(CATEGORY_TYPE_FALLBACK[slug] ?? [])]);
    if (catId) {
      for (const n of namesByCatId.get(catId) ?? []) names.add(n);
    }
    const ids = map.get(slug) ?? new Set();
    for (const n of names) {
      const tid = typeIdByName.get(n);
      if (tid) ids.add(tid);
    }
    map.set(slug, ids);
  }

  return map;
}

export function countRepresentativesByCategory(
  reps: DedupRepresentative[],
  typeIdsByCategory: Map<string, Set<string>>,
): Record<string, number> {
  const counts: Record<string, number> = { all: reps.length };
  for (const [slug, typeIds] of typeIdsByCategory) {
    if (typeIds.size === 0) {
      counts[slug] = 0;
      continue;
    }
    counts[slug] = reps.filter((r) => r.typeId && typeIds.has(r.typeId)).length;
  }
  return counts;
}
