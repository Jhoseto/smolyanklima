import type { SupabaseClient } from "@supabase/supabase-js";
import { applyPublicCatalogFilter } from "@/lib/catalog/publicProductVisibility";

export const CATEGORY_TYPE_FALLBACK: Record<string, string[]> = {
  wall: ["Стенен климатик", "Дизайнерски климатик"],
  multi: ["Мулти-сплит система"],
  cassette: ["Касетъчен климатик"],
  floor: ["Подов климатик"],
  ceiling: ["Таванен климатик"],
};

export const CATALOG_CATEGORY_SLUGS = ["all", "wall", "multi", "cassette", "floor", "ceiling"] as const;

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

/** Един лек fetch + dedup по (brand_id, model_code) — споделен за meta броячи. */
export async function fetchPublicCatalogRepresentatives(
  supabase: SupabaseClient,
  opts?: { cond?: "new" | "used" },
): Promise<DedupRepresentative[]> {
  const selectCols = "id,brand_id,model_code,type_id,product_condition";
  let q = applyPublicCatalogFilter(supabase.from("products").select(selectCols));
  if (opts?.cond) q = q.eq("product_condition", opts.cond);

  let res = await q.limit(2500);
  if (
    res.error &&
    opts?.cond &&
    (String(res.error.code ?? "") === "42703" ||
      String(res.error.message ?? "").includes("product_condition"))
  ) {
    res = await applyPublicCatalogFilter(supabase.from("products").select("id,brand_id,model_code,type_id")).limit(
      2500,
    );
  }
  if (res.error && /model_code/.test(String(res.error.message ?? ""))) {
    res = await applyPublicCatalogFilter(supabase.from("products").select("id,brand_id,type_id")).limit(2500);
  }
  if (res.error) throw new Error(res.error.message);

  const seen = new Set<string>();
  const out: DedupRepresentative[] = [];
  for (const row of (res.data ?? []) as DedupRow[]) {
    const brand = String(row.brand_id ?? "");
    const model = String(row.model_code ?? "").trim().toLowerCase();
    const key = brand && model ? `${brand}:${model}` : `__instance:${row.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: row.id, brandId: row.brand_id ?? null, typeId: row.type_id ?? null });
  }
  return out;
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
