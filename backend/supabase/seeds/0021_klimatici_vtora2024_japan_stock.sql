-- =====================================================================
-- Seed: Klimatici vtora2024 — JAPAN наличност (черен шрифт в Excel)
-- =====================================================================
-- Редове: 67
-- product_condition = used, product_region = japan, stock_status = in_stock
-- Идемпотентност: slug + description LIKE 'Импорт Klimatici vtora2024 JAPAN склад, лист % ред %'
-- Rollback: seeds/0022_rollback_klimatici_vtora2024_japan_stock.sql
-- ВАЖНО: Един DO блок — пусни целия файл (Ctrl+A → Run).
-- =====================================================================

DO $import$
DECLARE
  r RECORD;
  v_brand_id uuid;
  v_type_id uuid;
  v_product_id uuid;
  v_slug text;
  v_name text;
  v_desc text;
  v_price numeric(10,2);
  v_imported int := 0;
  v_skipped int := 0;
BEGIN
  SELECT id INTO v_type_id FROM public.product_types ORDER BY name LIMIT 1;
  IF v_type_id IS NULL THEN
    RAISE EXCEPTION 'Липсва product_types seed.';
  END IF;

  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('Toshiba вън', 3, 'Toshiba', 'V225AD', 'B225D', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 3', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Toshiba вън', 6, 'Toshiba', '251DAT', '2510Т', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 6', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Toshiba вън', 8, 'Toshiba', '251JAD', '251JD', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 8', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Toshiba вън', 10, 'Toshiba', '2519AT', '2519T', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 10', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Toshiba вън', 11, 'Toshiba', '251EAR', '251ER', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 11', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Toshiba вън', 14, 'Toshiba', 'C285APKS', 'C285PKS', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 14', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Toshiba вън', 16, 'Toshiba', '2819AT', '2819T', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 16', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Toshiba вън', 17, 'Toshiba', '281GAR', '281JRS', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 17', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Toshiba вън', 18, 'Toshiba', '402JADT', '402JDT', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 18', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Toshiba вън', 19, 'Toshiba', 'E406ADRS', '400VJDRS', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 19', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Toshiba вън', 20, 'Toshiba', '402GADR', '402GDRS', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 20', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Toshiba вън', 21, 'Toshiba', '402GADR', 'E406DRS', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 21', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Toshiba вън', 22, 'Toshiba', '402PADR', '402PDR', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 22', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Toshiba вън', 23, 'Toshiba', '562JADR', '562JDR', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 23', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Toshiba вън', 24, 'Toshiba', '562JADR', '562JDR', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 24', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Toshiba вън', 25, 'Toshiba', '562NAD', '562MDF', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Toshiba вън ред 25', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Daikin вън', 3, 'Daikin', 'R22JNS', 'F22JTNS', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 3', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Daikin вън', 4, 'Daikin', 'R22JNS', 'F22JTNS', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 4', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Daikin вън', 16, 'Daikin', 'AR22NES', 'AN22NES', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 16 · ПЛОВДИВ', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Daikin вън', 18, 'Daikin', 'AR25PFSK', 'AN25PFSK', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 18', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Daikin вън', 19, 'Daikin', 'R25HNS', 'F25HTNS', NULL::numeric(10,2), 1500.0::numeric(10,2), '2026-01-23'::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 19 · дата: 2026-01-23 · 0896929209, ИСМЕТ КАРААСЕНОВ · 2026-01-23', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Daikin вън', 22, 'Daikin', 'R28MES', 'F28MTES', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 22', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Daikin вън', 24, 'Daikin', 'AR28REBKS', 'AN28REBKS', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 24 · НЕ РАБОТИ', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Daikin вън', 26, 'Daikin', 'R36MESE2', 'F36TTES', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 26', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Daikin вън', 31, 'Daikin', 'AR40MAP', 'AN40RNP', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 31 · РОСЕН - МАДАН', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Daikin вън', 32, 'Daikin', 'R40MRXP', 'F40MTRXP', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 32 · РОСЕН - МАДАН', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Daikin вън', 33, 'Daikin', 'R40PFXV', 'F40PTFXV', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 33 · ПЛОВДИВ', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Daikin вън', 35, 'Daikin', 'R40NEP', 'F40NTEP', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 35', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Daikin вън', 36, 'Daikin', 'R50NWXP', 'F50NTWXP', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Daikin вън ред 36', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Mitsubishi', 2, 'Mitsubishi Electric', 'G225', 'JXV258', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Mitsubishi ред 2', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Mitsubishi', 3, 'Mitsubishi Electric', 'GV220', 'L2216', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Mitsubishi ред 3', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Mitsubishi', 8, 'Mitsubishi Electric', 'J228', 'J228', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Mitsubishi ред 8', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Mitsubishi', 16, 'Mitsubishi Electric', 'W25P', NULL::text, NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Mitsubishi ред 16', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Mitsubishi', 17, 'Mitsubishi Electric', 'BXV284', 'BXV284', NULL::numeric(10,2), 1900.0::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Mitsubishi ред 17 · ПЛОВДИВ', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Mitsubishi', 18, 'Mitsubishi Electric', 'BXV284', 'BXV284', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Mitsubishi ред 18', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Mitsubishi', 19, 'Mitsubishi Electric', 'HXV280S', 'HXV280S', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Mitsubishi ред 19', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Mitsubishi', 20, 'Mitsubishi Electric', 'GV282', NULL::text, NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Mitsubishi ред 20', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Nacional Вън', 5, 'Nacional', '228EXB', '228EXB', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Nacional Вън ред 5', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Nacional Вън', 8, 'Nacional', 'X257A', 'X257A', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Nacional Вън ред 8', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Nacional Вън', 11, 'Nacional', 'X408A', 'X408A', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Nacional Вън ред 11', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Nacional Вън', 12, 'Nacional', 'X407A', 'X407A', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Nacional Вън ред 12', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Nacional Вън', 13, 'Nacional', '', '562TXR', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Nacional Вън ред 13', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Panasonic вън', 3, 'Panasonic', '220CX', '220CX', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 3', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Panasonic вън', 4, 'Panasonic', '222CF', '222CF', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 4', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Panasonic вън', 5, 'Panasonic', '223CF', '223CF', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 5', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Panasonic вън', 6, 'Panasonic', 'F226C', 'F228C', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 6', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Panasonic вън', 7, 'Panasonic', 'F221C', 'F221C', 227.0::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 7 · v: 227TB', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Panasonic вън', 10, 'Panasonic', 'EX227C', 'EX227C', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 10', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Panasonic вън', 25, 'Panasonic', 'F253C', 'F253S', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 25', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Panasonic вън', 38, 'Panasonic', '366CF2', '366CF2', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 38', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Panasonic вън', 39, 'Panasonic', '368CF2', '368CF2', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 39', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Panasonic вън', 40, 'Panasonic', '403CT2', '403CT2', 404.0::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 40 · v: XS404C2', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Panasonic вън', 42, 'Panasonic', 'J407C2', 'J407C2', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 42', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Panasonic вън', 44, 'Panasonic', '402CX2', '402CX2', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 44', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Panasonic вън', 46, 'Panasonic', 'GX406C2', 'GX406C2', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 46', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Panasonic вън', 48, 'Panasonic', '569CGX2', NULL::text, 562.0::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 48 · v: 562CXR2', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Panasonic вън', 49, 'Panasonic', '563CEX2', '563CEX2', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 49', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Panasonic вън', 50, 'Panasonic', '56CEX2', '565CEX2', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 50', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 18000),
        ('Panasonic вън', 51, 'Panasonic', 'GX564C', NULL::text, 567.0::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 51 · v: EX567', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Panasonic вън', 52, 'Panasonic', '633CXR', '633CXR', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 52', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Panasonic вън', 53, 'Panasonic', 'EX67C2', NULL::text, 69.0::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Panasonic вън ред 53 · v: 69CGX2', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Fujitsu Вън', 2, 'Fujitsu', '225TK', '225TK', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Fujitsu Вън ред 2 · v: не работи -вероятно компресор', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), 24000),
        ('Fujitsu Вън', 3, 'Fujitsu', 'J22V', 'J22V', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Fujitsu Вън ред 3', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Fujitsu Вън', 6, 'Fujitsu', 'C22F', 'C22F', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Fujitsu Вън ред 6 · v: ПЛОВДИВ', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Fujitsu Вън', 11, 'Fujitsu', 'G406KS', 'G406KS', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Fujitsu Вън ред 11', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Fujitsu Вън', 13, 'Fujitsu', 'R56D2', 'R56B2W', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Fujitsu Вън ред 13', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int),
        ('Fujitsu Вън', 14, 'Fujitsu', 'R56D2', 'R56D2W', NULL::numeric(10,2), NULL::numeric(10,2), NULL::date, 'Импорт Klimatici vtora2024 JAPAN склад, лист Fujitsu Вън ред 14', NULL::text, NULL::numeric(7,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::numeric(6,2), NULL::int)
    ) AS stage(
      sheet_name, sheet_row, brand_name, outdoor_model, indoor_serial,
      purchase_price, list_price, purchased_at, description,
      refrigerant, weight_kg, cooling_kw, heating_kw, cop, eer, btu
    )
    ORDER BY sheet_name, sheet_row
  LOOP
    v_product_id := NULL;
    v_slug := 'klimatici-vtora2024-japan-' || r.sheet_name || '-' || r.sheet_row;
    v_desc := r.description;
    v_price := coalesce(r.list_price, r.purchase_price, 0);

    IF EXISTS (SELECT 1 FROM public.products WHERE slug = v_slug) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.products WHERE description LIKE 'Импорт Klimatici vtora2024 JAPAN склад, лист ' || r.sheet_name || ' ред ' || r.sheet_row || '%') THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF r.indoor_serial IS NOT NULL AND btrim(r.indoor_serial) <> '' THEN
      SELECT id INTO v_product_id FROM public.products p
      WHERE upper(btrim(p.indoor_unit_serial)) = upper(btrim(r.indoor_serial))
      LIMIT 1;
    END IF;
    IF v_product_id IS NULL AND r.outdoor_model IS NOT NULL AND btrim(r.outdoor_model) <> '' THEN
      SELECT id INTO v_product_id FROM public.products p
      WHERE upper(btrim(p.outdoor_unit_serial)) = upper(btrim(r.outdoor_model))
         OR upper(btrim(p.model_code)) = upper(btrim(r.outdoor_model))
      LIMIT 1;
    END IF;
    IF v_product_id IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT id INTO v_brand_id FROM public.brands WHERE name = r.brand_name LIMIT 1;
    IF v_brand_id IS NULL THEN
      RAISE WARNING 'Klimatici vtora2024 % row %: липсва марка %', r.sheet_name, r.sheet_row, r.brand_name;
      CONTINUE;
    END IF;

    v_name := r.brand_name || ' ' || coalesce(nullif(btrim(r.outdoor_model), ''), 'климатик');

    INSERT INTO public.products (
      slug, name, brand_id, type_id, model_code, description, price, purchase_price,
      indoor_unit_serial, outdoor_unit_serial, purchased_at,
      product_condition, product_region, stock_status, stock_quantity, sold_quantity,
      is_active, show_in_public_catalog
    ) VALUES (
      v_slug, v_name, v_brand_id, v_type_id, nullif(btrim(r.outdoor_model), ''), v_desc,
      v_price, r.purchase_price,
      nullif(btrim(r.indoor_serial), ''), nullif(btrim(r.outdoor_model), ''), r.purchased_at,
      'used', 'japan', 'in_stock', 1, 0, false, false
    ) RETURNING id INTO v_product_id;

    INSERT INTO public.product_specs (
      product_id, refrigerant, cooling_power_kw, heating_power_kw,
      seer, scop, btu, weight_outdoor_kg
    ) VALUES (
      v_product_id, nullif(btrim(r.refrigerant), ''), r.cooling_kw, r.heating_kw,
      r.eer, r.cop, r.btu, r.weight_kg
    )
    ON CONFLICT (product_id) DO UPDATE SET
      refrigerant = excluded.refrigerant,
      cooling_power_kw = excluded.cooling_power_kw,
      heating_power_kw = excluded.heating_power_kw,
      seer = excluded.seer,
      scop = excluded.scop,
      btu = excluded.btu,
      weight_outdoor_kg = excluded.weight_outdoor_kg;

    v_imported := v_imported + 1;
  END LOOP;

  RAISE NOTICE 'Klimatici vtora2024 JAPAN stock: imported=%, skipped(existing)=%', v_imported, v_skipped;
END
$import$;
