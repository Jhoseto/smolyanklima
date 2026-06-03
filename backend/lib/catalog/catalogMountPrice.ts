import type { SupabaseClient } from "@supabase/supabase-js";

/** Стандартен монтаж от `product_catalog_settings` (админ → Продукти → Настройки). */
export type CatalogMountDefaults = { newEur: number; usedEur: number };

export async function loadCatalogMountDefaults(
  supabase: SupabaseClient,
): Promise<CatalogMountDefaults | null> {
  const { data, error } = await supabase
    .from("product_catalog_settings")
    .select("default_mount_new_eur,default_mount_used_eur")
    .eq("id", 1)
    .maybeSingle();

  if (error) return null;

  const row = data as {
    default_mount_new_eur?: number | null;
    default_mount_used_eur?: number | null;
  } | null;

  const newEur = row?.default_mount_new_eur;
  const usedEur = row?.default_mount_used_eur;
  if (newEur == null || usedEur == null) return null;
  const n = Number(newEur);
  const u = Number(usedEur);
  if (!Number.isFinite(n) || !Number.isFinite(u) || n < 0 || u < 0) return null;
  return { newEur: n, usedEur: u };
}

/**
 * Публична „цена с монтаж“ — същата логика като в админ QuickView:
 * при зададени настройки: продажна цена + стандартен монтаж (нов / втора употреба).
 * Иначе — записаната в БД стойност.
 */
export function resolvePublicPriceWithMount(params: {
  price: unknown;
  productCondition?: unknown;
  storedPriceWithMount?: unknown;
  mountDefaults: CatalogMountDefaults | null;
}): number | null {
  const price = params.price != null ? Number(params.price) : NaN;
  if (!Number.isFinite(price)) return null;

  const stored =
    params.storedPriceWithMount != null && Number.isFinite(Number(params.storedPriceWithMount))
      ? Number(params.storedPriceWithMount)
      : null;

  const addon =
    params.mountDefaults != null
      ? params.productCondition === "used"
        ? params.mountDefaults.usedEur
        : params.mountDefaults.newEur
      : null;

  if (addon != null) {
    return Math.round((price + addon) * 100) / 100;
  }

  return stored;
}
