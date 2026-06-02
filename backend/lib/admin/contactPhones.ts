import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Един „допълнителен“ телефон на контакта — основният телефон се пази
 * в `contacts.phone`, докато тази структура отговаря за останалите.
 *
 * Бизнес логика:
 *   - В `contact_phones` пазим ВСИЧКИ телефони (включително основния),
 *     така че UI-ът да може да показва списък и да оставя „call“ бутон
 *     за всеки от тях. Колоната `contacts.phone` остава основният,
 *     за да не чупим работещите интеграции (work_items, sales, и т.н.).
 *   - „Основен“ телефон може да има само един (UNIQUE WHERE is_primary).
 */
export const ContactPhoneInputSchema = z.object({
  phone: z.string().min(3).max(80),
  label: z.string().max(80).optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
});

export type ContactPhoneInput = z.infer<typeof ContactPhoneInputSchema>;

export type ContactPhoneRow = {
  id: string;
  contact_id: string;
  phone: string;
  label: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

/**
 * Нормализиране: trim-ваме всичко, изпускаме празни, гарантираме че има
 * точно един „is_primary“ телефон (ако нито един не е флагнат — първият
 * в списъка става основен).
 */
export function normalizePhonesInput(
  primaryPhone: string,
  additional: ContactPhoneInput[] | undefined | null,
): { primaryPhone: string; phones: Array<{ phone: string; label: string | null; is_primary: boolean; sort_order: number }> } {
  const primary = primaryPhone.trim();
  const extras = (additional ?? [])
    .map((p) => ({
      phone: String(p.phone ?? "").trim(),
      label: p.label?.trim() || null,
      is_primary: Boolean(p.isPrimary),
    }))
    .filter((p) => p.phone.length >= 3);

  // Изхвърляме евентуални дубликати на основния телефон сред допълнителните.
  const seen = new Set<string>([digits(primary)]);
  const dedupedExtras: typeof extras = [];
  for (const e of extras) {
    const key = digits(e.phone);
    if (key && seen.has(key)) continue;
    seen.add(key);
    dedupedExtras.push(e);
  }

  // Изграждаме крайния списък — основният телефон винаги е първи.
  const phones: Array<{ phone: string; label: string | null; is_primary: boolean; sort_order: number }> = [];
  phones.push({ phone: primary, label: "Основен", is_primary: true, sort_order: 0 });

  let order = 1;
  for (const e of dedupedExtras) {
    // Само ОДИН телефон може да бъде primary в базата (UNIQUE индекс).
    phones.push({ phone: e.phone, label: e.label, is_primary: false, sort_order: order++ });
  }

  return { primaryPhone: primary, phones };
}

function digits(p: string): string {
  return p.replace(/[^\d+]/g, "");
}

/**
 * Триене + повторно вмъкване на телефоните на контакт. По-просто и сигурно,
 * отколкото diff-based UPSERT — броят телефони на контакт е малък (≤ 10).
 */
export async function replaceContactPhones(
  supabase: SupabaseClient,
  contactId: string,
  primaryPhone: string,
  additionalPhones: ContactPhoneInput[] | undefined | null,
): Promise<{ error: string | null }> {
  const { phones } = normalizePhonesInput(primaryPhone, additionalPhones);
  const { data: existingRows, error: loadErr } = await supabase
    .from("contact_phones")
    .select("contact_id,phone,label,is_primary,sort_order")
    .eq("contact_id", contactId);
  if (loadErr) {
    if (isMissingTable(loadErr.message)) return { error: null };
    return { error: loadErr.message };
  }

  const { error: delErr } = await supabase
    .from("contact_phones")
    .delete()
    .eq("contact_id", contactId);
  if (delErr) {
    if (isMissingTable(delErr.message)) return { error: null };
    return { error: delErr.message };
  }

  if (phones.length === 0) return { error: null };

  const rows = phones.map((p) => ({
    contact_id: contactId,
    phone: p.phone,
    label: p.label,
    is_primary: p.is_primary,
    sort_order: p.sort_order,
  }));

  const { error: insErr } = await supabase.from("contact_phones").insert(rows);
  if (insErr) {
    if (isMissingTable(insErr.message)) return { error: null };
    if (existingRows && existingRows.length > 0) {
      const { error: restoreErr } = await supabase.from("contact_phones").insert(existingRows);
      if (restoreErr && !isMissingTable(restoreErr.message)) {
        return { error: `${insErr.message}; rollback failed: ${restoreErr.message}` };
      }
    }
    return { error: insErr.message };
  }

  return { error: null };
}

export async function loadContactPhones(
  supabase: SupabaseClient,
  contactId: string,
): Promise<ContactPhoneRow[]> {
  const { data, error } = await supabase
    .from("contact_phones")
    .select("id,contact_id,phone,label,is_primary,sort_order,created_at,updated_at")
    .eq("contact_id", contactId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    if (isMissingTable(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as ContactPhoneRow[];
}

function isMissingTable(message: string): boolean {
  return (
    message.includes("contact_phones") &&
    (message.includes("does not exist") || message.includes("schema cache"))
  );
}
