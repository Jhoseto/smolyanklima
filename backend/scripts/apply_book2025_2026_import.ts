/**
 * Вмъква липсващите продажби от Book2025 (2026) в Supabase.
 * Usage: cd backend && npx tsx scripts/apply_book2025_2026_import.ts
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { book2025ImportNote, canonicalBook2025Supplier } from "@/lib/admin/book2025Supplier";

dotenv.config({ path: ".env.local", override: true });

const PREVIEW_TSV = path.resolve(__dirname, "../../../Doc/Book2025_2026_import_preview.tsv");
const COMPARE_TXT = path.resolve(__dirname, "../../../Doc/Book2025_2026_compare.txt");

type Row = {
  sheet_row: number;
  brand_db: string;
  model: string;
  indoor_serial: string;
  outdoor_serial: string;
  purchase_date: string;
  purchase_price: string;
  supplier: string;
  purchase_invoice: string;
  sale_date: string;
  sale_price: string;
  client_name: string;
  client_phone: string;
  client_address: string;
};

function normSerial(s: string): string {
  return s.replace(/\s+/g, "").trim().toUpperCase();
}

function parseTsv(): Row[] {
  const raw = fs.readFileSync(PREVIEW_TSV, "utf-8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split("\t");
  const idx = (name: string) => header.indexOf(name);
  return lines.slice(1).map((line) => {
    const c = line.split("\t");
    return {
      sheet_row: Number(c[idx("sheet_row")]),
      brand_db: c[idx("brand_db")] ?? "",
      model: c[idx("model")] ?? "",
      indoor_serial: c[idx("indoor_serial")] ?? "",
      outdoor_serial: c[idx("outdoor_serial")] ?? "",
      purchase_date: c[idx("purchase_date")] ?? "",
      purchase_price: c[idx("purchase_price")] ?? "",
      supplier: c[idx("supplier")] ?? "",
      purchase_invoice: c[idx("purchase_invoice")] ?? "",
      sale_date: c[idx("sale_date")] ?? "",
      sale_price: c[idx("sale_price")] ?? "",
      client_name: c[idx("client_name")] ?? "",
      client_phone: c[idx("client_phone")] ?? "",
      client_address: c[idx("client_address")] ?? "",
    };
  });
}

function loadMissingIds(): Set<number> {
  const ids = new Set<number>();
  for (const line of fs.readFileSync(COMPARE_TXT, "utf-8").split(/\r?\n/)) {
    const m = line.match(/^\s+row (\d+):/);
    if (m) ids.add(Number(m[1]));
  }
  return ids;
}

async function ensureBrand(sb: SupabaseClient, name: string): Promise<string | null> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { data: existing } = await sb.from("brands").select("id").eq("name", name).maybeSingle();
  if (existing?.id) return existing.id;
  const { data: created, error } = await sb
    .from("brands")
    .upsert({ slug, name, color: "#64748B", is_active: true }, { onConflict: "slug" })
    .select("id")
    .single();
  if (error) {
    console.error("brand", name, error.message);
    return null;
  }
  return created.id;
}

async function findOrCreateContact(
  sb: SupabaseClient,
  name: string,
  phone: string | null,
  address: string,
): Promise<string | null> {
  if (phone && phone.length >= 3) {
    const { data } = await sb
      .from("contacts")
      .select("id")
      .eq("phone", phone)
      .eq("contact_kind", "client")
      .maybeSingle();
    if (data?.id) return data.id;
  }
  const { data: byName } = await sb
    .from("contacts")
    .select("id")
    .eq("contact_kind", "client")
    .ilike("full_name", name.trim())
    .limit(1)
    .maybeSingle();
  if (byName?.id) return byName.id;

  const { data: created, error } = await sb
    .from("contacts")
    .insert({
      full_name: name.trim() || "—",
      phone: phone || null,
      address: address || null,
      contact_kind: "client",
      customer_status: "active",
    })
    .select("id")
    .single();
  if (error) {
    console.error("contact", name, error.message);
    return null;
  }
  if (phone && created.id) {
    await sb.from("contact_phones").upsert(
      { contact_id: created.id, phone, is_primary: true, sort_order: 0 },
      { onConflict: "contact_id,phone", ignoreDuplicates: true },
    );
  }
  return created.id;
}

async function saleExists(sb: SupabaseClient, row: Row): Promise<boolean> {
  const note = book2025ImportNote(row.sheet_row);
  const { data: byNote } = await sb
    .from("work_items")
    .select("id")
    .eq("event_code", "sale")
    .ilike("notes", `${note}%`)
    .maybeSingle();
  if (byNote?.id) return true;

  for (const ser of [row.indoor_serial, row.outdoor_serial]) {
    const key = normSerial(ser);
    if (!key) continue;
    const col = ser === row.indoor_serial ? "indoor_unit_serial" : "outdoor_unit_serial";
    const { data: prod } = await sb
      .from("products")
      .select("id")
      .ilike(col, key)
      .limit(1)
      .maybeSingle();
    if (!prod?.id) continue;
    const { data: sale } = await sb
      .from("work_items")
      .select("id")
      .eq("event_code", "sale")
      .eq("product_id", prod.id)
      .maybeSingle();
    if (sale?.id) return true;
  }
  return false;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const missingIds = loadMissingIds();
  const rows = parseTsv().filter((r) => missingIds.has(r.sheet_row) && r.brand_db);

  const { data: typeRow } = await sb.from("product_types").select("id").order("name").limit(1).single();
  if (!typeRow?.id) throw new Error("No product_types");

  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    if (await saleExists(sb, row)) {
      skipped++;
      console.log(`skip row ${row.sheet_row} (exists)`);
      continue;
    }

    const brandId = await ensureBrand(sb, row.brand_db);
    if (!brandId) continue;

    const contactId = await findOrCreateContact(
      sb,
      row.client_name,
      row.client_phone || null,
      row.client_address,
    );

    const saleDate = row.sale_date || row.purchase_date;
    if (!saleDate) {
      console.warn(`skip row ${row.sheet_row}: no sale date`);
      continue;
    }

    const slug = `book2025-row-${row.sheet_row}`;
    const name = `${row.brand_db} ${row.model || "климатик"}`.trim();
    const salePrice = parseFloat(row.sale_price) || 0;
    const purchasePrice = row.purchase_price ? parseFloat(row.purchase_price) : null;
    const supplierName = canonicalBook2025Supplier(row.supplier);
    const purchaseInvoice = row.purchase_invoice?.trim() || null;

    const { data: product, error: pErr } = await sb
      .from("products")
      .insert({
        slug,
        name,
        brand_id: brandId,
        type_id: typeRow.id,
        model_code: row.model || null,
        price: salePrice,
        purchase_price: purchasePrice,
        indoor_unit_serial: row.indoor_serial || null,
        outdoor_unit_serial: row.outdoor_serial || null,
        supplier_invoice_number: purchaseInvoice,
        purchased_at: row.purchase_date || null,
        product_condition: "new",
        stock_status: "out_of_stock",
        stock_quantity: 0,
        sold_quantity: 1,
        is_active: false,
        show_in_public_catalog: false,
      })
      .select("id")
      .single();

    if (pErr) {
      console.error(`row ${row.sheet_row} product:`, pErr.message);
      continue;
    }

    const completedAt = `${saleDate}T12:00:00+02:00`;
    const { error: wErr } = await sb.from("work_items").insert({
      type: "sale",
      event_code: "sale",
      status: "done",
      priority: "medium",
      title: `Продажба: ${name}`,
      notes: book2025ImportNote(row.sheet_row),
      due_date: saleDate,
      completed_at: completedAt,
      product_id: product.id,
      contact_id: contactId,
      customer_name: row.client_name,
      customer_phone: row.client_phone || null,
      customer_address: row.client_address || null,
      quantity: 1,
      unit_price: salePrice,
      total_amount: salePrice,
      purchase_price: purchasePrice,
      supplier_name: supplierName,
      supplier_invoice_number: purchaseInvoice,
      sale_install_state: "completed",
      sale_product_condition: "new",
    });

    if (wErr) {
      console.error(`row ${row.sheet_row} sale:`, wErr.message);
      await sb.from("products").delete().eq("id", product.id);
      continue;
    }

    imported++;
    console.log(`imported row ${row.sheet_row}: ${name}`);
  }

  console.log(`\nDone: imported=${imported}, skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
