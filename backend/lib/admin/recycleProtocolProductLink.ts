import type { SupabaseClient } from "@supabase/supabase-js";
import { findSerialConflicts, formatSerialConflictError } from "@/lib/admin/productDeliveryValidation";

/**
 * "Финализира" анонимна бройка от партида втора употреба (products), щом
 * сервизен протокол тип "рециклиране" (service_kind='recycle') събере и
 * двата серийни номера (вътрешно + външно тяло). Тогава бройката вече е
 * конкретна, разпознаваема инстанция и де-факто "отпада" от общия
 * неопределен пул на партидата.
 *
 * Вика се при create/update на протокола. Не хвърля — връща структуриран
 * резултат, за да не блокира записа на самия протокол при конфликт.
 */
export async function applyRecycleSerialsToProduct(
  db: SupabaseClient,
  productId: string,
  indoorSerial: string | null | undefined,
  outdoorSerial: string | null | undefined,
): Promise<{ ok: true; applied: boolean } | { ok: false; error: string }> {
  const indoor = String(indoorSerial ?? "").trim();
  const outdoor = String(outdoorSerial ?? "").trim();
  if (!indoor || !outdoor) return { ok: true, applied: false };

  try {
    const conflicts = await findSerialConflicts(db, { indoor, outdoor, excludeId: productId });
    if (conflicts.length > 0) {
      return { ok: false, error: formatSerialConflictError(conflicts) };
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Грешка при проверка за дублирани серийни номера.",
    };
  }

  const { error } = await db
    .from("products")
    .update({ indoor_unit_serial: indoor, outdoor_unit_serial: outdoor })
    .eq("id", productId);
  if (error) return { ok: false, error: error.message };
  return { ok: true, applied: true };
}
