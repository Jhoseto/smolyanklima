import type { SupabaseClient } from "@supabase/supabase-js";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";

/** Име на доставчика в контакти — съвпада със seed `0001_supplier_contacts.sql`. */
export const BULCLIMA_SUPPLIER_NAME = "БУЛКЛИМА ЕООД";

const NAME_OR_FILTER =
  "full_name.ilike.%булклима%,full_name.ilike.%bulclima%,full_name.ilike.%булкима%";

type ContactRow = { id: string; full_name?: string | null; contact_kind?: string | null };

function pickBulclimaContact(rows: ContactRow[]): ContactRow | null {
  if (!rows.length) return null;
  const supplier = rows.find((r) => r.contact_kind === "supplier");
  if (supplier) return supplier;
  const byName = rows.find((r) => /булклима|bulclima|булкима/i.test(String(r.full_name ?? "")));
  return byName ?? rows[0] ?? null;
}

async function findBulclimaContact(supabase: SupabaseClient): Promise<ContactRow | null> {
  const withKind = await supabase
    .from("contacts")
    .select("id,full_name,contact_kind")
    .or(NAME_OR_FILTER)
    .order("full_name")
    .limit(20);

  if (!withKind.error && withKind.data?.length) {
    return pickBulclimaContact(withKind.data as ContactRow[]);
  }

  if (withKind.error && isPostgrestMissingColumn(withKind.error, "contact_kind")) {
    const plain = await supabase.from("contacts").select("id,full_name").or(NAME_OR_FILTER).limit(20);
    if (!plain.error && plain.data?.length) {
      return pickBulclimaContact(plain.data as ContactRow[]);
    }
  }

  const exact = await supabase
    .from("contacts")
    .select("id,full_name,contact_kind")
    .ilike("full_name", BULCLIMA_SUPPLIER_NAME)
    .limit(1)
    .maybeSingle();

  if (!exact.error && exact.data?.id) return exact.data as ContactRow;

  return null;
}

async function ensureSupplierKind(supabase: SupabaseClient, contact: ContactRow): Promise<string> {
  if (contact.contact_kind === "supplier") return contact.id;

  const { error } = await supabase.from("contacts").update({ contact_kind: "supplier" }).eq("id", contact.id);
  if (error && !isPostgrestMissingColumn(error, "contact_kind")) {
    console.warn("[bulclima] Неуспешно задаване contact_kind=supplier:", error.message);
  }
  return contact.id;
}

/**
 * Намира или създава контакт „доставчик“ за Bulclima (синхронизация на каталог).
 */
export async function ensureBulclimaSupplierId(supabase: SupabaseClient): Promise<string | null> {
  const existing = await findBulclimaContact(supabase);
  if (existing?.id) return ensureSupplierKind(supabase, existing);

  const insertPayload: Record<string, unknown> = {
    full_name: BULCLIMA_SUPPLIER_NAME,
    phone: "0700 20 223",
    email: "office@bulclima.com",
    address: 'София, кв. Лозенец, бул. „Св. Наум" № 66',
    notes: "Автоматично създаден при синхронизация от bulclima.com",
    contact_kind: "supplier",
  };

  const { data: created, error } = await supabase.from("contacts").insert(insertPayload).select("id").single();

  if (!error && created?.id) return created.id as string;

  if (error && isPostgrestMissingColumn(error, "contact_kind")) {
    const { contact_kind: _ck, ...withoutKind } = insertPayload;
    const retry = await supabase.from("contacts").insert(withoutKind).select("id").single();
    if (!retry.error && retry.data?.id) return retry.data.id as string;
  }

  const again = await findBulclimaContact(supabase);
  if (again?.id) return ensureSupplierKind(supabase, again);

  if (error) console.warn("[bulclima] Неуспешно създаване на доставчик:", error.message);
  return null;
}
