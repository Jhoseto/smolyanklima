import type { SupabaseClient } from "@supabase/supabase-js";
import { productPricesAsEur } from "@/lib/admin/normalizeLegacyEurAmount";
import { phoneFlexibleIlikePattern } from "@/lib/admin/phoneSearchPattern";

export type ContactLinkedProductRow = {
  id: string;
  kind: "product" | "accessory";
  name: string;
  slug: string | null;
  price: number | null;
  purchase_price: number | null;
  stock_status: string | null;
  purchased_at: string | null;
};

const PRODUCT_FIELDS =
  "id,name,slug,price,purchase_price,stock_status,purchased_at,created_at,amounts_converted_from_bgn_at";

const ACCESSORY_FIELDS = "id,name,slug,price,created_at,amounts_converted_from_bgn_at";

function mapProductRow(
  row: Record<string, unknown>,
  kind: "product" | "accessory",
): ContactLinkedProductRow {
  const prices = productPricesAsEur({
    price: row.price != null ? Number(row.price) : null,
    purchase_price: row.purchase_price != null ? Number(row.purchase_price) : null,
    purchased_at: (row.purchased_at as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    amounts_converted_from_bgn_at: (row.amounts_converted_from_bgn_at as string | null) ?? null,
  });
  return {
    id: String(row.id),
    kind,
    name: String(row.name ?? ""),
    slug: (row.slug as string | null) ?? null,
    price: prices.price,
    purchase_price: prices.purchase_price,
    stock_status: kind === "product" ? ((row.stock_status as string | null) ?? null) : null,
    purchased_at: kind === "product" ? ((row.purchased_at as string | null) ?? null) : null,
  };
}

/** Продукти/аксесоари, обвързани с CRM контакт (клиент или доставчик). */
export async function loadContactLinkedProducts(
  supabase: SupabaseClient,
  contact: { id: string; contact_kind?: string | null; phone?: string | null },
): Promise<ContactLinkedProductRow[]> {
  const contactId = contact.id;
  const isSupplier = contact.contact_kind === "supplier";
  const byId = new Map<string, ContactLinkedProductRow>();

  const addRows = (rows: Record<string, unknown>[], kind: "product" | "accessory") => {
    for (const row of rows) {
      const id = String(row.id ?? "");
      if (!id || byId.has(id)) continue;
      byId.set(id, mapProductRow(row, kind));
    }
  };

  if (isSupplier) {
    const [prodRes, accRes] = await Promise.all([
      supabase.from("products").select(PRODUCT_FIELDS).eq("supplier_id", contactId).order("name").limit(500),
      supabase.from("accessories").select(ACCESSORY_FIELDS).eq("supplier_id", contactId).order("name").limit(500),
    ]);
    if (prodRes.error) throw prodRes.error;
    if (accRes.error) throw accRes.error;
    addRows((prodRes.data ?? []) as Record<string, unknown>[], "product");
    addRows((accRes.data ?? []) as Record<string, unknown>[], "accessory");
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "bg"));
  }

  const phoneRaw = String(contact.phone ?? "").trim();
  const phonePattern = phoneFlexibleIlikePattern(phoneRaw);
  const phoneDigits = phoneRaw.replace(/[^\d+]/g, "");

  const workByContactQ = supabase
    .from("work_items")
    .select("product_id")
    .eq("contact_id", contactId)
    .not("product_id", "is", null)
    .limit(500);

  const workByPhoneQ =
    phoneRaw.length > 0
      ? supabase
          .from("work_items")
          .select("product_id")
          .eq("customer_phone", phoneRaw)
          .not("product_id", "is", null)
          .limit(500)
      : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null });

  const workByDigitsQ =
    phonePattern || phoneDigits.length >= 6
      ? supabase
          .from("work_items")
          .select("product_id")
          .ilike("customer_phone", phonePattern ?? `%${phoneDigits}%`)
          .not("product_id", "is", null)
          .limit(500)
      : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null });

  const [w1, w2, w3] = await Promise.all([workByContactQ, workByPhoneQ, workByDigitsQ]);
  if (w1.error) throw w1.error;
  if (w2.error) throw w2.error;
  if (w3.error) throw w3.error;

  const productIds = [
    ...new Set(
      [...(w1.data ?? []), ...(w2.data ?? []), ...(w3.data ?? [])]
        .map((r) => (r as { product_id?: string | null }).product_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  if (productIds.length > 0) {
    const { data, error } = await supabase.from("products").select(PRODUCT_FIELDS).in("id", productIds);
    if (error) throw error;
    addRows((data ?? []) as Record<string, unknown>[], "product");
  }

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "bg"));
}
