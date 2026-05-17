import type { SupabaseClient } from "@supabase/supabase-js";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";

/** Стандартни номинали (хиляди BTU), както на bulclima.com. */
export const CATALOG_BTU_OPTIONS = [7, 9, 12, 14, 18, 22, 24, 30, 36, 45, 48, 54, 60, 72, 90] as const;

export type CatalogBtu = (typeof CATALOG_BTU_OPTIONS)[number];

/** Приблизителен охлаждащ капацитет (kW) → най-близък номинал BTU (×1000). */
export function inferBtuFromCoolingKw(coolingKw: number | null | undefined): number | null {
  if (coolingKw == null || !Number.isFinite(coolingKw) || coolingKw <= 0) return null;
  const nominal = Math.round((coolingKw / 2.64) * 9);
  let best: number | null = null;
  let bestDiff = Infinity;
  for (const opt of CATALOG_BTU_OPTIONS) {
    const diff = Math.abs(opt - nominal);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = opt;
    }
  }
  return bestDiff <= 3 ? best : null;
}

/** Диапазон kW за филтър, когато `product_specs.btu` липсва (стари записи). */
export function coolingKwRangeForBtu(btu: number): { min: number; max: number } | null {
  const kw = (btu * 1000) / 3412.14;
  const margin = Math.max(0.35, kw * 0.12);
  return { min: Math.max(0, kw - margin), max: kw + margin };
}

export function parseBtuQueryParam(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return (CATALOG_BTU_OPTIONS as readonly number[]).includes(n) ? n : null;
}

export function parseBtuCsvParam(raw: string | undefined): number[] {
  if (!raw?.trim()) return [];
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const n = parseBtuQueryParam(part.trim());
    if (n != null) out.add(n);
  }
  return [...out];
}

/** Продукти с даден номинал BTU (колона `btu` или fallback по kW). */
export async function resolveProductIdsForBtu(supabase: SupabaseClient, btu: number): Promise<string[]> {
  const ids = new Set<string>();

  const { data: byBtu, error: btuErr } = await supabase
    .from("product_specs")
    .select("product_id")
    .eq("btu", btu);
  if (!btuErr) {
    for (const row of byBtu ?? []) {
      const id = (row as { product_id?: string }).product_id;
      if (id) ids.add(id);
    }
  } else if (!isPostgrestMissingColumn(btuErr, "btu")) {
    throw new Error(btuErr.message);
  }

  const range = coolingKwRangeForBtu(btu);
  if (range) {
    const { data: byKw } = await supabase
      .from("product_specs")
      .select("product_id")
      .gte("cooling_power_kw", range.min)
      .lte("cooling_power_kw", range.max);
    for (const row of byKw ?? []) {
      const id = (row as { product_id?: string }).product_id;
      if (id) ids.add(id);
    }
  }

  return [...ids];
}

export async function resolveProductIdsForBtuList(
  supabase: SupabaseClient,
  btus: number[],
): Promise<string[]> {
  const ids = new Set<string>();
  for (const btu of btus) {
    for (const id of await resolveProductIdsForBtu(supabase, btu)) {
      ids.add(id);
    }
  }
  return [...ids];
}
