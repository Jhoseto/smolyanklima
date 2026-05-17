import type { SupabaseClient } from "@supabase/supabase-js";

/** Премахва FK връзки към продукт(и) преди изтриване (запитвания без ON DELETE SET NULL). */
export async function detachProductsBeforeDelete(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<{ error: { message: string } | null }> {
  if (productIds.length === 0) return { error: null };

  const { error } = await supabase.from("inquiries").update({ product_id: null }).in("product_id", productIds);
  return { error };
}
