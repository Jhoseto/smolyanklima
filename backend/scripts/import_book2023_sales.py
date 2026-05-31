#!/usr/bin/env python3
"""
Импорт на исторически продажби от Book2023-2.xls (само зелени редове).

Използване:
  python backend/scripts/import_book2023_sales.py --preview
  python backend/scripts/import_book2023_sales.py --sql

Изход:
  --preview → Doc/Book2023-2_import_preview.tsv + Doc/Book2023-2_import_warnings.txt
  --sql     → backend/supabase/seeds/0007_book2023_historical_sales.sql
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

import xlrd

ROOT = Path(__file__).resolve().parents[2]
XLS_PATH = Path(r"H:\Apps\SmolyanKlima\Doc\Book2023-2.xls")
PREVIEW_TSV = ROOT.parent / "Doc" / "Book2023-2_import_preview.tsv"
WARNINGS_TXT = ROOT.parent / "Doc" / "Book2023-2_import_warnings.txt"
OUT_SQL = ROOT / "backend" / "supabase" / "seeds" / "0007_book2023_historical_sales.sql"

PHONE_PATTERNS = [
    re.compile(r"(\+?\d{12,15})"),
    re.compile(r"(\b0\d{9}\b)"),
]

PLACES = {
    "СОФИЯ", "ПЛОВДИВ", "СМОЛЯН", "РУДОЗЕМ", "ДЕВИН", "ПАМПОРОВО",
    "БАНИТЕ", "МАДАН", "ЧЕПЕЛАРЕ", "БЯЛА РЕКА", "ДАВИДКОВО",
    "МОМЧИЛОВЦИ", "НАСТАН", "ЛЕСКА", "МОГИЛИЦА", "ПАВЕЛСКО",
    "ВИШНЕВО", "ГЪЛЪБОВО", "ЛЯСКОВО", "ГЪРЦИЯ", "ЛЕНОВО",
    "ВЪРБИНА", "БОСТИНА", "ЧАЛА", "УСТОВО", "ПЕРСЕНК",
    "КОС СМОЛЯН", "БЯЛА", "ФАТОВО", "ВАСИЛ ЛЕВСКИ", "КОСИТЕ",
}

NOISE_TAGS = [
    r"\bБЕЗ\s*М-Ж\b",
    r"\bБЕЗ\s*МОНТАЖ\b",
    r"\bПЛАТЕНО\b!?",
    r"\bличен\b",
    r"\bсп\.помощ\b",
    r"\bВТОРА\b",
    r"\bот\s+12KG\b",
    r"\bIT\b",
    r"\?\?\?",
]

# По-специфичните alias-и първи (подстринг match).
BRAND_RULES: list[tuple[list[str], str]] = [
    (["ФУДЖИЦУ ДЖЕНЕРАЛ", "ФУДЖИ ЕЛЕКТРИК", "FUJITSU GENERAL", "ФУДЖИ"], "Fujitsu"),
    (["МИЦУБИШИ ХЕВИ", "MITSUBISHI HEAVY"], "Mitsubishi Heavy"),
    (["МИЦУБИШИ ЕЛЕКТРИК", "МИЦУБИШИ ЕЛ", "МИЦУБИШИ ЕЛЕКТРК", "MITSUBISHI ELECTRIC"], "Mitsubishi Electric"),
    (["МИЦУБИШИ", "МИЦЖУБИШИ", "MITSUBISHI"], "Mitsubishi Electric"),
    (["ФУДЖИЦУ", "FUJITSU"], "Fujitsu"),
    (["ДАЙКИН", "DAIKIN", "ДЙКИН", "ДАИКИН"], "Daikin"),
    (["КУПЪР И ХЪНТЪР", "CARRIER"], "Carrier"),
    (["KAISAI ECO2", "КАЙСАЙ", "KAISAI"], "Kaisai"),
    (["АУРАЦУ", "AURATSU"], "Auratsu"),
    (["АРИЕЛИ", "ARIELLI"], "Arielli"),
    (["ОЛИМПИЯ СПЛЕНДИД", "OLIMPIA SPLENDID"], "Olimpia Splendid"),
    (["ГРИЙ", "GREE"], "Gree"),
    (["ТОШИБА", "TOSHIBA"], "Toshiba"),
    (["НИПОН", "NACIONAL"], "Nacional"),
    (["АУКС", "AUX"], "AUX"),
    (["МИДЕЯ", "MIDEA"], "Midea"),
    (["SAMSUNG"], "Samsung"),
    (["PANASONIC"], "Panasonic"),
    (["HITACHI", "ХИТАЧИ"], "Hitachi"),
    (["LG"], "LG"),
    (["SHARP"], "Sharp"),
    (["ATLANTIC"], "Atlantic"),
    (["ASPEN"], "Aspen"),
    (["WILLIAMS"], "Williams"),
    (["TCL"], "TCL"),
    (["ТРЕО", "TREO"], "Treo"),
]


@dataclass
class ParsedRow:
    sheet_row: int
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
    warnings: list[str] = field(default_factory=list)


def rgb_from_index(book: xlrd.Book, colour_index: int):
    try:
        if colour_index in book.colour_map:
            return book.colour_map[colour_index]
    except Exception:
        pass
    return None


def is_green_row(book: xlrd.Book, sheet: xlrd.sheet.Sheet, row_idx: int) -> bool:
    for col in range(sheet.ncols):
        if sheet.cell_value(row_idx, col) == "":
            continue
        xf = book.xf_list[sheet.cell_xf_index(row_idx, col)]
        font = book.font_list[xf.font_index]
        rgb = rgb_from_index(book, font.colour_index)
        if rgb and len(rgb) == 3:
            r, g, b = rgb
            if g > 80 and g > r + 30 and g > b + 30:
                return True
        if font.colour_index in {3, 17, 21, 42, 43, 50}:
            return True
    return False


def cell_str(sheet: xlrd.sheet.Sheet, row: int, col: int) -> str:
    val = sheet.cell_value(row, col)
    if val is None:
        return ""
    if isinstance(val, float) and val.is_integer():
        return str(int(val))
    return str(val).strip()


def normalize_phone(raw: str) -> str:
    p = re.sub(r"[^\d+]", "", raw)
    if not p:
        return ""
    if p.startswith("00"):
        p = "+" + p[2:]
    if p.startswith("+"):
        if p.startswith("+359") and len(p) == 13:
            return "0" + p[4:]
        return p
    if p.startswith("359") and len(p) == 12:
        return "0" + p[3:]
    if p.startswith("0") and len(p) == 10:
        return p
    if len(p) == 9:
        return "0" + p
    return p


def format_phone_display(canonical: str) -> str:
    if canonical.startswith("+"):
        return canonical
    digits = re.sub(r"[^\d]", "", canonical)
    if digits.startswith("359") and len(digits) == 12:
        digits = "0" + digits[3:]
    if digits.startswith("0") and len(digits) == 10:
        return f"{digits[:4]} {digits[4:7]} {digits[7:]}"
    return canonical


def extract_phones(text: str) -> list[str]:
    found: list[str] = []
    for pat in PHONE_PATTERNS:
        for m in pat.finditer(text):
            found.append(m.group(1))
    seen: set[str] = set()
    uniq: list[str] = []
    for p in found:
        if p not in seen:
            seen.add(p)
            uniq.append(p)
    return uniq


def clean_text(text: str) -> str:
    t = text
    for pat in NOISE_TAGS:
        t = re.sub(pat, "", t, flags=re.IGNORECASE)
    t = re.sub(r"[\s\-–—,;:!?.]+$", "", t)
    t = re.sub(r"^[\s\-–—,;:!?.]+", "", t)
    t = re.sub(r"\s+", " ", t)
    return t.strip()


def split_name_address(text: str) -> tuple[str, str]:
    parts = [p.strip() for p in re.split(r"[,;]", text) if p.strip()]
    if not parts:
        return "", ""
    if len(parts) == 1:
        m = re.search(r"\s*[-–—]\s*(.+)$", parts[0])
        if m:
            tail = m.group(1).strip().upper()
            if any(pl in tail for pl in PLACES):
                head = parts[0][: m.start()].strip()
                return head, m.group(1).strip()
        return parts[0], ""
    last = parts[-1]
    if any(pl in last.upper() for pl in PLACES) or len(parts) >= 2:
        return ", ".join(parts[:-1]), last
    return ", ".join(parts), ""


def parse_customer_text(raw: str) -> tuple[str, str | None, str]:
    text = (raw or "").strip()
    if not text:
        return "", None, ""
    phones = extract_phones(text)
    residue = text
    for p in phones:
        residue = residue.replace(p, "")
    residue = clean_text(residue)
    name, address = split_name_address(residue)
    phone = normalize_phone(phones[0]) if phones else None
    display_phone = format_phone_display(phone) if phone else None
    return name.strip(), display_phone, address.strip()


def map_brand(raw: str) -> str | None:
    upper = re.sub(r"\s+", " ", (raw or "").strip().upper())
    if not upper:
        return None
    for aliases, db_name in BRAND_RULES:
        for alias in aliases:
            if alias in upper or upper == alias:
                return db_name
    return None


def parse_price(val) -> float | None:
    if val is None or val == "":
        return None
    if isinstance(val, (int, float)):
        return round(float(val), 2)
    s = str(val).strip().upper()
    s = s.replace("ЕВРО", "").replace("EUR", "").replace("€", "")
    if "+" in s:
        nums = re.findall(r"\d+(?:\.\d+)?", s)
        if nums:
            return round(sum(float(n) for n in nums), 2)
    m = re.search(r"\d+(?:\.\d+)?", s)
    if m:
        return round(float(m.group()), 2)
    return None


def parse_date(val, book: xlrd.Book) -> str | None:
    if val is None or val == "":
        return None

    if isinstance(val, (int, float)):
        try:
            dt = xlrd.xldate_as_datetime(float(val), book.datemode)
            return dt.strftime("%Y-%m-%d")
        except Exception:
            pass

    s = str(val).strip()
    if not s:
        return None

    # DD.MM.YYYY / DD,MM,YYYY / DD/MM/YY — типични за Book2023
    m = re.match(r"(\d{1,2})[,\./](\d{1,2})[,\./]'?(\d{2,4})", s)
    if m:
        d, mo, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if y < 100:
            y += 2000 if y < 50 else 1900
        try:
            return datetime(y, mo, d).strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Excel serial като текст (рядко)
    try:
        serial = float(s.replace(",", "."))
        if 25000 <= serial <= 65000:
            dt = xlrd.xldate_as_datetime(serial, book.datemode)
            return dt.strftime("%Y-%m-%d")
    except Exception:
        pass

    return None


def slug_part(text: str) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "-", text.strip()).strip("-").lower()
    return s[:48] or "unit"


def sql_escape(value) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return str(value)
    s = str(value).replace("\\", "\\\\").replace("'", "''")
    return f"'{s}'"


def parse_workbook() -> tuple[list[ParsedRow], Counter]:
    book = xlrd.open_workbook(str(XLS_PATH), formatting_info=True)
    sheet = book.sheet_by_index(0)
    rows: list[ParsedRow] = []
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
        rows.append(
            ParsedRow(
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
        )

    return rows, brand_stats


def write_preview(rows: list[ParsedRow], brand_stats: Counter) -> None:
    PREVIEW_TSV.parent.mkdir(parents=True, exist_ok=True)
    with PREVIEW_TSV.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter="\t")
        w.writerow([
            "sheet_row", "brand_raw", "brand_db", "model", "indoor_serial", "outdoor_serial",
            "purchase_date", "purchase_price", "sale_date", "sale_price",
            "client_name", "client_phone", "client_address", "warnings",
        ])
        for row in rows:
            w.writerow([
                row.sheet_row, row.brand_raw, row.brand_db or "", row.model,
                row.indoor_serial, row.outdoor_serial,
                row.purchase_date or "", row.purchase_price if row.purchase_price is not None else "",
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
        f"Green rows parsed: {len(rows)}",
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
    print(f"Rows: {len(rows)}")
    for key, count in warn_counter.most_common():
        print(f"  {key}: {count}")


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
    lines.append("-- Seed: Исторически продажби от Book2023-2.xls (зелени редове)")
    lines.append("-- =====================================================================")
    lines.append(f"-- Редове: {len(rows)}")
    lines.append("-- Изисква: 0037_contacts_phone_nullable, 0075_work_items_purchase_price, 0078_work_items_sale_product_condition")
    lines.append("-- Идемпотентност: пропуска продукт с вече съществуващ сериен + sale work_item")
    lines.append("-- ВАЖНО: Един-единствен DO блок — пусни целия файл (Ctrl+A → Run).")
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
    lines.append("    RAISE EXCEPTION 'Seed 0007 изисква миграция 0076_work_items_supplier_fields.';")
    lines.append("  END IF;")
    lines.append("")
    lines.append("  IF NOT EXISTS (")
    lines.append("    SELECT 1 FROM information_schema.columns")
    lines.append("    WHERE table_schema = 'public' AND table_name = 'work_items'")
    lines.append("      AND column_name = 'purchase_price'")
    lines.append("  ) THEN")
    lines.append("    RAISE EXCEPTION 'Seed 0007 изисква миграция 0075_work_items_purchase_price.';")
    lines.append("  END IF;")
    lines.append("")
    lines.append("  INSERT INTO public.brands (slug, name, color, is_active)")
    lines.append("  VALUES ('treo', 'Treo', '#64748B', true)")
    lines.append("  ON CONFLICT (slug) DO UPDATE SET is_active = excluded.is_active;")
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
    lines.append("      sheet_row,")
    lines.append("      brand_name,")
    lines.append("      model,")
    lines.append("      indoor_serial,")
    lines.append("      outdoor_serial,")
    lines.append("      purchase_date,")
    lines.append("      supplier,")
    lines.append("      purchase_invoice,")
    lines.append("      purchase_price,")
    lines.append("      sale_date,")
    lines.append("      client_name,")
    lines.append("      client_phone,")
    lines.append("      client_address,")
    lines.append("      sale_invoice,")
    lines.append("      sale_price")
    lines.append("    )")
    lines.append("    ORDER BY sheet_row")
    lines.append("  LOOP")
    lines.append("    v_product_id := NULL;")
    lines.append("    v_contact_id := NULL;")
    lines.append("    v_slug := 'book2023-row-' || r.sheet_row;")
    lines.append("")
    lines.append("    IF EXISTS (")
    lines.append("      SELECT 1 FROM public.work_items")
    lines.append("      WHERE event_code = 'sale'")
    lines.append("        AND notes LIKE 'Импорт Book2023, ред ' || r.sheet_row || '%'")
    lines.append("    ) THEN")
    lines.append("      v_skipped := v_skipped + 1;")
    lines.append("      CONTINUE;")
    lines.append("    END IF;")
    lines.append("    IF EXISTS (")
    lines.append("      SELECT 1 FROM public.products")
    lines.append("      WHERE slug = v_slug OR slug LIKE 'book2023-' || r.sheet_row || '-%'")
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
    lines.append("      RAISE WARNING 'Book2023 row %: липсва марка %', r.sheet_row, r.brand_name;")
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
    lines.append("      'Импорт Book2023, ред ' || r.sheet_row,")
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
    lines.append("  RAISE NOTICE 'Book2023 import: imported=%, skipped(existing)=%', v_imported, v_skipped;")
    lines.append("END")
    lines.append("$import$;")
    lines.append("")

    OUT_SQL.write_text("\n".join(lines), encoding="utf-8")
    importable = sum(1 for r in rows if r.brand_db)
    print(f"SQL seed: {OUT_SQL}")
    print(f"Importable rows (mapped brand): {importable}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Import Book2023 historical sales")
    parser.add_argument("--preview", action="store_true", help="Write preview TSV + warnings")
    parser.add_argument("--sql", action="store_true", help="Write SQL seed file")
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
