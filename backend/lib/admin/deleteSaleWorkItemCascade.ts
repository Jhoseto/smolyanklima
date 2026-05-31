import type { SupabaseClient } from "@supabase/supabase-js";
import { deleteAcceptanceProtocolForInstallation } from "@/lib/admin/acceptanceProtocolFromInstall";

type Db = SupabaseClient;

async function deleteInstallationWorkItem(db: Db, installId: string): Promise<string | null> {
  try {
    await deleteAcceptanceProtocolForInstallation(db, installId, "sale_cancelled");
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[deleteSaleWorkItemCascade] acceptance protocol delete failed:", message);
  }
  const { error } = await db.from("work_items").delete().eq("id", installId);
  return error?.message ?? null;
}

/**
 * Преди изтриване на sale work_item: монтаж, поръчка към доставчик (Поръчки), import/delivered продукт.
 */
export async function cascadeDeleteBeforeSaleWorkItem(
  db: Db,
  sale: {
    id: string;
    installation_work_item_id?: string | null;
    product_id?: string | null;
  },
): Promise<{ error?: string; deletedSupplierOrderId?: string | null }> {
  const installIds = new Set<string>();
  if (sale.installation_work_item_id) installIds.add(sale.installation_work_item_id);

  const { data: linkedInstalls } = await db
    .from("work_items")
    .select("id")
    .eq("sale_work_item_id", sale.id);
  for (const row of linkedInstalls ?? []) {
    if (row.id) installIds.add(String(row.id));
  }

  for (const installId of installIds) {
    const err = await deleteInstallationWorkItem(db, installId);
    if (err) return { error: `Неуспешно изтриване на свързания монтаж: ${err}` };
  }

  let supplierOrderId: string | null = null;
  if (sale.product_id) {
    const { data: product, error: prodLoadErr } = await db
      .from("products")
      .select("id, slug, supplier_order_work_item_id")
      .eq("id", sale.product_id)
      .maybeSingle();
    if (prodLoadErr) return { error: prodLoadErr.message };

    supplierOrderId = (product?.supplier_order_work_item_id as string | null) ?? null;

    if (supplierOrderId) {
      const { error: orderDelErr } = await db.from("work_items").delete().eq("id", supplierOrderId);
      if (orderDelErr) {
        return {
          error: `Неуспешно изтриване на свързаната поръчка към доставчик: ${orderDelErr.message}`,
        };
      }
    }

    const slug = String(product?.slug ?? "");
    const isImportProduct = slug.startsWith("book2023-");
    const isDeliveredInstance = Boolean(supplierOrderId);
    if (isImportProduct || isDeliveredInstance) {
      const { error: prodDelErr } = await db.from("products").delete().eq("id", sale.product_id);
      if (prodDelErr) {
        return { error: `Неуспешно изтриване на свързания продукт: ${prodDelErr.message}` };
      }
    }
  }

  return { deletedSupplierOrderId: supplierOrderId };
}
