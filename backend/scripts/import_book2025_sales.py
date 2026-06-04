#!/usr/bin/env python3
"""
Импорт на продажби от Book2025.xls (зелени редове) за 2026 г. до днес.

Използване:
  python backend/scripts/import_book2025_sales.py --preview
  python backend/scripts/import_book2025_sales.py --compare
  python backend/scripts/import_book2025_sales.py --sql
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from collections import Counter
from datetime import date
from pathlib import Path

# Reuse parsers from Book2023 importer
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from import_book2023_sales import (  # noqa: E402
    BRAND_RULES,
    ParsedRow,
    cell_str,
    is_green_row,
    map_brand,
    parse_customer_text,
    parse_date,
    parse_price,
    sql_escape,
    write_preview,
)

import xlrd

ROOT = Path(__file__).resolve().parents[2]
XLS_PATH = Path(r"H:\Apps\SmolyanKlima\Doc\Book2025.xls")
PREVIEW_TSV = ROOT.parent / "Doc" / "Book2025_2026_import_preview.tsv"
WARNINGS_TXT = ROOT.parent / "Doc" / "Book2025_2026_import_warnings.txt"
COMPARE_TXT = ROOT.parent / "Doc" / "Book2025_2026_compare.txt"
OUT_SQL = ROOT / "backend" / "supabase" / "seeds" / "0084_book2025_2026_sales.sql"

YEAR_START = date(2026, 1, 1)
YEAR_END = date.today()


def parse_workbook_2026() -> tuple[list[ParsedRow], Counter, list[ParsedRow]]:
    book = xlrd.open_workbook(str(XLS_PATH), formatting_info=True)
    sheet = book.sheet_by_index(0)
    all_green: list[ParsedRow] = []
    rows_2026: list[ParsedRow] = []
    brand_stats: Counter = Counter()

    for r in range(1, sheet.nrows):
        if not is_green_row(book, sheet, r):
            continue

        brand_raw = cell_str(sheet, r, 0)
        brand_db = map_brand(brand_raw)
        model = cell_str(sheet, r, 1)
        indoor = cell_str(sheet, r, 2)
        outdoor = cell_str(sheet, r, 3)
        purchase_date = parse_date(sheet.cell_value(r, 4), book)
        supplier = cell_str(sheet, r, 5)
        purchase_invoice = cell_str(sheet, r, 6)
        purchase_price = parse_price(sheet.cell_value(r, 7))
        sale_date = parse_date(sheet.cell_value(r, 8), book)
        client_raw = cell_str(sheet, r, 9)
        sale_invoice = cell_str(sheet, r, 10)
        sale_price = parse_price(sheet.cell_value(r, 11))

        client_name, client_phone, client_address = parse_customer_text(client_raw)
        warnings: list[str] = []

        if not brand_db:
            warnings.append(f"unmapped_brand:{brand_raw}")
        if not indoor and not outdoor:
            warnings.append("missing_serial")
        if sale_price is None:
            warnings.append("missing_sale_price")
        if purchase_price is None:
            warnings.append("missing_purchase_price")
        if sale_date is None:
            warnings.append("missing_sale_date")
        if not client_name:
            warnings.append("missing_client_name")

        brand_stats[brand_raw or "(empty)"] += 1
        row = ParsedRow(
            sheet_row=r + 1,
            brand_raw=brand_raw,
            brand_db=brand_db,
            model=model,
            indoor_serial=indoor,
            outdoor_serial=outdoor,
            purchase_date=purchase_date,
            supplier=supplier,
            purchase_invoice=purchase_invoice,
            purchase_price=purchase_price,
            sale_date=sale_date,
            client_raw=client_raw,
            client_name=client_name,
            client_phone=client_phone,
            client_address=client_address,
            sale_invoice=sale_invoice,
            sale_price=sale_price,
            warnings=warnings,
        )
        all_green.append(row)

        effective = sale_date or purchase_date
        if effective:
            try:
                d = date.fromisoformat(effective)
                if YEAR_START <= d <= YEAR_END:
                    rows_2026.append(row)
            except ValueError:
                warnings.append("bad_date")

    return rows_2026, brand_stats, all_green


def write_preview_2026(rows: list[ParsedRow], brand_stats: Counter) -> None:
    PREVIEW_TSV.parent.mkdir(parents=True, exist_ok=True)
    with PREVIEW_TSV.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow([
            "sheet_row", "brand_raw", "brand_db", "model", "indoor_serial", "outdoor_serial",
            "purchase_date", "supplier", "purchase_invoice", "purchase_price",
            "sale_date", "sale_price",
            "client_name", "client_phone", "client_address", "warnings",
        ])
        for row in rows:
            w.writerow([
                row.sheet_row, row.brand_raw, row.brand_db or "", row.model,
                row.indoor_serial, row.outdoor_serial,
                row.purchase_date or "", row.supplier or "", row.purchase_invoice or "",
                row.purchase_price if row.purchase_price is not None else "",
                row.sale_date or "", row.sale_price if row.sale_price is not None else "",
                row.client_name, row.client_phone or "", row.client_address,
                ";".join(row.warnings),
            ])

    warn_counter = Counter()
    for row in rows:
        for w in row.warnings:
            warn_counter[w.split(":", 1)[0]] += 1

    lines = [
        f"Source: {XLS_PATH}",
        f"Period: {YEAR_START.isoformat()} .. {YEAR_END.isoformat()}",
        f"Green rows in period: {len(rows)}",
        "",
        "Warnings:",
    ]
    for key, count in warn_counter.most_common():
        lines.append(f"  {key}: {count}")
    lines.extend(["", "Brand distribution (raw):"])
    for brand, count in brand_stats.most_common():
        mapped = map_brand(brand)
        lines.append(f"  {brand}: {count} -> {mapped or 'UNMAPPED'}")

    WARNINGS_TXT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Preview TSV: {PREVIEW_TSV}")
    print(f"Warnings:    {WARNINGS_TXT}")
    print(f"Rows 2026: {len(rows)}")


def sql_lit(value, pg_type: str) -> str:
    if value is None:
        return f"NULL::{pg_type}"
    if pg_type == "int":
        return str(int(value))
    if pg_type == "numeric(10,2)":
        return f"{float(value)}::numeric(10,2)"
    if pg_type == "date":
        return f"{sql_escape(value)}::date"
    return sql_escape(value)


def write_sql(rows: list[ParsedRow]) -> None:
    OUT_SQL.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = []
    lines.append("-- =====================================================================")
    lines.append("-- Seed: Продажби от Book2025.xls (зелени редове, 2026 г.)")
    lines.append("-- =====================================================================")
    lines.append(f"-- Редове: {len(rows)} | период {YEAR_START} .. {YEAR_END}")
    lines.append("-- Идемпотентност: пропуска по notes „Импорт Book2025, ред N“ или съществуващ сериен")
    lines.append("-- =====================================================================")
    lines.append("")
    lines.append("DO $import$")
    lines.append("DECLARE")
    lines.append("  r RECORD;")
    lines.append("  v_brand_id uuid;")
    lines.append("  v_type_id uuid;")
    lines.append("  v_contact_id uuid;")
    lines.append("  v_product_id uuid;")
    lines.append("  v_sale_id uuid;")
    lines.append("  v_slug text;")
    lines.append("  v_name text;")
    lines.append("  v_imported int := 0;")
    lines.append("  v_skipped int := 0;")
    lines.append("BEGIN")
    lines.append("  IF NOT EXISTS (")
    lines.append("    SELECT 1 FROM information_schema.columns")
    lines.append("    WHERE table_schema = 'public' AND table_name = 'work_items'")
    lines.append("      AND column_name = 'supplier_invoice_number'")
    lines.append("  ) THEN")
    lines.append("    RAISE EXCEPTION 'Seed 0084 изисква миграция 0076_work_items_supplier_fields.';")
    lines.append("  END IF;")
    lines.append("")
    lines.append("  INSERT INTO public.brands (slug, name, color, is_active)")
    lines.append("  VALUES")
    lines.append("    ('alpin', 'Alpin', '#64748B', true),")
    lines.append("    ('inventor', 'Inventor', '#64748B', true)")
    lines.append("  ON CONFLICT (slug) DO UPDATE SET name = excluded.name, is_active = excluded.is_active;")
    lines.append("")
    lines.append("  SELECT id INTO v_type_id FROM public.product_types ORDER BY name LIMIT 1;")
    lines.append("  IF v_type_id IS NULL THEN")
    lines.append("    RAISE EXCEPTION 'Липсва product_types seed.';")
    lines.append("  END IF;")
    lines.append("")
    lines.append("  FOR r IN")
    lines.append("    SELECT *")
    lines.append("    FROM (")
    lines.append("      VALUES")

    value_lines: list[str] = []
    for row in rows:
        if not row.brand_db:
            continue
        serial_key = row.indoor_serial or row.outdoor_serial or f"row-{row.sheet_row}"
        value_lines.append(
            "        ("
            + ", ".join([
                sql_lit(row.sheet_row, "int"),
                sql_lit(row.brand_db, "text"),
                sql_lit(row.model or serial_key, "text"),
                sql_lit(row.indoor_serial or None, "text"),
                sql_lit(row.outdoor_serial or None, "text"),
                sql_lit(row.purchase_date, "date"),
                sql_lit(row.supplier or None, "text"),
                sql_lit(row.purchase_invoice or None, "text"),
                sql_lit(row.purchase_price, "numeric(10,2)"),
                sql_lit(row.sale_date, "date"),
                sql_lit(row.client_name or "—", "text"),
                sql_lit(row.client_phone, "text"),
                sql_lit(row.client_address or None, "text"),
                sql_lit(row.sale_invoice or None, "text"),
                sql_lit(row.sale_price if row.sale_price is not None else 0, "numeric(10,2)"),
            ])
            + ")"
        )

    lines.append(",\n".join(value_lines))
    lines.append("    ) AS stage(")
    lines.append("      sheet_row, brand_name, model, indoor_serial, outdoor_serial,")
    lines.append("      purchase_date, supplier, purchase_invoice, purchase_price,")
    lines.append("      sale_date, client_name, client_phone, client_address,")
    lines.append("      sale_invoice, sale_price")
    lines.append("    )")
    lines.append("    ORDER BY sheet_row")
    lines.append("  LOOP")
    lines.append("    v_product_id := NULL;")
    lines.append("    v_contact_id := NULL;")
    lines.append("    v_slug := 'book2025-row-' || r.sheet_row;")
    lines.append("")
    lines.append("    IF EXISTS (")
    lines.append("      SELECT 1 FROM public.work_items")
    lines.append("      WHERE event_code = 'sale'")
    lines.append("        AND notes LIKE 'Импорт Book2025, ред ' || r.sheet_row || '%'")
    lines.append("    ) THEN")
    lines.append("      v_skipped := v_skipped + 1;")
    lines.append("      CONTINUE;")
    lines.append("    END IF;")
    lines.append("    IF EXISTS (")
    lines.append("      SELECT 1 FROM public.products")
    lines.append("      WHERE slug = v_slug OR slug LIKE 'book2025-' || r.sheet_row || '-%'")
    lines.append("    ) THEN")
    lines.append("      v_skipped := v_skipped + 1;")
    lines.append("      CONTINUE;")
    lines.append("    END IF;")
    lines.append("")
    lines.append("    IF r.indoor_serial IS NOT NULL AND btrim(r.indoor_serial) <> '' THEN")
    lines.append("      SELECT p.id INTO v_product_id FROM public.products p")
    lines.append("      JOIN public.work_items w ON w.product_id = p.id AND w.event_code = 'sale'")
    lines.append("      WHERE upper(btrim(p.indoor_unit_serial)) = upper(btrim(r.indoor_serial))")
    lines.append("      LIMIT 1;")
    lines.append("    END IF;")
    lines.append("    IF v_product_id IS NULL AND r.outdoor_serial IS NOT NULL AND btrim(r.outdoor_serial) <> '' THEN")
    lines.append("      SELECT p.id INTO v_product_id FROM public.products p")
    lines.append("      JOIN public.work_items w ON w.product_id = p.id AND w.event_code = 'sale'")
    lines.append("      WHERE upper(btrim(p.outdoor_unit_serial)) = upper(btrim(r.outdoor_serial))")
    lines.append("      LIMIT 1;")
    lines.append("    END IF;")
    lines.append("    IF v_product_id IS NOT NULL THEN")
    lines.append("      v_skipped := v_skipped + 1;")
    lines.append("      CONTINUE;")
    lines.append("    END IF;")
    lines.append("")
    lines.append("    SELECT id INTO v_brand_id FROM public.brands WHERE name = r.brand_name LIMIT 1;")
    lines.append("    IF v_brand_id IS NULL THEN")
    lines.append("      RAISE WARNING 'Book2025 row %: липсва марка %', r.sheet_row, r.brand_name;")
    lines.append("      CONTINUE;")
    lines.append("    END IF;")
    lines.append("")
    lines.append("    IF r.client_phone IS NOT NULL AND length(btrim(r.client_phone)) >= 3 THEN")
    lines.append("      SELECT id INTO v_contact_id FROM public.contacts")
    lines.append("      WHERE phone = r.client_phone AND contact_kind = 'client' LIMIT 1;")
    lines.append("    END IF;")
    lines.append("    IF v_contact_id IS NULL THEN")
    lines.append("      SELECT id INTO v_contact_id FROM public.contacts")
    lines.append("      WHERE upper(btrim(full_name)) = upper(btrim(r.client_name))")
    lines.append("        AND contact_kind = 'client'")
    lines.append("        AND (r.client_phone IS NULL OR phone IS NULL OR phone = r.client_phone)")
    lines.append("      LIMIT 1;")
    lines.append("    END IF;")
    lines.append("    IF v_contact_id IS NULL THEN")
    lines.append("      INSERT INTO public.contacts (full_name, phone, address, contact_kind, customer_status)")
    lines.append("      VALUES (r.client_name, r.client_phone, r.client_address, 'client', 'active')")
    lines.append("      RETURNING id INTO v_contact_id;")
    lines.append("      IF r.client_phone IS NOT NULL AND length(btrim(r.client_phone)) >= 3 THEN")
    lines.append("        INSERT INTO public.contact_phones (contact_id, phone, is_primary, sort_order)")
    lines.append("        VALUES (v_contact_id, r.client_phone, true, 0) ON CONFLICT DO NOTHING;")
    lines.append("      END IF;")
    lines.append("    END IF;")
    lines.append("")
    lines.append("    v_name := r.brand_name || ' ' || coalesce(nullif(btrim(r.model), ''), 'климатик');")
    lines.append("")
    lines.append("    INSERT INTO public.products (")
    lines.append("      slug, name, brand_id, type_id, model_code, price, purchase_price,")
    lines.append("      indoor_unit_serial, outdoor_unit_serial, supplier_invoice_number, purchased_at,")
    lines.append("      product_condition, stock_status, stock_quantity, sold_quantity,")
    lines.append("      is_active, show_in_public_catalog")
    lines.append("    ) VALUES (")
    lines.append("      v_slug, v_name, v_brand_id, v_type_id, nullif(btrim(r.model), ''),")
    lines.append("      coalesce(r.sale_price, 0), r.purchase_price,")
    lines.append("      nullif(btrim(r.indoor_serial), ''), nullif(btrim(r.outdoor_serial), ''),")
    lines.append("      nullif(btrim(r.purchase_invoice), ''), r.purchase_date,")
    lines.append("      'new', 'out_of_stock', 0, 1, false, false")
    lines.append("    ) RETURNING id INTO v_product_id;")
    lines.append("")
    lines.append("    INSERT INTO public.work_items (")
    lines.append("      type, event_code, status, priority, title, notes, due_date, completed_at,")
    lines.append("      product_id, contact_id, customer_name, customer_phone, customer_address,")
    lines.append("      quantity, unit_price, total_amount, purchase_price, supplier_name, supplier_invoice_number,")
    lines.append("      sale_install_state, sale_product_condition")
    lines.append("    ) VALUES (")
    lines.append("      'sale', 'sale', 'done', 'medium',")
    lines.append("      'Продажба: ' || v_name,")
    lines.append("      'Импорт Book2025, ред ' || r.sheet_row,")
    lines.append("      coalesce(r.sale_date, r.purchase_date),")
    lines.append("      (coalesce(r.sale_date, r.purchase_date) + time '12:00:00') AT TIME ZONE 'Europe/Sofia',")
    lines.append("      v_product_id, v_contact_id, r.client_name, r.client_phone, r.client_address,")
    lines.append("      1, coalesce(r.sale_price, 0), coalesce(r.sale_price, 0), r.purchase_price,")
    lines.append("      nullif(btrim(r.supplier), ''), nullif(btrim(r.purchase_invoice), ''),")
    lines.append("      'completed', 'new'")
    lines.append("    ) RETURNING id INTO v_sale_id;")
    lines.append("    v_imported := v_imported + 1;")
    lines.append("  END LOOP;")
    lines.append("")
    lines.append("  RAISE NOTICE 'Book2025 2026 import: imported=%, skipped=%', v_imported, v_skipped;")
    lines.append("END")
    lines.append("$import$;")
    lines.append("")

    OUT_SQL.write_text("\n".join(lines), encoding="utf-8")
    importable = sum(1 for r in rows if r.brand_db)
    print(f"SQL seed: {OUT_SQL}")
    print(f"Importable rows: {importable}")


def compare_with_db(rows: list[ParsedRow]) -> None:
    """Compare Excel rows with Supabase sales via REST or direct connection."""
    try:
        from dotenv import load_dotenv
        import psycopg2
    except ImportError as e:
        print(f"compare requires psycopg2 and python-dotenv: {e}", file=sys.stderr)
        return

    env_path = ROOT / "backend" / ".env.local"
    load_dotenv(env_path)
    db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print("Missing DATABASE_URL in backend/.env.local", file=sys.stderr)
        return

    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    cur.execute("""
        SELECT w.notes,
               w.due_date::text,
               w.total_amount,
               w.customer_name,
               w.customer_phone,
               p.indoor_unit_serial,
               p.outdoor_unit_serial
        FROM work_items w
        LEFT JOIN products p ON p.id = w.product_id
        WHERE w.event_code = 'sale'
          AND w.due_date >= %s AND w.due_date <= %s
    """, (YEAR_START.isoformat(), YEAR_END.isoformat()))
    db_rows = cur.fetchall()
    conn.close()

    def norm_serial(s: str | None) -> str:
        return re.sub(r"\s+", "", (s or "").strip().upper())

    def norm_phone(p: str | None) -> str:
        if not p:
            return ""
        d = re.sub(r"[^\d]", "", p)
        if d.startswith("359") and len(d) == 12:
            d = "0" + d[3:]
        return d

    db_by_import_row: dict[int, dict] = {}
    db_by_serial: dict[str, list] = {}
    for notes, due, amount, name, phone, indoor, outdoor in db_rows:
        m = re.search(r"Импорт Book2025, ред (\d+)", notes or "")
        if m:
            db_by_import_row[int(m.group(1))] = {
                "due": due, "amount": float(amount or 0), "name": name, "phone": phone,
            }
        for ser in (indoor, outdoor):
            key = norm_serial(ser)
            if key:
                db_by_serial.setdefault(key, []).append({
                    "due": due, "amount": float(amount or 0), "name": name,
                })

    lines = [
        f"Compare Book2025 2026 ({YEAR_START} .. {YEAR_END})",
        f"Excel green rows in period: {len(rows)}",
        f"DB sales in period: {len(db_rows)}",
        f"DB with Book2025 import tag: {len(db_by_import_row)}",
        "",
    ]

    missing: list[ParsedRow] = []
    matched_import = 0
    matched_serial = 0

    for row in rows:
        if row.sheet_row in db_by_import_row:
            matched_import += 1
            continue
        hit = False
        for ser in (row.indoor_serial, row.outdoor_serial):
            key = norm_serial(ser)
            if key and key in db_by_serial:
                matched_serial += 1
                hit = True
                break
        if not hit:
            missing.append(row)

    lines.append(f"Matched by import note: {matched_import}")
    lines.append(f"Matched by serial (no import note): {matched_serial}")
    lines.append(f"MISSING in DB: {len(missing)}")
    lines.append("")

    for row in missing:
        lines.append(
            f"  row {row.sheet_row}: {row.brand_db or row.brand_raw} {row.model} | "
            f"sale={row.sale_date} {row.sale_price}€ | "
            f"in={row.indoor_serial} out={row.outdoor_serial} | {row.client_name} {row.client_phone or ''}"
        )

    COMPARE_TXT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Compare report: {COMPARE_TXT}")
    print(f"Missing: {len(missing)} / {len(rows)}")


def load_missing_sheet_rows() -> set[int] | None:
    if not COMPARE_TXT.exists():
        return None
    rows: set[int] = set()
    for line in COMPARE_TXT.read_text(encoding="utf-8").splitlines():
        m = re.match(r"\s+row (\d+):", line)
        if m:
            rows.add(int(m.group(1)))
    return rows if rows else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Book2025 sales for 2026")
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--sql", action="store_true")
    parser.add_argument("--compare", action="store_true")
    parser.add_argument(
        "--missing-only",
        action="store_true",
        help="Само редове от Book2025_2026_compare.txt (липсващи в БД)",
    )
    args = parser.parse_args()

    if not args.preview and not args.sql and not args.compare:
        parser.error("Specify --preview, --compare and/or --sql")

    if not XLS_PATH.exists():
        print(f"Missing: {XLS_PATH}", file=sys.stderr)
        return 1

    rows_2026, brand_stats, all_green = parse_workbook_2026()
    print(f"All green rows: {len(all_green)}")
    print(f"2026 period rows: {len(rows_2026)}")

    work_rows = rows_2026
    if args.missing_only:
        missing_ids = load_missing_sheet_rows()
        if not missing_ids:
            print("No missing rows in compare file. Run --compare first.", file=sys.stderr)
            return 1
        work_rows = [r for r in rows_2026 if r.sheet_row in missing_ids]
        print(f"Missing-only mode: {len(work_rows)} rows")

    if args.preview:
        write_preview_2026(work_rows if args.missing_only else rows_2026, brand_stats)
    if args.compare:
        compare_with_db(rows_2026)
    if args.sql:
        write_sql(work_rows)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
