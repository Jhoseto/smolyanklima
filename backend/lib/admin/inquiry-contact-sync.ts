import type { SupabaseClient } from "@supabase/supabase-js";

function normalizePhone(value: string | null | undefined): string {
  return String(value ?? "").replace(/[^\d+]/g, "").trim();
}

function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const da = na.replace(/\D/g, "");
  const db = nb.replace(/\D/g, "");
  if (da.length >= 9 && db.length >= 9 && da.slice(-9) === db.slice(-9)) return true;
  return false;
}

/** При приключено/обработено запитване — маха планирано обаждане от съвпадащ CRM контакт. */
export async function clearContactFollowUpWhenInquiryResolved(
  db: SupabaseClient,
  customerPhone: string,
  inquiryStatus: string,
): Promise<void> {
  if (inquiryStatus === "new") return;

  const { data: contacts, error: loadError } = await db
    .from("contacts")
    .select("id,phone")
    .not("next_follow_up_at", "is", null);

  if (loadError) throw loadError;

  const ids = (contacts ?? [])
    .filter((c) => phonesMatch(c.phone, customerPhone))
    .map((c) => c.id);

  if (ids.length === 0) return;

  const { error: updateError } = await db
    .from("contacts")
    .update({ next_follow_up_at: null })
    .in("id", ids);

  if (updateError) throw updateError;
}
