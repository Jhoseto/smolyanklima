import type { SupabaseClient } from "@supabase/supabase-js";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";

/** Име на доставчика в контакти — съвпада със seed `0001_supplier_contacts.sql`. */
export const CONDEX_SUPPLIER_NAME = "КОНДЕКС ООД";

const NAME_OR_FILTER = "full_name.ilike.%кондекс%,full_name.ilike.%condex%";

type ContactRow = { id: string; full_name?: string | null; contact_kind?: string | null };

function pickCondexContact(rows: ContactRow[]): ContactRow | null {
  if (!rows.length) return null;
  const supplier = rows.find((r) => r.contact_kind === "supplier");
  if (supplier) return supplier;
  const byName = rows.find((r) => /кондекс|condex/i.test(String(r.full_name ?? "")));
  return byName ?? rows[0] ?? null;
}

async function findCondexContact(supabase: SupabaseClient): Promise<ContactRow | null> {
  const withKind = await supabase
    .from("contacts")
    .select("id,full_name,contact_kind")
    .or(NAME_OR_FILTER)
    .order("full_name")
    .limit(20);

  if (!withKind.error && withKind.data?.length) {
    return pickCondexContact(withKind.data as ContactRow[]);
  }

  if (withKind.error && isPostgrestMissingColumn(withKind.error, "contact_kind")) {
    const plain = await supabase.from("contacts").select("id,full_name").or(NAME_OR_FILTER).limit(20);
    if (!plain.error && plain.data?.length) {
      return pickCondexContact(plain.data as ContactRow[]);
    }
  }

  const exact = await supabase
    .from("contacts")
    .select("id,full_name,contact_kind")
    .ilike("full_name", CONDEX_SUPPLIER_NAME)
    .limit(1)
    .maybeSingle();

  if (!exact.error && exact.data?.id) return exact.data as ContactRow;

  return null;
}

async function ensureSupplierKind(supabase: SupabaseClient, contact: ContactRow): Promise<string> {
  if (contact.contact_kind === "supplier") return contact.id;

  const { error } = await supabase.from("contacts").update({ contact_kind: "supplier" }).eq("id", contact.id);
  if (error && !isPostgrestMissingColumn(error, "contact_kind")) {
    console.warn("[condex] Неуспешно задаване contact_kind=supplier:", error.message);
  }
  return contact.id;
}

export async function ensureCondexSupplierId(supabase: SupabaseClient): Promise<string | null> {
  const existing = await findCondexContact(supabase);
  if (existing?.id) return ensureSupplierKind(supabase, existing);

  const insertPayload: Record<string, unknown> = {
    full_name: CONDEX_SUPPLIER_NAME,
    phone: "+359 2 958 23 96",
    email: "office@condex.bg",
    address: 'София 1407, ул. „Околовръстен път" № 87',
    notes: "Автоматично създаден при синхронизация от condex.bg",
    contact_kind: "supplier",
  };

  const { data: created, error } = await supabase.from("contacts").insert(insertPayload).select("id").single();

  if (!error && created?.id) return created.id as string;

  if (error && isPostgrestMissingColumn(error, "contact_kind")) {
    const { contact_kind: _ck, ...withoutKind } = insertPayload;
    const retry = await supabase.from("contacts").insert(withoutKind).select("id").single();
    if (!retry.error && retry.data?.id) return retry.data.id as string;
  }

  const again = await findCondexContact(supabase);
  if (again?.id) return ensureSupplierKind(supabase, again);

  if (error) console.warn("[condex] Неуспешно създаване на доставчик:", error.message);
  return null;
}
