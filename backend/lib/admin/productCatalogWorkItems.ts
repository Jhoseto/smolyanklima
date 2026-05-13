import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Автоматични work_items за оперативния календар при добавяне / премахване
 * на ред в каталога с продукти (не се създават ръчно от календара).
 */
export async function insertProductCatalogStockCalendarEvent(
  supabase: SupabaseClient,
  input: { kind: "added" | "removed"; productId: string; productName: string; createdBy: string | null },
): Promise<void> {
  const name = input.productName.trim() || "Продукт";
  const today = new Date().toISOString().slice(0, 10);
  const isAdd = input.kind === "added";
  const { error } = await supabase.from("work_items").insert({
    type: isAdd ? "stock_in" : "stock_out",
    event_code: isAdd ? "item_added" : "item_removed",
    status: "done",
    priority: "medium",
    title: isAdd ? `Добавен продукт: ${name}` : `Премахнат продукт: ${name}`,
    notes: null,
    due_date: today,
    product_id: input.productId,
    contact_id: null,
    inquiry_id: null,
    customer_name: null,
    customer_phone: null,
    customer_address: null,
    assigned_to: null,
    quantity: 1,
    unit_price: null,
    total_amount: null,
    created_by: input.createdBy,
  });
  if (error) {
    console.warn("[productCatalogWorkItems] insert failed:", error.message);
  }
}
