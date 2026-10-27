import type { SupabaseClient } from "@supabase/supabase-js";

export const TEMPEX_UNAVAILABLE_NOTE = "Tempex: автоматично скрит — липсва в каталога на доставчика или няма публикувана цена.";

export function isTempexImportedTemplate(row: { slug?: string | null; source_url?: string | null }): boolean {
  if (!/-tempex-\d+$/.test(row.slug ?? "")) return false;
  try {
    const source = new URL(row.source_url ?? "");
    return source.protocol === "https:" && ["tempex.bg", "www.tempex.bg"].includes(source.hostname)
      && /^\/bg\/[^/]+\.html$/.test(source.pathname);
  } catch { return false; }
}

/** Keep staff notes and the public-visibility choice; only restore a deactivation made by this importer. */
export function restoredTempexAvailability(existing: { is_active?: boolean; internal_note?: string | null }): Record<string, unknown> {
  const lines = (existing.internal_note ?? "").split("\n");
  if (!lines.includes(TEMPEX_UNAVAILABLE_NOTE)) return {};
  return { is_active: true, internal_note: lines.filter((line) => line !== TEMPEX_UNAVAILABLE_NOTE).join("\n").trim() || null };
}

/** Run only after a complete, error-free crawl/import. Stock instances and other suppliers are never touched. */
export async function reconcileTempexAvailability(db: SupabaseClient, supplierId: string, availableUrls: Set<string>): Promise<number> {
  const result = await db.from("products").select("id,slug,source_url,is_active,internal_note")
    .eq("supplier_id", supplierId).eq("product_condition", "new").eq("stock_quantity", 0).eq("sold_quantity", 0)
    .is("supplier_order_work_item_id", null).is("purchased_at", null).is("indoor_unit_serial", null).is("outdoor_unit_serial", null)
    .range(0, 4999);
  if (result.error) throw new Error(result.error.message);
  let deactivated = 0;
  for (const row of result.data ?? []) {
    if (!isTempexImportedTemplate(row) || !row.is_active || availableUrls.has(row.source_url)) continue;
    const note = String(row.internal_note ?? "");
    const updated = await db.from("products").update({ is_active: false, internal_note: [note, TEMPEX_UNAVAILABLE_NOTE].filter(Boolean).join("\n") })
      .eq("id", row.id).eq("supplier_id", supplierId).eq("stock_quantity", 0).eq("sold_quantity", 0)
      .eq("slug", row.slug).eq("source_url", row.source_url).eq("is_active", true)
      .is("supplier_order_work_item_id", null).is("purchased_at", null).is("indoor_unit_serial", null).is("outdoor_unit_serial", null)
      .select("id");
    if (updated.error) throw new Error(updated.error.message);
    deactivated += updated.data?.length ?? 0;
  }
  return deactivated;
}
