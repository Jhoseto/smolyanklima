import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;

type ProductStockRow = {
  id: string;
  model_code?: string | null;
  stock_status?: string | null;
  stock_quantity?: number | null;
  sold_quantity?: number | null;
};

/**
 * Обратна операция на recordProductSale / markAsSold:
 * връща конкретната бройка като налична след отказ на продажба в „чака монтаж“.
 */
export async function restoreProductStockAfterPendingSaleCancel(
  db: Db,
  productId: string,
  quantity = 1,
): Promise<{ restored: boolean; productId: string }> {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1));

  const { data: product, error } = await db
    .from("products")
    .select("id,model_code,stock_status,stock_quantity,sold_quantity")
    .eq("id", productId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!product) return { restored: false, productId };

  const row = product as ProductStockRow;
  const sold = Math.max(0, Number(row.sold_quantity ?? 0));
  if (sold <= 0) return { restored: false, productId };

  const hasModelCode = Boolean(String(row.model_code ?? "").trim());
  const nextSold = Math.max(0, sold - qty);
  const patch: Record<string, unknown> = { sold_quantity: nextSold };

  if (!hasModelCode) {
    const currentQty = Math.max(0, Number(row.stock_quantity ?? 0));
    patch.stock_quantity = currentQty + qty;
  }

  // След продажба от in_stock per-instance записът става out_of_stock.
  if (String(row.stock_status ?? "") === "out_of_stock") {
    patch.stock_status = "in_stock";
  }

  const { error: upErr } = await db.from("products").update(patch).eq("id", productId);
  if (upErr) throw new Error(upErr.message);

  return { restored: true, productId };
}

export function canRestoreStockForPendingSale(row: {
  sale_install_state?: string | null;
  status?: string | null;
}): boolean {
  return row.sale_install_state === "pending_mount" && row.status !== "cancelled";
}
