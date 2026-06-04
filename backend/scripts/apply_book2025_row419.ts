/** Еднократен импорт на ред 419 (Алпин колона, без сериен). */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { book2025ImportNote, canonicalBook2025Supplier } from "@/lib/admin/book2025Supplier";

dotenv.config({ path: ".env.local", override: true });

async function main() {
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  const note = book2025ImportNote(419);
  const supplierName = canonicalBook2025Supplier("ДИМЕЛИ");
  const purchaseInvoice = "4651";
  const { data: exists } = await sb
    .from("work_items")
    .select("id")
    .eq("event_code", "sale")
    .ilike("notes", `${note}%`)
    .maybeSingle();
  if (exists?.id) {
    console.log("Already imported");
    return;
  }

  const { data: brand } = await sb
    .from("brands")
    .upsert({ slug: "alpin", name: "Alpin", color: "#64748B", is_active: true }, { onConflict: "slug" })
    .select("id")
    .single();
  const { data: typeRow } = await sb.from("product_types").select("id").limit(1).single();

  let contactId: string;
  const { data: existingContact } = await sb
    .from("contacts")
    .select("id")
    .eq("phone", "0878 143 221")
    .eq("contact_kind", "client")
    .maybeSingle();
  if (existingContact?.id) {
    contactId = existingContact.id;
  } else {
    const { data: contact, error: cErr } = await sb
      .from("contacts")
      .insert({
        full_name: "Здравко Мирчев БАНИТЕ",
        phone: "0878 143 221",
        contact_kind: "client",
        customer_status: "active",
      })
      .select("id")
      .single();
    if (cErr || !contact?.id) throw cErr ?? new Error("contact insert failed");
    contactId = contact.id;
  }

  const saleDate = "2026-03-23";
  const name = "Alpin 48 КОЛОНА";
  let productId: string;
  const { data: existingProd } = await sb
    .from("products")
    .select("id")
    .eq("slug", "book2025-row-419")
    .maybeSingle();
  if (existingProd?.id) {
    productId = existingProd.id;
  } else {
    const { data: product, error: pErr } = await sb
      .from("products")
      .insert({
        slug: "book2025-row-419",
        name,
        brand_id: brand!.id,
        type_id: typeRow!.id,
        price: 2710,
        purchase_price: 1876,
        purchased_at: saleDate,
        supplier_invoice_number: purchaseInvoice,
        product_condition: "new",
        stock_status: "out_of_stock",
        stock_quantity: 0,
        sold_quantity: 1,
        is_active: false,
        show_in_public_catalog: false,
      })
      .select("id")
      .single();
    if (pErr || !product?.id) throw pErr ?? new Error(`product: ${pErr?.message}`);
    productId = product.id;
  }

  await sb.from("work_items").insert({
    type: "sale",
    event_code: "sale",
    status: "done",
    priority: "medium",
    title: `Продажба: ${name}`,
    notes: note,
    due_date: saleDate,
    completed_at: `${saleDate}T12:00:00+02:00`,
    product_id: productId,
    contact_id: contactId,
    customer_name: "Здравко Мирчев БАНИТЕ",
    customer_phone: "0878 143 221",
    quantity: 1,
    unit_price: 2710,
    total_amount: 2710,
    purchase_price: 1876,
    supplier_name: supplierName,
    supplier_invoice_number: purchaseInvoice,
    sale_install_state: "completed",
    sale_product_condition: "new",
  });

  console.log("Imported row 419");
}

main().catch(console.error);
