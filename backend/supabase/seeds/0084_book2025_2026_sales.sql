-- =====================================================================
-- Seed: Продажби от Book2025.xls (зелени редове, 2026 г.)
-- =====================================================================
-- Редове: 22 | период 2026-01-01 .. 2026-06-04
-- Идемпотентност: пропуска по notes „Импорт Book2025, ред N“ или съществуващ сериен
-- =====================================================================

DO $import$
DECLARE
  r RECORD;
  v_brand_id uuid;
  v_type_id uuid;
  v_contact_id uuid;
  v_product_id uuid;
  v_sale_id uuid;
  v_slug text;
  v_name text;
  v_imported int := 0;
  v_skipped int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_items'
      AND column_name = 'supplier_invoice_number'
  ) THEN
    RAISE EXCEPTION 'Seed 0084 изисква миграция 0076_work_items_supplier_fields.';
  END IF;

  INSERT INTO public.brands (slug, name, color, is_active)
  VALUES
    ('alpin', 'Alpin', '#64748B', true),
    ('inventor', 'Inventor', '#64748B', true)
  ON CONFLICT (slug) DO UPDATE SET name = excluded.name, is_active = excluded.is_active;

  SELECT id INTO v_type_id FROM public.product_types ORDER BY name LIMIT 1;
  IF v_type_id IS NULL THEN
    RAISE EXCEPTION 'Липсва product_types seed.';
  END IF;

  FOR r IN
    SELECT *
    FROM (
      VALUES
        (392, 'Mitsubishi Electric', 'AY35', '3E017293TR', '5C017283TR', '2026-02-12'::date, 'БИТТЕЛ', '266354', 905.0::numeric(10,2), '2026-02-16'::date, 'НЕДКО ДОБРИКОВ ГЪРЦИЯ', '0888 549 974', NULL::text, NULL::text, 1360.0::numeric(10,2)),
        (400, 'Mitsubishi Heavy', '35ZS', NULL::text, NULL::text, '2026-02-26'::date, 'БИТТЕЛ', '267678', 823.0::numeric(10,2), '2026-03-04'::date, 'ЖИВКА ХРИСТЕВА 00898675177', NULL::text, NULL::text, NULL::text, 1230.0::numeric(10,2)),
        (402, 'Mitsubishi Heavy', '50 ПОДОВ', '564001956CF', '484507253CE', '2026-03-19'::date, 'КОНДЕКС', '100016598', 1567.0::numeric(10,2), '2026-05-27'::date, 'Владо ТАБАКОВ', '0876 855 810', NULL::text, NULL::text, 2000.0::numeric(10,2)),
        (403, 'Mitsubishi Heavy', '50 ПОДОВ', '564002197CF', '484507242CE', '2026-03-19'::date, 'КОНДЕКС', '100016598', 1567.0::numeric(10,2), '2026-05-27'::date, 'Владо ТАБАКОВ', '0876 855 810', NULL::text, NULL::text, 2000.0::numeric(10,2)),
        (404, 'Mitsubishi Heavy', '50 ПОДОВ', '564002528CF', '633400961CE', '2026-03-18'::date, 'КОНДЕКС', '100017911', 1567.0::numeric(10,2), '2026-05-27'::date, 'Владо ТАБАКОВ', '0876 855 810', NULL::text, NULL::text, 2000.0::numeric(10,2)),
        (405, 'Mitsubishi Heavy', '35 ZS', '542432302CF', '542860413CE', '2026-03-20'::date, 'КОНДЕКС', '100016598', 803.0::numeric(10,2), '2026-05-14'::date, 'ИСКРА ДЖУЧКОВА', '0876 839 950', NULL::text, '100001390', 1155.0::numeric(10,2)),
        (406, 'Mitsubishi Heavy', '35 ZS', '542432298CF', '542857834CE', '2026-03-20'::date, 'КОНДЕКС', '100016598', 803.0::numeric(10,2), '2026-05-14'::date, 'ИСКРА ДЖУЧКОВА', '0876 839 950', NULL::text, '100001390', 1155.0::numeric(10,2)),
        (419, 'Alpin', '48 КОЛОНА', NULL::text, NULL::text, '2026-03-23'::date, 'ДИМЕЛИ', '4651', 1876.0::numeric(10,2), NULL::date, 'Здравко Мирчев БАНИТЕ', '0878 143 221', NULL::text, NULL::text, 2710.0::numeric(10,2)),
        (425, 'Kaisai', '12 АЙС', 'K036014', 'K020605', '2026-03-31'::date, 'БУЛКЛИМА', '20076502', 455.5::numeric(10,2), '2026-04-01'::date, 'ВЕНЦИ ОРАКОВ', '0894 768 048', NULL::text, NULL::text, 830.0::numeric(10,2)),
        (426, 'Kaisai', '12 АЙС', 'K035828', 'K020591', '2026-03-31'::date, 'БУЛКЛИМА', '20076502', 455.5::numeric(10,2), '2026-04-01'::date, 'ВЕНЦИ ОРАКОВ', '0894 768 048', NULL::text, NULL::text, 830.0::numeric(10,2)),
        (427, 'Kaisai', '12 АЙС', 'K036342', 'K020027', '2026-03-31'::date, 'БУЛКЛИМА', '20076502', 455.5::numeric(10,2), '2026-04-01'::date, 'ВЕНЦИ ОРАКОВ', '0894 768 048', NULL::text, NULL::text, 830.0::numeric(10,2)),
        (428, 'Kaisai', '12 АЙС', 'K037595', 'K027629', '2026-03-31'::date, 'БУЛКЛИМА', '20076502', 455.5::numeric(10,2), '2026-04-01'::date, 'ВЕНЦИ ОРАКОВ', '0894 768 048', NULL::text, NULL::text, 830.0::numeric(10,2)),
        (430, 'Kaisai', '24 ПРО ХИЙТ+', 'K000515', 'K000315', '2026-04-03'::date, 'БУЛКЛИМА', '20076582', 697.5::numeric(10,2), '2026-04-06'::date, 'ГАЛИНА РУКОЛСКА', '0886 442 616', NULL::text, NULL::text, 1400.0::numeric(10,2)),
        (432, 'Fujitsu', '18 КАСЕТА', 'R020620', 'T001645', '2026-05-04'::date, 'БУЛКЛИМА', '20077085', 1500.0::numeric(10,2), '2026-05-05'::date, 'АНДРО ЧЕРНА', '0893 495 656', NULL::text, NULL::text, 2300.0::numeric(10,2)),
        (433, 'Mitsubishi Electric', 'AY25', NULL::text, NULL::text, '2026-04-24'::date, 'БИТТЕЛ', '272433', 767.0::numeric(10,2), '2026-04-27'::date, 'НЕДЯЛКА ПЕЙЧЕВА', '+4915145421180', NULL::text, NULL::text, 1300.0::numeric(10,2)),
        (441, 'Mitsubishi Electric', 'SRF50ZSX', '661500212CF', '633401084CE', '2026-05-14'::date, 'КОНДЕКС', '100017918', 1613.0::numeric(10,2), '2026-05-15'::date, 'ИСКРА ДЖУЧКОВА', '0876 839 950', NULL::text, '1390', 2130.0::numeric(10,2)),
        (442, 'Mitsubishi Electric', 'SRK35ZS', '542428748CF', '542860642CE', '2026-05-14'::date, 'КОНДЕКС', '100017918', 831.0::numeric(10,2), '2026-05-20'::date, 'МАРИАНА ГОСПОДИНОВА', '0887 822 595', NULL::text, NULL::text, 1250.0::numeric(10,2)),
        (443, 'Mitsubishi Heavy', '25 ZS', '542318337CF', '542727053CE', '2026-05-15'::date, 'ДИМЕЛИ', NULL::text, 705.0::numeric(10,2), '2026-05-20'::date, 'МАРИАНА ГОСПОДИНОВА', '0887 822 595', NULL::text, NULL::text, 1050.0::numeric(10,2)),
        (444, 'Mitsubishi Heavy', '35 ZS', '542136405CF', '542865453CE', '2026-05-19'::date, 'БУЛКЛИМА', '20077392', 708.0::numeric(10,2), '2026-05-22'::date, 'srk', NULL::text, NULL::text, NULL::text, 1200.0::numeric(10,2)),
        (454, 'Mitsubishi Heavy', '35 ZSX', '560402046CF', '545503440CE', '2026-05-26'::date, 'КОНДЕКС', '100018168', 1372.0::numeric(10,2), '2026-05-28'::date, 'ВЛАДИМИР ЕВТИМОВ', '0877 610 161', NULL::text, NULL::text, 2010.0::numeric(10,2)),
        (455, 'Mitsubishi Heavy', '35 ZSX', '560402050CF', '545503375CE', '2026-05-26'::date, 'КОНДЕКС', '100018168', 1372.0::numeric(10,2), '2026-05-28'::date, 'ВЛАДИМИР ЕВТИМОВ', '0877 610 161', NULL::text, NULL::text, 2010.0::numeric(10,2)),
        (456, 'Nacional', '24 ПРО НОРДИК', 'J000026', 'L000040', '2026-05-28'::date, 'БИТТЕЛ', '275454', 726.0::numeric(10,2), '2026-05-29'::date, 'АХМЕД КОДЖААЛИ', '0878 960 283', NULL::text, NULL::text, 1080.0::numeric(10,2))
    ) AS stage(
      sheet_row, brand_name, model, indoor_serial, outdoor_serial,
      purchase_date, supplier, purchase_invoice, purchase_price,
      sale_date, client_name, client_phone, client_address,
      sale_invoice, sale_price
    )
    ORDER BY sheet_row
  LOOP
    v_product_id := NULL;
    v_contact_id := NULL;
    v_slug := 'book2025-row-' || r.sheet_row;

    IF EXISTS (
      SELECT 1 FROM public.work_items
      WHERE event_code = 'sale'
        AND notes LIKE 'Импорт Book2025, ред ' || r.sheet_row || '%'
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.products
      WHERE slug = v_slug OR slug LIKE 'book2025-' || r.sheet_row || '-%'
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF r.indoor_serial IS NOT NULL AND btrim(r.indoor_serial) <> '' THEN
      SELECT p.id INTO v_product_id FROM public.products p
      JOIN public.work_items w ON w.product_id = p.id AND w.event_code = 'sale'
      WHERE upper(btrim(p.indoor_unit_serial)) = upper(btrim(r.indoor_serial))
      LIMIT 1;
    END IF;
    IF v_product_id IS NULL AND r.outdoor_serial IS NOT NULL AND btrim(r.outdoor_serial) <> '' THEN
      SELECT p.id INTO v_product_id FROM public.products p
      JOIN public.work_items w ON w.product_id = p.id AND w.event_code = 'sale'
      WHERE upper(btrim(p.outdoor_unit_serial)) = upper(btrim(r.outdoor_serial))
      LIMIT 1;
    END IF;
    IF v_product_id IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT id INTO v_brand_id FROM public.brands WHERE name = r.brand_name LIMIT 1;
    IF v_brand_id IS NULL THEN
      RAISE WARNING 'Book2025 row %: липсва марка %', r.sheet_row, r.brand_name;
      CONTINUE;
    END IF;

    IF r.client_phone IS NOT NULL AND length(btrim(r.client_phone)) >= 3 THEN
      SELECT id INTO v_contact_id FROM public.contacts
      WHERE phone = r.client_phone AND contact_kind = 'client' LIMIT 1;
    END IF;
    IF v_contact_id IS NULL THEN
      SELECT id INTO v_contact_id FROM public.contacts
      WHERE upper(btrim(full_name)) = upper(btrim(r.client_name))
        AND contact_kind = 'client'
        AND (r.client_phone IS NULL OR phone IS NULL OR phone = r.client_phone)
      LIMIT 1;
    END IF;
    IF v_contact_id IS NULL THEN
      INSERT INTO public.contacts (full_name, phone, address, contact_kind, customer_status)
      VALUES (r.client_name, r.client_phone, r.client_address, 'client', 'active')
      RETURNING id INTO v_contact_id;
      IF r.client_phone IS NOT NULL AND length(btrim(r.client_phone)) >= 3 THEN
        INSERT INTO public.contact_phones (contact_id, phone, is_primary, sort_order)
        VALUES (v_contact_id, r.client_phone, true, 0) ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    v_name := r.brand_name || ' ' || coalesce(nullif(btrim(r.model), ''), 'климатик');

    INSERT INTO public.products (
      slug, name, brand_id, type_id, model_code, price, purchase_price,
      indoor_unit_serial, outdoor_unit_serial, supplier_invoice_number, purchased_at,
      product_condition, stock_status, stock_quantity, sold_quantity,
      is_active, show_in_public_catalog
    ) VALUES (
      v_slug, v_name, v_brand_id, v_type_id, nullif(btrim(r.model), ''),
      coalesce(r.sale_price, 0), r.purchase_price,
      nullif(btrim(r.indoor_serial), ''), nullif(btrim(r.outdoor_serial), ''),
      nullif(btrim(r.purchase_invoice), ''), r.purchase_date,
      'new', 'out_of_stock', 0, 1, false, false
    ) RETURNING id INTO v_product_id;

    INSERT INTO public.work_items (
      type, event_code, status, priority, title, notes, due_date, completed_at,
      product_id, contact_id, customer_name, customer_phone, customer_address,
      quantity, unit_price, total_amount, purchase_price, supplier_name, supplier_invoice_number,
      sale_install_state, sale_product_condition
    ) VALUES (
      'sale', 'sale', 'done', 'medium',
      'Продажба: ' || v_name,
      'Импорт Book2025, ред ' || r.sheet_row,
      coalesce(r.sale_date, r.purchase_date),
      (coalesce(r.sale_date, r.purchase_date) + time '12:00:00') AT TIME ZONE 'Europe/Sofia',
      v_product_id, v_contact_id, r.client_name, r.client_phone, r.client_address,
      1, coalesce(r.sale_price, 0), coalesce(r.sale_price, 0), r.purchase_price,
      nullif(btrim(r.supplier), ''), nullif(btrim(r.purchase_invoice), ''),
      'completed', 'new'
    ) RETURNING id INTO v_sale_id;
    v_imported := v_imported + 1;
  END LOOP;

  RAISE NOTICE 'Book2025 2026 import: imported=%, skipped=%', v_imported, v_skipped;
END
$import$;
