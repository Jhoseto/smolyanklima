import type { SupabaseClient } from "@supabase/supabase-js";
import {
  findSerialConflicts,
  formatSerialConflictError,
  mergeDeliveryFields,
  trimDeliveryFields,
  type DeliveryFields,
} from "@/lib/admin/productDeliveryValidation";

export type UsedBatchStubRow = {
  product_condition?: string | null;
  stock_status?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
};

type UpdateBody = {
  finalizeUsedBatchStub?: boolean;
  indoorUnitSerial?: string | null;
  outdoorUnitSerial?: string | null;
};

/** Анонимна бройка от партида „втора употреба“ — още без серийни номера. */
export function isUsedBatchStub(row: UsedBatchStubRow): boolean {
  if (row.product_condition !== "used") return false;
  if (row.stock_status && row.stock_status !== "in_stock") return false;
  return !String(row.indoor_unit_serial ?? "").trim() && !String(row.outdoor_unit_serial ?? "").trim();
}

/** За финализиране на партида са задължителни само двата серийни номера. */
export function validateUsedBatchSerialFields(fields: Pick<DeliveryFields, "indoorUnitSerial" | "outdoorUnitSerial">): string | null {
  if (!fields.indoorUnitSerial) return "Въведете сериен номер на вътрешното тяло.";
  if (!fields.outdoorUnitSerial) return "Въведете сериен номер на външното тяло.";
  return null;
}

export function shouldFinalizeUsedBatchStub(
  current: UsedBatchStubRow,
  body: UpdateBody,
): boolean {
  if (!isUsedBatchStub(current)) return false;
  if (body.finalizeUsedBatchStub !== true) return false;
  const merged = mergeDeliveryFields(current, body);
  return validateUsedBatchSerialFields(merged) === null;
}

/**
 * Блокира обикновен PUT, който добавя серийни № на stub без finalizeUsedBatchStub.
 * Позволява други промени (цена, снимки…) — само серийните полета са заключени.
 */
export function validateUsedBatchStubSerialPatch(
  current: UsedBatchStubRow,
  body: UpdateBody,
): string | null {
  if (!isUsedBatchStub(current)) return null;
  if (body.finalizeUsedBatchStub === true) return null;

  const merged = trimDeliveryFields(mergeDeliveryFields(current, body));
  const hadSerials = Boolean(
    String(current.indoor_unit_serial ?? "").trim() || String(current.outdoor_unit_serial ?? "").trim(),
  );
  if (hadSerials) return null;

  const addingIndoor = body.indoorUnitSerial !== undefined;
  const addingOutdoor = body.outdoorUnitSerial !== undefined;
  if (!addingIndoor && !addingOutdoor) return null;

  const anySerial = Boolean(merged.indoorUnitSerial || merged.outdoorUnitSerial);
  if (!anySerial) return null;

  return "За бройка от партида без серийни номера използвайте «Запази като инстанция», след като попълните двата серийни номера (вътрешно и външно тяло).";
}

export async function assertUsedBatchSerialsUnique(
  supabase: SupabaseClient,
  fields: Pick<DeliveryFields, "indoorUnitSerial" | "outdoorUnitSerial">,
  excludeId: string,
): Promise<string | null> {
  const conflicts = await findSerialConflicts(supabase, {
    indoor: fields.indoorUnitSerial,
    outdoor: fields.outdoorUnitSerial,
    excludeId,
  });
  if (conflicts.length > 0) return formatSerialConflictError(conflicts);
  return null;
}
