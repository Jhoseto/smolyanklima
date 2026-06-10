import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Връща резервиран продукт като наличен след отменена резервация.
 */
export async function restoreProductStockAfterReservationCancel(
  db: SupabaseClient,
  productId: string,
): Promise<{ restored: boolean; productId: string }> {
  const { data: product, error } = await db
    .from("products")
    .select("id,stock_status")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!product) return { restored: false, productId };

  if (String((product as { stock_status?: string }).stock_status ?? "") !== "reserved") {
    return { restored: false, productId };
  }

  const { error: upErr } = await db.from("products").update({ stock_status: "in_stock" }).eq("id", productId);
  if (upErr) throw new Error(upErr.message);

  return { restored: true, productId };
}

export function canRestoreStockForReservation(row: {
  event_code?: string | null;
  status?: string | null;
}): boolean {
  return row.event_code === "reservation" && row.status !== "cancelled" && row.status !== "done";
}
