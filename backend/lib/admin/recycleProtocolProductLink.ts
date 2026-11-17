import type { SupabaseClient } from "@supabase/supabase-js";
import { findSerialConflicts, formatSerialConflictError } from "@/lib/admin/productDeliveryValidation";

/**
 * "Финализира" анонимна бройка от партида втора употреба (products), щом
 * сервизен протокол тип "рециклиране" (service_kind='recycle') събере и
 * двата серийни номера (вътрешно + външно тяло). Тогава бройката вече е
 * конкретна, разпознаваема инстанция. Другите състояния на продукта могат
 * да са свързани с протокола, без да се променят в склада.
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
    const readUnit = () => db.from("products")
      .select("product_condition,stock_status,indoor_unit_serial,outdoor_unit_serial")
      .eq("id", productId).maybeSingle();
    const { data: unit, error: readError } = await readUnit();
    if (readError) throw new Error(readError.message);
    if (!unit) return { ok: false, error: "Избраната бройка вече не е в каталога." };
    const currentIndoor = String(unit.indoor_unit_serial ?? "").trim();
    const currentOutdoor = String(unit.outdoor_unit_serial ?? "").trim();
    if ((currentIndoor && currentIndoor.toLowerCase() !== indoor.toLowerCase()) ||
        (currentOutdoor && currentOutdoor.toLowerCase() !== outdoor.toLowerCase())) {
      return { ok: false, error: "Серийните номера в протокола се различават от записаните при избраната бройка. Провери бройката и номерата." };
    }
    if ((currentIndoor && currentOutdoor) || unit.product_condition !== "used" || unit.stock_status !== "in_stock") {
      return { ok: true, applied: false };
    }

    const conflicts = await findSerialConflicts(db, { indoor, outdoor, excludeId: productId });
    if (conflicts.length > 0) {
      return { ok: false, error: formatSerialConflictError(conflicts) };
    }

    let update = db.from("products")
      .update({
        ...(!currentIndoor ? { indoor_unit_serial: indoor } : {}),
        ...(!currentOutdoor ? { outdoor_unit_serial: outdoor } : {}),
      })
      .eq("id", productId).eq("product_condition", "used").eq("stock_status", "in_stock");
    for (const field of ["indoor_unit_serial", "outdoor_unit_serial"] as const) {
      update = unit[field] == null ? update.is(field, null) : update.eq(field, unit[field]);
    }
    const { data: updated, error } = await update.select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (updated) return { ok: true, applied: true };

    // Друг запис може да е завършил същата бройка, докато проверяваме серийните номера.
    const { data: latest, error: latestError } = await readUnit();
    if (latestError) throw new Error(latestError.message);
    if (String(latest?.indoor_unit_serial ?? "").trim().toLowerCase() === indoor.toLowerCase() &&
        String(latest?.outdoor_unit_serial ?? "").trim().toLowerCase() === outdoor.toLowerCase()) {
      return { ok: true, applied: false };
    }
    return { ok: false, error: "Бройката е променена междувременно. Провери актуалните ѝ данни в каталога." };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Грешка при свързване на серийните номера с бройката.",
    };
  }
}
