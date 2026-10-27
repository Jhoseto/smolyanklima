import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureTempexSupplierId(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.from("contacts").select("id,contact_kind")
    .or("full_name.ilike.%темпекс%,full_name.ilike.%tempex%")
    .order("created_at").limit(20);
  if (error) throw new Error(error.message);
  const existing = data?.find((row) => row.contact_kind === "supplier") ?? data?.[0];
  if (existing) {
    if (existing.contact_kind !== "supplier") {
      const result = await db.from("contacts").update({ contact_kind: "supplier" }).eq("id", existing.id);
      if (result.error) throw new Error(result.error.message);
    }
    return String(existing.id);
  }
  const result = await db.from("contacts").insert({
    full_name: "ТЕМПЕКС ЕООД", contact_kind: "supplier", phone: "0700 45 300", email: "plovdiv@tempexbg.com",
    address: 'Пловдив, бул. „Кукленско шосе“ 52',
    notes: "https://tempex.bg/bg/ — автоматично създаден при синхронизация на каталога.",
  }).select("id").single();
  if (result.error || !result.data?.id) throw new Error(result.error?.message ?? "Неуспешно създаване на доставчик Tempex.");
  return String(result.data.id);
}
