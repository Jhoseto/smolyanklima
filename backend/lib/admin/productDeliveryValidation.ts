import type { SupabaseClient } from "@supabase/supabase-js";

export type DeliveryFields = {
  indoorUnitSerial: string;
  outdoorUnitSerial: string;
  supplierInvoiceNumber: string;
  purchasedAt: string;
};

export type SerialConflict = {
  id: string;
  name: string;
  slug: string | null;
  field: "indoor" | "outdoor" | "both";
};

export function trimDeliveryFields(
  raw: Partial<{ [K in keyof DeliveryFields]: string | null | undefined }>,
): DeliveryFields {
  return {
    indoorUnitSerial: String(raw.indoorUnitSerial ?? "").trim(),
    outdoorUnitSerial: String(raw.outdoorUnitSerial ?? "").trim(),
    supplierInvoiceNumber: String(raw.supplierInvoiceNumber ?? "").trim(),
    purchasedAt: String(raw.purchasedAt ?? "").trim(),
  };
}

function validatePurchasedAt(fields: DeliveryFields): string | null {
  if (!fields.purchasedAt) return "Въведете дата на доставка.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.purchasedAt)) {
    return "Невалидна дата на доставка (формат ГГГГ-ММ-ДД).";
  }
  return null;
}

/** Пълни данни за доставка (редакция на бройка / създаване от формата на продукт). */
export function validateDeliveryFieldsComplete(fields: DeliveryFields): string | null {
  if (!fields.indoorUnitSerial) return "Въведете сериен номер на вътрешното тяло.";
  if (!fields.outdoorUnitSerial) return "Въведете сериен номер на външното тяло.";
  if (!fields.supplierInvoiceNumber) return "Въведете номер на фактура от доставчик.";
  return validatePurchasedAt(fields);
}

/** Минимум за „Получена“ поръчка от доставчик — само дата (серийни № и фактура по избор). */
export function validateDeliveryFieldsForOrderFulfill(fields: DeliveryFields): string | null {
  return validatePurchasedAt(fields);
}

export function formatSerialConflictError(matches: SerialConflict[]): string {
  if (matches.length === 0) return "Сериен номерът вече съществува в системата.";
  const names = [...new Set(matches.map((m) => m.name))].slice(0, 3);
  return `Сериен номерът вече е записан при: ${names.join(", ")}.`;
}

function escapeIlike(serial: string): string {
  return serial.replace(/[%,]/g, " ").trim();
}

/** Търси дубликати на серийни номера (вътрешно/външно тяло) в products. */
export async function findSerialConflicts(
  supabase: SupabaseClient,
  opts: { indoor?: string | null; outdoor?: string | null; excludeId?: string },
): Promise<SerialConflict[]> {
  const indoor = String(opts.indoor ?? "").trim();
  const outdoor = String(opts.outdoor ?? "").trim();
  const needles = new Set<string>();
  if (indoor) needles.add(indoor.toLowerCase());
  if (outdoor) needles.add(outdoor.toLowerCase());
  if (needles.size === 0) return [];

  const queries: string[] = [];
  if (indoor) queries.push(`indoor_unit_serial.ilike.${escapeIlike(indoor)}`);
  if (outdoor) queries.push(`outdoor_unit_serial.ilike.${escapeIlike(outdoor)}`);

  let query = supabase
    .from("products")
    .select("id,name,slug,indoor_unit_serial,outdoor_unit_serial")
    .or(queries.join(","))
    .limit(20);
  if (opts.excludeId) query = query.neq("id", opts.excludeId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const byId = new Map<string, SerialConflict>();
  for (const row of data ?? []) {
    const id = String(row.id);
    const indoorVal = String(row.indoor_unit_serial ?? "").trim().toLowerCase();
    const outdoorVal = String(row.outdoor_unit_serial ?? "").trim().toLowerCase();
    const hitIndoor = indoor && indoorVal === indoor.toLowerCase();
    const hitOutdoor = outdoor && outdoorVal === outdoor.toLowerCase();
    if (!hitIndoor && !hitOutdoor) continue;
    const existing = byId.get(id);
    if (existing) {
      if (hitIndoor && hitOutdoor) existing.field = "both";
      else if (hitIndoor && existing.field === "outdoor") existing.field = "both";
      else if (hitOutdoor && existing.field === "indoor") existing.field = "both";
      continue;
    }
    byId.set(id, {
      id,
      name: String(row.name ?? ""),
      slug: (row.slug as string | null) ?? null,
      field: hitIndoor && hitOutdoor ? "both" : hitIndoor ? "indoor" : "outdoor",
    });
  }
  return [...byId.values()].slice(0, 5);
}

function rowDeliveryIncomplete(row: {
  purchased_at?: string | null;
  purchase_price?: number | null;
}): boolean {
  const purchasedAt = String(row.purchased_at ?? "").trim();
  const price = row.purchase_price != null ? Number(row.purchase_price) : NaN;
  return !purchasedAt || !Number.isFinite(price) || price < 0;
}

/** Незавършена доставена бройка за същия модел (блокира нова инстанция). */
export async function findIncompleteDeliveredInstanceForModel(
  supabase: SupabaseClient,
  opts: { brandId: string; modelCode: string; excludeProductId?: string },
): Promise<{ id: string; name: string } | null> {
  const modelCode = String(opts.modelCode ?? "").trim();
  if (!modelCode) return null;

  let query = supabase
    .from("products")
    .select("id,name,purchased_at,purchase_price")
    .eq("brand_id", opts.brandId)
    .ilike("model_code", modelCode)
    .eq("stock_status", "in_stock")
    .not("supplier_order_work_item_id", "is", null)
    .limit(20);
  if (opts.excludeProductId) query = query.neq("id", opts.excludeProductId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const hit = (data ?? []).find((r) => rowDeliveryIncomplete(r));
  if (!hit) return null;
  return { id: String(hit.id), name: String(hit.name ?? "") };
}

export function mergeDeliveryFields(
  current: {
    indoor_unit_serial?: string | null;
    outdoor_unit_serial?: string | null;
    supplier_invoice_number?: string | null;
    purchased_at?: string | null;
  },
  patch: Partial<{
    indoorUnitSerial?: string | null;
    outdoorUnitSerial?: string | null;
    supplierInvoiceNumber?: string | null;
    purchasedAt?: string | null;
  }>,
): DeliveryFields {
  return trimDeliveryFields({
    indoorUnitSerial:
      patch.indoorUnitSerial !== undefined
        ? patch.indoorUnitSerial
        : current.indoor_unit_serial,
    outdoorUnitSerial:
      patch.outdoorUnitSerial !== undefined
        ? patch.outdoorUnitSerial
        : current.outdoor_unit_serial,
    supplierInvoiceNumber:
      patch.supplierInvoiceNumber !== undefined
        ? patch.supplierInvoiceNumber
        : current.supplier_invoice_number,
    purchasedAt: patch.purchasedAt !== undefined ? patch.purchasedAt : current.purchased_at,
  });
}

export function isDeliveredProductInstance(row: {
  supplier_order_work_item_id?: string | null;
}): boolean {
  return Boolean(row.supplier_order_work_item_id);
}
