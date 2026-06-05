import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createProductInstanceFromTemplate,
  isOnOrderCatalogTemplate,
} from "@/lib/admin/createProductInstanceFromTemplate";
import {
  mergeDeliveryFields,
  validateDeliveryFieldsComplete,
} from "@/lib/admin/productDeliveryValidation";
import { upsertProductSpecs, replaceProductImages, type ImageInput, type SpecsInput } from "@/lib/admin/syncProductChildren";

type UpdateBody = {
  createInstanceFromOnOrder?: boolean;
  indoorUnitSerial?: string | null;
  outdoorUnitSerial?: string | null;
  purchasedAt?: string | null;
  supplierInvoiceNumber?: string | null;
  purchasePrice?: number | null;
  supplierId?: string | null;
  stockLocation?: string | null;
  stockStatus?: string;
  specs?: SpecsInput;
  images?: Array<{ url: string; sort_order?: number; is_main?: boolean }>;
};

type CurrentRow = {
  stock_status: string | null;
  supplier_order_work_item_id: string | null;
  indoor_unit_serial: string | null;
  outdoor_unit_serial: string | null;
  supplier_invoice_number: string | null;
  purchased_at: string | null;
};

export function shouldCreateInstanceFromOnOrderPut(
  current: CurrentRow,
  body: UpdateBody,
): boolean {
  if (!isOnOrderCatalogTemplate(current)) return false;
  if (body.createInstanceFromOnOrder !== true) return false;

  const merged = mergeDeliveryFields(current, body);
  return validateDeliveryFieldsComplete(merged) === null;
}

export function validateOnOrderPartialDelivery(
  current: CurrentRow,
  body: UpdateBody,
): string | null {
  if (!isOnOrderCatalogTemplate(current)) return null;
  if (body.createInstanceFromOnOrder !== true) return null;
  const merged = mergeDeliveryFields(current, body);
  const anyFilled = Boolean(
    merged.indoorUnitSerial ||
      merged.outdoorUnitSerial ||
      merged.supplierInvoiceNumber ||
      merged.purchasedAt,
  );
  if (!anyFilled) return null;
  const err = validateDeliveryFieldsComplete(merged);
  if (!err) return null;
  return "За нова бройка в наличност попълнете всички полета: двата серийни номера, дата на доставка и номер на фактура.";
}

/** Премахва полета, които не трябва да се записват на шаблона „по поръчка“. */
export function stripTemplateOnlyFieldsFromPatch(patch: Record<string, unknown>): void {
  delete patch.indoor_unit_serial;
  delete patch.outdoor_unit_serial;
  delete patch.purchased_at;
  delete patch.supplier_invoice_number;
  delete patch.purchase_price;
  patch.stock_status = "on_order";
}

export async function copyProductChildrenToInstance(
  supabase: SupabaseClient,
  instanceId: string,
  specs?: SpecsInput,
  images?: UpdateBody["images"],
): Promise<string | null> {
  if (specs) {
    const { error } = await upsertProductSpecs(supabase, instanceId, specs);
    if (error) return error.message;
  }
  if (images) {
    const imgs: ImageInput[] = images.map((im) => ({
      url: im.url,
      sort_order: im.sort_order ?? 0,
      is_main: im.is_main ?? false,
    }));
    const { error } = await replaceProductImages(supabase, instanceId, imgs);
    if (error) return error.message;
  }
  return null;
}

export async function createInstanceFromOnOrderTemplatePut(
  supabase: SupabaseClient,
  template: Record<string, unknown>,
  current: CurrentRow,
  body: UpdateBody,
): Promise<{ id: string; name: string }> {
  const merged = mergeDeliveryFields(current, body);
  const purchasePrice = body.purchasePrice;
  if (purchasePrice === undefined || purchasePrice === null || !Number.isFinite(purchasePrice) || purchasePrice < 0) {
    throw new Error("Въведете закупна цена за новата бройка в наличност.");
  }

  return createProductInstanceFromTemplate(supabase, template, {
    delivery: merged,
    purchasePrice,
    supplierId: body.supplierId !== undefined ? body.supplierId : undefined,
    stockLocation: body.stockLocation,
    supplierOrderWorkItemId: null,
  });
}
