import type { SupabaseClient } from "@supabase/supabase-js";
import { productPricesAsEur } from "@/lib/admin/normalizeLegacyEurAmount";
import { phoneFlexibleIlikePattern } from "@/lib/admin/phoneSearchPattern";
import { isOnOrderCatalogTemplate } from "@/lib/admin/createProductInstanceFromTemplate";

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
  "id,name,slug,price,purchase_price,stock_status,purchased_at,created_at,amounts_converted_from_bgn_at,supplier_order_work_item_id";

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

type WorkItemProductLink = {
  id: string;
  event_code: string | null;
  status: string | null;
  product_id: string | null;
};

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

  const workSelect = "id,event_code,status,product_id";

  const workByContactQ = supabase
    .from("work_items")
    .select(workSelect)
    .eq("contact_id", contactId)
    .not("product_id", "is", null)
    .limit(500);

  const workByPhoneQ =
    phoneRaw.length > 0
      ? supabase
          .from("work_items")
          .select(workSelect)
          .eq("customer_phone", phoneRaw)
          .not("product_id", "is", null)
          .limit(500)
      : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null });

  const workByDigitsQ =
    phonePattern || phoneDigits.length >= 6
      ? supabase
          .from("work_items")
          .select(workSelect)
          .ilike("customer_phone", phonePattern ?? `%${phoneDigits}%`)
          .not("product_id", "is", null)
          .limit(500)
      : Promise.resolve({ data: [], error: null } as { data: unknown[]; error: null });

  const [w1, w2, w3] = await Promise.all([workByContactQ, workByPhoneQ, workByDigitsQ]);
  if (w1.error) throw w1.error;
  if (w2.error) throw w2.error;
  if (w3.error) throw w3.error;

  const workLinks = [...(w1.data ?? []), ...(w2.data ?? []), ...(w3.data ?? [])] as WorkItemProductLink[];
  const workById = new Map<string, WorkItemProductLink>();
  for (const row of workLinks) {
    if (row?.id) workById.set(row.id, row);
  }
  const uniqueWork = [...workById.values()];

  const supplierOrderIds = uniqueWork
    .filter((w) => w.event_code === "supplier_order")
    .map((w) => w.id);

  const deliveredByOrderId = new Map<string, string>();
  if (supplierOrderIds.length > 0) {
    const { data: deliveredRows, error: deliveredErr } = await supabase
      .from("products")
      .select("id,supplier_order_work_item_id")
      .in("supplier_order_work_item_id", supplierOrderIds);
    if (deliveredErr) throw deliveredErr;
    for (const row of deliveredRows ?? []) {
      const orderId = (row as { supplier_order_work_item_id?: string | null }).supplier_order_work_item_id;
      const productId = (row as { id?: string }).id;
      if (orderId && productId) deliveredByOrderId.set(orderId, productId);
    }
  }

  const productIds = new Set<string>();
  for (const wi of uniqueWork) {
    if (!wi.product_id) continue;

    if (wi.event_code === "supplier_order") {
      // Каталогният шаблон (on_order) не е реална бройка на клиента — само доставената инстанция.
      const deliveredId = deliveredByOrderId.get(wi.id);
      if (deliveredId) {
        productIds.add(deliveredId);
      }
      continue;
    }

    productIds.add(wi.product_id);
  }

  if (productIds.size === 0) {
    return [];
  }

  const { data, error } = await supabase.from("products").select(PRODUCT_FIELDS).in("id", [...productIds]);
  if (error) throw error;

  const rows = ((data ?? []) as Record<string, unknown>[]).filter(
    (row) => !isOnOrderCatalogTemplate(row as { stock_status?: string | null; supplier_order_work_item_id?: string | null }),
  );
  addRows(rows, "product");

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name, "bg"));
}
