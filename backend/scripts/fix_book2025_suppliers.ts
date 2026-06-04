/**
 * Попълва supplier_name / supplier_invoice_number за продажби „Импорт Book2025, ред N“.
 * Usage: cd backend && npx tsx scripts/fix_book2025_suppliers.ts
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  book2025ImportNote,
  canonicalBook2025Supplier,
} from "@/lib/admin/book2025Supplier";

dotenv.config({ path: ".env.local", override: true });

type ExcelRow = {
  row: number;
  supplier: string;
  invoice: string;
};

function loadRowsFromExcel(): ExcelRow[] {
  const script = path.resolve(__dirname, "import_book2025_sales.py");
  const pyBin = process.platform === "win32" ? "python" : "python3";
  const py = spawnSync(
    pyBin,
    [
      "-c",
      `
import json, sys
sys.path.insert(0, ${JSON.stringify(path.resolve(__dirname))})
from import_book2025_sales import parse_workbook_2026
rows, _, _ = parse_workbook_2026()
out = [{"row": r.sheet_row, "supplier": r.supplier or "", "invoice": r.purchase_invoice or ""} for r in rows]
print(json.dumps(out, ensure_ascii=False))
`,
    ],
    {
      encoding: "utf-8",
      cwd: path.resolve(__dirname, "../.."),
      env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" },
    },
  );
  if (py.status !== 0) {
    throw new Error(py.stderr || py.stdout || "Python export failed");
  }
  const parsed = JSON.parse(py.stdout.trim()) as ExcelRow[];
  return parsed.filter((r) => r.row > 0);
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE env");

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const excelRows = loadRowsFromExcel();
  let updated = 0;
  let missing = 0;
  let skipped = 0;

  for (const row of excelRows) {
    const supplierName = canonicalBook2025Supplier(row.supplier);
    const invoice = row.invoice?.trim() || null;
    const note = book2025ImportNote(row.row);

    const { data: sales, error } = await sb
      .from("work_items")
      .select("id, product_id, supplier_name, supplier_invoice_number")
      .eq("event_code", "sale")
      .ilike("notes", `${note}%`);

    if (error) {
      console.error(`row ${row.row}:`, error.message);
      continue;
    }
    if (!sales?.length) {
      missing++;
      continue;
    }

    for (const sale of sales) {
      const needsSupplier =
        supplierName && (sale.supplier_name ?? "").trim() !== supplierName;
      const needsInvoice =
        invoice && (sale.supplier_invoice_number ?? "").trim() !== invoice;
      if (!needsSupplier && !needsInvoice) {
        skipped++;
        continue;
      }

      const patch: Record<string, string | null> = {};
      if (needsSupplier) patch.supplier_name = supplierName;
      if (needsInvoice) patch.supplier_invoice_number = invoice;

      const { error: uErr } = await sb.from("work_items").update(patch).eq("id", sale.id);
      if (uErr) {
        console.error(`row ${row.row} sale ${sale.id}:`, uErr.message);
        continue;
      }

      if (sale.product_id && invoice) {
        await sb
          .from("products")
          .update({ supplier_invoice_number: invoice })
          .eq("id", sale.product_id);
      }

      updated++;
      console.log(
        `row ${row.row}: ${supplierName ?? "—"} / ф-ра ${invoice ?? "—"} → sale ${sale.id.slice(0, 8)}…`,
      );
    }
  }

  console.log(`\nDone: updated=${updated}, unchanged=${skipped}, no_sale_in_db=${missing}, excel_rows=${excelRows.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
