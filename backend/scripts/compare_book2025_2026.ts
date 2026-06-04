/**
 * Сравнява зелените продажби от Book2025 (2026) с work_items в Supabase.
 * Usage: cd backend && npx tsx scripts/compare_book2025_2026.ts
 */
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local", override: true });

const PREVIEW_TSV = path.resolve(
  __dirname,
  "../../../Doc/Book2025_2026_import_preview.tsv",
);
const OUT = path.resolve(__dirname, "../../../Doc/Book2025_2026_compare.txt");

const YEAR_START = "2026-01-01";
const YEAR_END = new Date().toISOString().slice(0, 10);

type ExcelRow = {
  sheet_row: number;
  brand_db: string;
  model: string;
  indoor_serial: string;
  outdoor_serial: string;
  sale_date: string;
  sale_price: string;
  client_name: string;
  client_phone: string;
  warnings: string;
};

function normSerial(s: string): string {
  return s.replace(/\s+/g, "").trim().toUpperCase();
}

function parseTsv(): ExcelRow[] {
  const raw = fs.readFileSync(PREVIEW_TSV, "utf-8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split("\t");
  const idx = (name: string) => header.indexOf(name);
  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    return {
      sheet_row: Number(cols[idx("sheet_row")]),
      brand_db: cols[idx("brand_db")] ?? "",
      model: cols[idx("model")] ?? "",
      indoor_serial: cols[idx("indoor_serial")] ?? "",
      outdoor_serial: cols[idx("outdoor_serial")] ?? "",
      sale_date: cols[idx("sale_date")] ?? "",
      sale_price: cols[idx("sale_price")] ?? "",
      client_name: cols[idx("client_name")] ?? "",
      client_phone: cols[idx("client_phone")] ?? "",
      warnings: cols[idx("warnings")] ?? "",
    };
  });
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const excelRows = parseTsv();

  const { data: sales, error } = await sb
    .from("work_items")
    .select(
      "id, notes, due_date, total_amount, customer_name, customer_phone, product_id, products!work_items_product_id_fkey(indoor_unit_serial, outdoor_unit_serial)",
    )
    .eq("event_code", "sale")
    .gte("due_date", YEAR_START)
    .lte("due_date", YEAR_END);

  if (error) throw error;

  const dbByImportRow = new Map<number, (typeof sales)[0]>();
  const dbBySerial = new Map<string, (typeof sales)[0][]>();

  for (const s of sales ?? []) {
    const m = (s.notes ?? "").match(/Импорт Book2025, ред (\d+)/);
    if (m) dbByImportRow.set(Number(m[1]), s);
    const prod = s.products as { indoor_unit_serial?: string; outdoor_unit_serial?: string } | null;
    for (const ser of [prod?.indoor_unit_serial, prod?.outdoor_unit_serial]) {
      const key = normSerial(ser ?? "");
      if (!key) continue;
      const list = dbBySerial.get(key) ?? [];
      list.push(s);
      dbBySerial.set(key, list);
    }
  }

  const missing: ExcelRow[] = [];
  let matchedImport = 0;
  let matchedSerial = 0;

  for (const row of excelRows) {
    if (dbByImportRow.has(row.sheet_row)) {
      matchedImport++;
      continue;
    }
    let hit = false;
    for (const ser of [row.indoor_serial, row.outdoor_serial]) {
      const key = normSerial(ser);
      if (key && dbBySerial.has(key)) {
        matchedSerial++;
        hit = true;
        break;
      }
    }
    if (!hit) missing.push(row);
  }

  const lines = [
    `Compare Book2025 2026 (${YEAR_START} .. ${YEAR_END})`,
    `Excel rows: ${excelRows.length}`,
    `DB sales in period: ${sales?.length ?? 0}`,
    `DB Book2025 import tags: ${dbByImportRow.size}`,
    `Matched by import note: ${matchedImport}`,
    `Matched by serial only: ${matchedSerial}`,
    `MISSING in DB: ${missing.length}`,
    "",
    ...missing.map(
      (r) =>
        `  row ${r.sheet_row}: ${r.brand_db} ${r.model} | sale=${r.sale_date} ${r.sale_price}€ | ` +
        `in=${r.indoor_serial} out=${r.outdoor_serial} | ${r.client_name} ${r.client_phone} | ${r.warnings}`,
    ),
  ];

  fs.writeFileSync(OUT, lines.join("\n") + "\n", "utf-8");
  console.log(lines.join("\n"));
  console.log(`\nWritten: ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
