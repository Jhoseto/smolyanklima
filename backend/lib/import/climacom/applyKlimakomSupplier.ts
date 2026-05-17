import type { SupabaseClient } from "@supabase/supabase-js";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";

export async function applyKlimakomSupplierToProduct(
  supabase: SupabaseClient,
  productId: string,
  supplierId: string,
): Promise<boolean> {
  const { error } = await supabase.from("products").update({ supplier_id: supplierId }).eq("id", productId);
  if (!error) return true;
  if (isPostgrestMissingColumn(error, "supplier_id")) return false;
  throw new Error(error.message);
}

export async function backfillKlimakomSupplierOnProducts(
  supabase: SupabaseClient,
  supplierId: string,
  productIds: string[],
): Promise<number> {
  if (!productIds.length) return 0;
  const unique = [...new Set(productIds)];
  const { data, error } = await supabase
    .from("products")
    .update({ supplier_id: supplierId })
    .in("id", unique)
    .is("supplier_id", null)
    .select("id");
  if (error) {
    if (isPostgrestMissingColumn(error, "supplier_id")) return 0;
    throw new Error(error.message);
  }
  return data?.length ?? 0;
}
