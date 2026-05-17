import type { SupabaseClient } from "@supabase/supabase-js";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";

export const KLIMAKOM_SUPPLIER_NAME = "КЛИМАКОМ ЕООД";

const NAME_OR_FILTER =
  "full_name.ilike.%климаком%,full_name.ilike.%climacom%,full_name.ilike.%klimacom%";

type ContactRow = { id: string; full_name?: string | null; contact_kind?: string | null };

function pickKlimakomContact(rows: ContactRow[]): ContactRow | null {
  if (!rows.length) return null;
  const supplier = rows.find((r) => r.contact_kind === "supplier");
  if (supplier) return supplier;
  return rows.find((r) => /климаком|climacom|klimacom/i.test(String(r.full_name ?? ""))) ?? rows[0] ?? null;
}

async function findKlimakomContact(supabase: SupabaseClient): Promise<ContactRow | null> {
  const withKind = await supabase
    .from("contacts")
    .select("id,full_name,contact_kind")
    .or(NAME_OR_FILTER)
    .order("full_name")
    .limit(20);

  if (!withKind.error && withKind.data?.length) {
    return pickKlimakomContact(withKind.data as ContactRow[]);
  }

  const exact = await supabase
    .from("contacts")
    .select("id,full_name,contact_kind")
    .ilike("full_name", KLIMAKOM_SUPPLIER_NAME)
    .limit(1)
    .maybeSingle();

  if (!exact.error && exact.data?.id) return exact.data as ContactRow;
  return null;
}

export async function ensureKlimakomSupplierId(supabase: SupabaseClient): Promise<string | null> {
  const existing = await findKlimakomContact(supabase);
  if (existing?.id) return existing.id;

  const insertPayload: Record<string, unknown> = {
    full_name: KLIMAKOM_SUPPLIER_NAME,
    phone: "+359 2 943 11 34",
    email: "sofia@climacom.com",
    address: 'София 1517, бул. „Владимир Вазов" № 52',
    notes: "Автоматично създаден при синхронизация от climacom.com",
    contact_kind: "supplier",
  };

  const { data: created, error } = await supabase.from("contacts").insert(insertPayload).select("id").single();
  if (!error && created?.id) return created.id as string;

  if (error && isPostgrestMissingColumn(error, "contact_kind")) {
    const { contact_kind: _ck, ...withoutKind } = insertPayload;
    const retry = await supabase.from("contacts").insert(withoutKind).select("id").single();
    if (!retry.error && retry.data?.id) return retry.data.id as string;
  }

  const again = await findKlimakomContact(supabase);
  return again?.id ?? null;
}
