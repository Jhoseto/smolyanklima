import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findSerialConflicts,
  formatSerialConflictError,
  trimDeliveryFields,
  validateDeliveryFieldsComplete,
  type DeliveryFields,
} from "@/lib/admin/productDeliveryValidation";
import { normalizeProductStockLocation } from "@/lib/admin/productStockLocation";

export function isOnOrderCatalogTemplate(row: {
  stock_status?: string | null;
  supplier_order_work_item_id?: string | null;
}): boolean {
  return row.stock_status === "on_order" && !row.supplier_order_work_item_id;
}

export type CreateProductInstanceInput = {
  delivery: DeliveryFields;
  purchasePrice: number;
  supplierId?: string | null;
  stockLocation?: string | null;
  supplierOrderWorkItemId?: string | null;
  /** Продажна цена на инстанцията (ако липсва — от шаблона). */
  priceOverride?: number | null;
};

/**
 * Нова физическа бройка от шаблон (on_order или друг запис).
 * Шаблонът остава непроменен по идентичност; инстанцията е in_stock, скрита от публичния каталог.
 */
export async function createProductInstanceFromTemplate(
  supabase: SupabaseClient,
  template: Record<string, unknown>,
  input: CreateProductInstanceInput,
): Promise<{ id: string; name: string }> {
  const delivery = trimDeliveryFields(input.delivery);
  const deliveryErr = validateDeliveryFieldsComplete(delivery);
  if (deliveryErr) throw new Error(deliveryErr);

  if (!Number.isFinite(input.purchasePrice) || input.purchasePrice < 0) {
    throw new Error("Въведете закупна цена за новата бройка.");
  }

  const serialConflicts = await findSerialConflicts(supabase, {
    indoor: delivery.indoorUnitSerial,
    outdoor: delivery.outdoorUnitSerial,
  });
  if (serialConflicts.length > 0) {
    throw new Error(formatSerialConflictError(serialConflicts));
  }

  const priceFromTemplate = Number(template.price ?? 0);
  const price =
    input.priceOverride != null && Number.isFinite(input.priceOverride) && input.priceOverride >= 0
      ? input.priceOverride
      : priceFromTemplate;

  const supplierId =
    input.supplierId !== undefined ? input.supplierId : ((template.supplier_id as string | null) ?? null);

  const { data: newProduct, error: prodErr } = await supabase
    .from("products")
    .insert({
      name: template.name,
      slug: null,
      description: template.description ?? null,
      internal_note: null,
      price,
      price_with_mount: template.price_with_mount ?? null,
      purchase_price: input.purchasePrice,
      brand_id: template.brand_id ?? null,
      type_id: template.type_id ?? null,
      product_condition: template.product_condition ?? "new",
      stock_status: "in_stock",
      stock_quantity: 1,
      sold_quantity: 0,
      show_in_public_catalog: false,
      is_featured: false,
      featured_position: null,
      model_code: template.model_code ?? null,
      supplier_id: supplierId,
      source_url: template.source_url ?? null,
      product_region: template.product_region ?? null,
      stock_location: normalizeProductStockLocation(input.stockLocation ?? template.stock_location),
      indoor_unit_serial: delivery.indoorUnitSerial,
      outdoor_unit_serial: delivery.outdoorUnitSerial,
      supplier_invoice_number: delivery.supplierInvoiceNumber,
      purchased_at: delivery.purchasedAt,
      supplier_order_work_item_id: input.supplierOrderWorkItemId ?? null,
    })
    .select("id, name")
    .single();

  if (prodErr) throw new Error(prodErr.message);

  return {
    id: String((newProduct as { id: string }).id),
    name: String((newProduct as { name?: string }).name ?? ""),
  };
}
