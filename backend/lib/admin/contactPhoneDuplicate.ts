import type { SupabaseClient } from "@supabase/supabase-js";

export type PrimaryPhoneConflict = { id: string; full_name: string; phone: string };

/**
 * Уникален индекс `uq_contacts_phone_when_set` върху `contacts.phone` (non-null).
 * Проверката е по точния низ след trim — същото като при POST/PUT.
 */
export async function findPrimaryPhoneConflict(
  supabase: SupabaseClient,
  phone: string,
  excludeContactId?: string | null,
): Promise<PrimaryPhoneConflict | null> {
  const p = phone.trim();
  if (p.length < 3) return null;
  const { data, error } = await supabase.from("contacts").select("id,full_name,phone").eq("phone", p).maybeSingle();
  if (error || !data) return null;
  if (excludeContactId && data.id === excludeContactId) return null;
  return {
    id: data.id as string,
    full_name: String((data as { full_name?: string }).full_name ?? ""),
    phone: String((data as { phone?: string }).phone ?? p),
  };
}

export function formatDuplicatePrimaryPhoneMessage(conflict: PrimaryPhoneConflict): string {
  return `Този телефон (${conflict.phone}) вече е записан за контакт „${conflict.full_name}“. Отворете съществуващия контакт или сменете номера.`;
}

export function isPostgresContactsPhoneUniqueViolation(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("uq_contacts_phone_when_set") ||
    (m.includes("duplicate key") && m.includes("contacts") && m.includes("phone"))
  );
}
