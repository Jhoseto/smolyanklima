import type { SupabaseClient } from "@supabase/supabase-js";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";

export const BITTEL_SUPPLIER_NAME = "БИТТЕЛ ЕООД";

const NAME_OR_FILTER = "full_name.ilike.%биттел%,full_name.ilike.%bittel%";

type ContactRow = { id: string; full_name?: string | null; contact_kind?: string | null };

function pickBittelContact(rows: ContactRow[]): ContactRow | null {
  if (!rows.length) return null;
  const supplier = rows.find((r) => r.contact_kind === "supplier");
  if (supplier) return supplier;
  const byName = rows.find((r) => /биттел|bittel/i.test(String(r.full_name ?? "")));
  return byName ?? rows[0] ?? null;
}

async function findBittelContact(supabase: SupabaseClient): Promise<ContactRow | null> {
  const withKind = await supabase
    .from("contacts")
    .select("id,full_name,contact_kind")
    .or(NAME_OR_FILTER)
    .order("full_name")
    .limit(20);

  if (!withKind.error && withKind.data?.length) {
    return pickBittelContact(withKind.data as ContactRow[]);
  }

  if (withKind.error && isPostgrestMissingColumn(withKind.error, "contact_kind")) {
    const plain = await supabase.from("contacts").select("id,full_name").or(NAME_OR_FILTER).limit(20);
    if (!plain.error && plain.data?.length) {
      return pickBittelContact(plain.data as ContactRow[]);
    }
  }

  const exact = await supabase
    .from("contacts")
    .select("id,full_name,contact_kind")
    .ilike("full_name", BITTEL_SUPPLIER_NAME)
    .limit(1)
    .maybeSingle();

  if (!exact.error && exact.data?.id) return exact.data as ContactRow;
  return null;
}

async function ensureSupplierKind(supabase: SupabaseClient, contact: ContactRow): Promise<string> {
  if (contact.contact_kind === "supplier") return contact.id;

  const { error } = await supabase.from("contacts").update({ contact_kind: "supplier" }).eq("id", contact.id);
  if (error && !isPostgrestMissingColumn(error, "contact_kind")) {
    console.warn("[bittel] Неуспешно задаване contact_kind=supplier:", error.message);
  }
  return contact.id;
}

export async function ensureBittelSupplierId(supabase: SupabaseClient): Promise<string | null> {
  const existing = await findBittelContact(supabase);
  if (existing?.id) return ensureSupplierKind(supabase, existing);

  const insertPayload: Record<string, unknown> = {
    full_name: BITTEL_SUPPLIER_NAME,
    phone: "0700 10 858",
    email: "office@bittel.bg",
    address: "Пловдив / София / Варна / Бургас",
    notes: "Автоматично създаден при синхронизация от bittel.bg",
    contact_kind: "supplier",
  };

  const { data: created, error } = await supabase.from("contacts").insert(insertPayload).select("id").single();

  if (!error && created?.id) return created.id as string;

  if (error && isPostgrestMissingColumn(error, "contact_kind")) {
    const { contact_kind: _ck, ...withoutKind } = insertPayload;
    const retry = await supabase.from("contacts").insert(withoutKind).select("id").single();
    if (!retry.error && retry.data?.id) return retry.data.id as string;
  }

  const again = await findBittelContact(supabase);
  if (again?.id) return ensureSupplierKind(supabase, again);

  if (error) console.warn("[bittel] Неуспешно създаване на доставчик:", error.message);
  return null;
}
