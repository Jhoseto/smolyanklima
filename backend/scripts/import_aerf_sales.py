#!/usr/bin/env python3
"""
Импорт на исторически продажби (нови климатици) от aerf.xls — само зелени редове.

Листове: EUROPA, JAPAN
Колони (като Book2023):
  A: марка, B: модел, C/D: серийни, E: закупен на, F: доставчик,
  G: ф-ра доставка, H: доставна цена, I: продаден (дата), J: клиент,
  K: ф-ра продажба, L: продажна цена, M: гаранция

Използване:
  python backend/scripts/import_aerf_sales.py --preview
  python backend/scripts/import_aerf_sales.py --sql
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import xlrd

from import_book2023_sales import (
    cell_str,
    is_green_row,
    map_brand as map_brand_base,
    parse_customer_text,
    parse_date,
    parse_price,
    sql_escape,
    sql_lit,
)

ROOT = Path(__file__).resolve().parents[2]
XLS_PATH = Path(r"H:\Apps\SmolyanKlima\Doc\aerf.xls")
PREVIEW_TSV = ROOT.parent / "Doc" / "AERF_import_preview.tsv"
WARNINGS_TXT = ROOT.parent / "Doc" / "AERF_import_warnings.txt"
OUT_SQL = ROOT / "backend" / "supabase" / "seeds" / "0016_aerf_historical_sales.sql"
IMPORT_LABEL = "AERF VTORA"
SLUG_PREFIX = "aerf"

AERF_BRAND_ALIASES: list[tuple[list[str], str]] = [
    (["ИНВЕНТОР"], "Condex"),
    (["ПАНАСОНИК"], "Panasonic"),
    (["ФУДЖИТСУ"], "Fujitsu"),
]


@dataclass
class ParsedRow:
    sheet_name: str
    sheet_row: int
    product_region: str
    brand_raw: str
    brand_db: str | None
    model: str
    indoor_serial: str
    outdoor_serial: str
    purchase_date: str | None
    supplier: str
    purchase_invoice: str
    purchase_price: float | None
    sale_date: str | None
    client_raw: str
    client_name: str
    client_phone: str | None
    client_address: str
    sale_invoice: str
    sale_price: float | None
    warranty: str
    warnings: list[str] = field(default_factory=list)


def map_brand(raw: str) -> str | None:
    upper = re.sub(r"\s+", " ", (raw or "").strip().upper())
    if not upper:
        return None
    for aliases, db_name in AERF_BRAND_ALIASES:
        for alias in aliases:
            if alias in upper or upper == alias:
                return db_name
    return map_brand_base(raw)


def region_for_sheet(sheet_name: str) -> str:
    if sheet_name.strip().upper().startswith("JAP"):
        return "japan"
    return "europe"


def build_notes(row: ParsedRow) -> str:
    parts = [f"Импорт {IMPORT_LABEL}, лист {row.sheet_name} ред {row.sheet_row}"]
    if row.sale_invoice and row.sale_invoice.upper() not in {"БЕЗ М-Ж", "БЕЗ МОНТАЖ"}:
        parts.append(f"ф-ра продажба: {row.sale_invoice}")
    if row.warranty:
        parts.append(f"гаранция: {row.warranty}")
    return " · ".join(parts)


def parse_workbook() -> tuple[list[ParsedRow], Counter]:
    book = xlrd.open_workbook(str(XLS_PATH), formatting_info=True)
    rows: list[ParsedRow] = []
    brand_stats: Counter = Counter()

    for sheet_name in book.sheet_names():
        sheet = book.sheet_by_name(sheet_name)
        product_region = region_for_sheet(sheet_name)

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
            if sale_invoice.upper() in {"БЕЗ М-Ж", "БЕЗ МОНТАЖ"}:
                sale_invoice = ""
            sale_price = parse_price(sheet.cell_value(r, 11))
            warranty = cell_str(sheet, r, 12)

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
            if not client_name and not client_phone:
                warnings.append("missing_client")

            brand_stats[brand_raw or "(empty)"] += 1
            rows.append(
                ParsedRow(
                    sheet_name=sheet_name,
                    sheet_row=r + 1,
                    product_region=product_region,
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
                    client_name=client_name or client_raw or "—",
                    client_phone=client_phone,
                    client_address=client_address,
                    sale_invoice=sale_invoice,
                    sale_price=sale_price,
                    warranty=warranty,
                    warnings=warnings,
                )
            )

    return rows, brand_stats


def write_preview(rows: list[ParsedRow], brand_stats: Counter) -> None:
    PREVIEW_TSV.parent.mkdir(parents=True, exist_ok=True)
    with PREVIEW_TSV.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow([
            "sheet", "row", "region", "brand_raw", "brand_db", "model",
            "indoor_serial", "outdoor_serial", "purchase_date", "supplier",
            "purchase_invoice", "purchase_price", "sale_date", "sale_price",
            "sale_invoice", "client_name", "client_phone", "client_address",
            "warnings",
        ])
        for row in rows:
            w.writerow([
                row.sheet_name, row.sheet_row, row.product_region,
                row.brand_raw, row.brand_db or "", row.model,
                row.indoor_serial, row.outdoor_serial,
                row.purchase_date or "", row.supplier,
                row.purchase_invoice,
                row.purchase_price if row.purchase_price is not None else "",
                row.sale_date or "", row.sale_price if row.sale_price is not None else "",
                row.sale_invoice, row.client_name, row.client_phone or "",
                row.client_address, ";".join(row.warnings),
            ])

    warn_counter = Counter()
    for row in rows:
        for warn in row.warnings:
            warn_counter[warn.split(":", 1)[0]] += 1

    lines = [
        f"Source: {XLS_PATH}",
        f"Green rows parsed: {len(rows)}",
        "",
        "Warnings:",
        *[f"  {k}: {v}" for k, v in warn_counter.most_common()],
        "",
        "Brand distribution (raw):",
        *[f"  {brand}: {count} -> {map_brand(brand) or 'UNMAPPED'}" for brand, count in brand_stats.most_common()],
    ]
    WARNINGS_TXT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Preview TSV: {PREVIEW_TSV}")
    print(f"Warnings:    {WARNINGS_TXT}")
    print(f"Rows: {len(rows)}")


def write_sql(rows: list[ParsedRow]) -> None:
    OUT_SQL.parent.mkdir(parents=True, exist_ok=True)
    lines: list[str] = [
        "-- =====================================================================",
        "-- Seed: Исторически продажби (нови) от aerf.xls — само зелени редове",
        "-- =====================================================================",
        f"-- Редове: {len(rows)}",
        "-- product_condition = new, product_region = europe | japan",
        f"-- Идемпотентност: notes LIKE 'Импорт {IMPORT_LABEL}, лист % ред %'",
        "-- Rollback: seeds/0017_rollback_aerf_sales.sql",
        "-- ВАЖНО: Един DO блок — пусни целия файл (Ctrl+A → Run).",
        "-- =====================================================================",
        "",
        "DO $import$",
        "DECLARE",
        "  r RECORD;",
        "  v_brand_id uuid;",
        "  v_type_id uuid;",
        "  v_contact_id uuid;",
        "  v_product_id uuid;",
        "  v_sale_id uuid;",
        "  v_slug text;",
        "  v_name text;",
        "  v_note text;",
        "  v_imported int := 0;",
        "  v_skipped int := 0;",
        "BEGIN",
        "  IF NOT EXISTS (",
        "    SELECT 1 FROM information_schema.columns",
        "    WHERE table_schema = 'public' AND table_name = 'work_items'",
        "      AND column_name = 'supplier_invoice_number'",
        "  ) THEN",
        "    RAISE EXCEPTION 'Seed 0016 изисква миграция 0076_work_items_supplier_fields.';",
        "  END IF;",
        "",
        "  IF NOT EXISTS (",
        "    SELECT 1 FROM information_schema.columns",
        "    WHERE table_schema = 'public' AND table_name = 'work_items'",
        "      AND column_name = 'purchase_price'",
        "  ) THEN",
        "    RAISE EXCEPTION 'Seed 0016 изисква миграция 0075_work_items_purchase_price.';",
        "  END IF;",
        "",
        "  INSERT INTO public.brands (slug, name, color, is_active)",
        "  VALUES ('condex', 'Condex', '#0D9488', true)",
        "  ON CONFLICT (slug) DO UPDATE SET is_active = excluded.is_active;",
        "",
        "  SELECT id INTO v_type_id FROM public.product_types ORDER BY name LIMIT 1;",
        "  IF v_type_id IS NULL THEN",
        "    RAISE EXCEPTION 'Липсва product_types seed.';",
        "  END IF;",
        "",
        "  FOR r IN",
        "    SELECT *",
        "    FROM (",
        "      VALUES",
    ]

    value_lines: list[str] = []
    for row in rows:
        if not row.brand_db:
            continue
        value_lines.append(
            "        ("
            + ", ".join([
                sql_lit(row.sheet_name, "text"),
                sql_lit(row.sheet_row, "int"),
                sql_lit(row.product_region, "text"),
                sql_lit(row.brand_db, "text"),
                sql_lit(row.model or row.indoor_serial or row.outdoor_serial, "text"),
                sql_lit(row.indoor_serial or None, "text"),
                sql_lit(row.outdoor_serial or None, "text"),
                sql_lit(row.purchase_date, "date"),
                sql_lit(row.supplier or None, "text"),
                sql_lit(row.purchase_invoice or None, "text"),
                sql_lit(row.purchase_price, "numeric(10,2)"),
                sql_lit(row.sale_date, "date"),
                sql_lit(row.client_name, "text"),
                sql_lit(row.client_phone, "text"),
                sql_lit(row.client_address or None, "text"),
                sql_lit(row.sale_invoice or None, "text"),
                sql_lit(row.sale_price if row.sale_price is not None else 0, "numeric(10,2)"),
                sql_lit(build_notes(row), "text"),
            ])
            + ")"
        )

    lines.append(",\n".join(value_lines))
    lines.extend([
        "    ) AS stage(",
        "      sheet_name, sheet_row, product_region, brand_name, model,",
        "      indoor_serial, outdoor_serial, purchase_date, supplier,",
        "      purchase_invoice, purchase_price, sale_date,",
        "      client_name, client_phone, client_address, sale_invoice, sale_price, notes",
        "    )",
        "    ORDER BY sheet_name, sheet_row",
        "  LOOP",
        "    v_product_id := NULL;",
        "    v_contact_id := NULL;",
        f"    v_slug := '{SLUG_PREFIX}-' || lower(r.sheet_name) || '-' || r.sheet_row;",
        "    v_note := r.notes;",
        "",
        "    IF EXISTS (",
        "      SELECT 1 FROM public.work_items",
        "      WHERE event_code = 'sale'",
        f"        AND notes LIKE 'Импорт {IMPORT_LABEL}, лист ' || r.sheet_name || ' ред ' || r.sheet_row || '%'",
        "    ) THEN",
        "      v_skipped := v_skipped + 1;",
        "      CONTINUE;",
        "    END IF;",
        "    IF EXISTS (SELECT 1 FROM public.products WHERE slug = v_slug) THEN",
        "      v_skipped := v_skipped + 1;",
        "      CONTINUE;",
        "    END IF;",
        "",
        "    IF r.indoor_serial IS NOT NULL AND btrim(r.indoor_serial) <> '' THEN",
        "      SELECT p.id INTO v_product_id FROM public.products p",
        "      JOIN public.work_items w ON w.product_id = p.id AND w.event_code = 'sale'",
        "      WHERE upper(btrim(p.indoor_unit_serial)) = upper(btrim(r.indoor_serial))",
        "      LIMIT 1;",
        "    END IF;",
        "    IF v_product_id IS NULL AND r.outdoor_serial IS NOT NULL AND btrim(r.outdoor_serial) <> '' THEN",
        "      SELECT p.id INTO v_product_id FROM public.products p",
        "      JOIN public.work_items w ON w.product_id = p.id AND w.event_code = 'sale'",
        "      WHERE upper(btrim(p.outdoor_unit_serial)) = upper(btrim(r.outdoor_serial))",
        "      LIMIT 1;",
        "    END IF;",
        "    IF v_product_id IS NOT NULL THEN",
        "      v_skipped := v_skipped + 1;",
        "      CONTINUE;",
        "    END IF;",
        "",
        "    SELECT id INTO v_brand_id FROM public.brands WHERE name = r.brand_name LIMIT 1;",
        "    IF v_brand_id IS NULL THEN",
        "      RAISE WARNING 'AERF % row %: липсва марка %', r.sheet_name, r.sheet_row, r.brand_name;",
        "      CONTINUE;",
        "    END IF;",
        "",
        "    IF r.client_phone IS NOT NULL AND length(btrim(r.client_phone)) >= 3 THEN",
        "      SELECT id INTO v_contact_id FROM public.contacts",
        "      WHERE phone = r.client_phone AND contact_kind = 'client' LIMIT 1;",
        "    END IF;",
        "    IF v_contact_id IS NULL THEN",
        "      SELECT id INTO v_contact_id FROM public.contacts",
        "      WHERE upper(btrim(full_name)) = upper(btrim(r.client_name))",
        "        AND contact_kind = 'client'",
        "        AND (r.client_phone IS NULL OR phone IS NULL OR phone = r.client_phone)",
        "      LIMIT 1;",
        "    END IF;",
        "    IF v_contact_id IS NULL THEN",
        "      INSERT INTO public.contacts (full_name, phone, address, contact_kind, customer_status)",
        "      VALUES (r.client_name, r.client_phone, r.client_address, 'client', 'active')",
        "      RETURNING id INTO v_contact_id;",
        "      IF r.client_phone IS NOT NULL AND length(btrim(r.client_phone)) >= 3 THEN",
        "        INSERT INTO public.contact_phones (contact_id, phone, is_primary, sort_order)",
        "        VALUES (v_contact_id, r.client_phone, true, 0) ON CONFLICT DO NOTHING;",
        "      END IF;",
        "    END IF;",
        "",
        "    v_name := r.brand_name || ' ' || coalesce(nullif(btrim(r.model), ''), 'климатик');",
        "",
        "    INSERT INTO public.products (",
        "      slug, name, brand_id, type_id, model_code, price, purchase_price,",
        "      indoor_unit_serial, outdoor_unit_serial, supplier_invoice_number, purchased_at,",
        "      product_condition, product_region, stock_status, stock_quantity, sold_quantity,",
        "      is_active, show_in_public_catalog",
        "    ) VALUES (",
        "      v_slug, v_name, v_brand_id, v_type_id, nullif(btrim(r.model), ''),",
        "      coalesce(r.sale_price, 0), r.purchase_price,",
        "      nullif(btrim(r.indoor_serial), ''), nullif(btrim(r.outdoor_serial), ''),",
        "      nullif(btrim(r.purchase_invoice), ''), r.purchase_date,",
        "      'new', r.product_region, 'out_of_stock', 0, 1, false, false",
        "    ) RETURNING id INTO v_product_id;",
        "",
        "    INSERT INTO public.work_items (",
        "      type, event_code, status, priority, title, notes, due_date, completed_at,",
        "      product_id, contact_id, customer_name, customer_phone, customer_address,",
        "      quantity, unit_price, total_amount, purchase_price, supplier_name, supplier_invoice_number,",
        "      sale_install_state",
        "    ) VALUES (",
        "      'sale', 'sale', 'done', 'medium',",
        "      'Продажба: ' || v_name,",
        "      v_note,",
        "      coalesce(r.sale_date, r.purchase_date),",
        "      (coalesce(r.sale_date, r.purchase_date) + time '12:00:00') AT TIME ZONE 'Europe/Sofia',",
        "      v_product_id, v_contact_id, r.client_name, r.client_phone, r.client_address,",
        "      1, coalesce(r.sale_price, 0), coalesce(r.sale_price, 0), r.purchase_price,",
        "      nullif(btrim(r.supplier), ''), nullif(btrim(r.purchase_invoice), ''),",
        "      'completed'",
        "    ) RETURNING id INTO v_sale_id;",
        "    v_imported := v_imported + 1;",
        "  END LOOP;",
        "",
        "  RAISE NOTICE 'AERF import: imported=%, skipped(existing)=%', v_imported, v_skipped;",
        "END",
        "$import$;",
        "",
    ])

    OUT_SQL.write_text("\n".join(lines), encoding="utf-8")
    importable = sum(1 for r in rows if r.brand_db)
    print(f"SQL seed: {OUT_SQL}")
    print(f"Importable rows (mapped brand): {importable}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Import AERF historical new AC sales")
    parser.add_argument("--preview", action="store_true")
    parser.add_argument("--sql", action="store_true")
    args = parser.parse_args()

    if not args.preview and not args.sql:
        parser.error("Specify --preview and/or --sql")

    if not XLS_PATH.exists():
        print(f"Missing source file: {XLS_PATH}", file=sys.stderr)
        return 1

    rows, brand_stats = parse_workbook()

    if args.preview:
        write_preview(rows, brand_stats)
    if args.sql:
        write_sql(rows)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
