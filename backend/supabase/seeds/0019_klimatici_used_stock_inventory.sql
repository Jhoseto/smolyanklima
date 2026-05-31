-- =====================================================================
-- Seed: Klimatici втора употреба — наличност (склад) от 2023/2022/vtora .xlsx
-- =====================================================================
-- Редове: 108
-- Продукти: product_condition = used, stock_status = in_stock
-- Идемпотентност: slug + description LIKE 'Импорт % VTORA склад, лист % ред N'
-- Rollback: seeds/0020_rollback_klimatici_used_stock.sql
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
  INSERT INTO public.brands (slug, name, color, is_active)
  VALUES ('sanyo', 'Sanyo', '#1D4ED8', true)
  ON CONFLICT (slug) DO UPDATE SET is_active = excluded.is_active;

  SELECT id INTO v_type_id FROM public.product_types ORDER BY name LIMIT 1;
  IF v_type_id IS NULL THEN
    RAISE EXCEPTION 'Липсва product_types seed.';
  END IF;

  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('klimatici2022-stock', 'Toshiba вън', 5, 'Toshiba', '251gr', '251gr', '251gar', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Toshiba вън ред 5'),
        ('klimatici2022-stock', 'Toshiba вън', 7, 'Toshiba', 'e221m', 'e221m', 'e221ma', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Toshiba вън ред 7'),
        ('klimatici2022-stock', 'Toshiba вън', 14, 'Toshiba', '4022d', '4022d', '4022ad', 200.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Toshiba вън ред 14'),
        ('klimatici2022-stock', 'Toshiba вън', 22, 'Toshiba', '2', '2', '200v', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Toshiba вън ред 22'),
        ('klimatici2022-stock', 'Daikin вън', 5, 'Daikin', 'an25jns', 'an25jns', 'ar25jns', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Daikin вън ред 5'),
        ('klimatici2022-stock', 'Daikin вън', 7, 'Daikin', 'an22ses', 'an22ses', 'ar25ses', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Daikin вън ред 7'),
        ('klimatici2022-stock', 'Daikin вън', 20, 'Daikin', 'bez tabela', NULL::text, 'bez tabela', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Daikin вън ред 20'),
        ('klimatici2022-stock', 'Daikin вън', 50, 'Daikin', 'r28hns', NULL::text, 'r28hns', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Daikin вън ред 50'),
        ('klimatici2022-stock', 'Mitsubishi вън', 4, 'Mitsubishi Electric', 'gv363', 'gv363', 'gv363', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Mitsubishi вън ред 4'),
        ('klimatici2022-stock', 'Mitsubishi вън', 9, 'Mitsubishi Electric', 'zxv28w', 'zxv28w', 'zxv258', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Mitsubishi вън ред 9'),
        ('klimatici2022-stock', 'Mitsubishi вън', 29, 'Mitsubishi Electric', '8', '8', '200V', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Mitsubishi вън ред 29'),
        ('klimatici2022-stock', 'Nacional Вън', 7, 'Nacional', '22rjh', '22rjh', 'h228a', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Nacional Вън ред 7'),
        ('klimatici2022-stock', 'Nacional Вън', 8, 'Nacional', '63rgx2', '63rgx2', '63rgx2', 200.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Nacional Вън ред 8'),
        ('klimatici2022-stock', 'Nacional Вън', 15, 'Nacional', '2', '2', '200V', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Nacional Вън ред 15'),
        ('klimatici2022-stock', 'Panasonic вън', 6, 'Panasonic', 'j223c', 'j223c', 'f222c', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Panasonic вън ред 6'),
        ('klimatici2022-stock', 'Panasonic вън', 12, 'Panasonic', '22nfe9', '22nfe9', 'h229a', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Panasonic вън ред 12'),
        ('klimatici2022-stock', 'Panasonic вън', 14, 'Panasonic', '220cfr', '220cfr', 'f223c', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Panasonic вън ред 14'),
        ('klimatici2022-stock', 'Panasonic вън', 16, 'Panasonic', 'r285c', 'r285c', 'f285c', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Panasonic вън ред 16'),
        ('klimatici2022-stock', 'Panasonic вън', 21, 'Panasonic', '22vke', '22vke', '22bke', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Panasonic вън ред 21'),
        ('klimatici2022-stock', 'Panasonic вън', 23, 'Panasonic', '22vkn', '22vkn', 'f220c', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Panasonic вън ред 23'),
        ('klimatici2022-stock', 'Panasonic вън', 25, 'Panasonic', '22rkh', '22rkh', 'h229a', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Panasonic вън ред 25'),
        ('klimatici2022-stock', 'Panasonic вън', 33, 'Panasonic', '4', '4', '200v', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Panasonic вън ред 33'),
        ('klimatici2022-stock', 'Fujitsu Вън', 4, 'Fujitsu', 'm28g', 'm28g', 'm28g', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Fujitsu Вън ред 4 · ВЕНЧО'),
        ('klimatici2022-stock', 'Fujitsu Вън', 5, 'Fujitsu', 'a22c', 'a22c', 'a22c', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Fujitsu Вън ред 5'),
        ('klimatici2022-stock', 'Fujitsu Вън', 10, 'Fujitsu', 'j22d', 'j22d', 'j22d', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Fujitsu Вън ред 10'),
        ('klimatici2022-stock', 'Fujitsu Вън', 11, 'Fujitsu', 'e22r', 'e22r', 'e22r', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Fujitsu Вън ред 11'),
        ('klimatici2022-stock', 'Fujitsu Вън', 19, 'Fujitsu', 'e40s', 'e40s', 'bez tabela', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Fujitsu Вън ред 19 · СТОИЛ'),
        ('klimatici2022-stock', 'Fujitsu Вън', 20, 'Fujitsu', 'e50v2', 'e50v2', 'bez tabela', 200.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Fujitsu Вън ред 20 · СТОИЛ'),
        ('klimatici2022-stock', 'Fujitsu Вън', 23, 'Fujitsu', 'as28ppe', 'as28ppe', '28ppe', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Fujitsu Вън ред 23'),
        ('klimatici2022-stock', 'Fujitsu Вън', 24, 'Fujitsu', 'a28a', 'a28a', 'a28a', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Fujitsu Вън ред 24'),
        ('klimatici2022-stock', 'Fujitsu Вън', 25, 'Fujitsu', 'j22b', 'j22b', 'j22b', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Fujitsu Вън ред 25'),
        ('klimatici2022-stock', 'Fujitsu Вън', 33, 'Fujitsu', '2', '2', '200V', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Fujitsu Вън ред 33'),
        ('klimatici2022-stock', 'Hitachi Вън', 2, 'Hitachi', 'sv28', 'sv28', 'sv28a', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Hitachi Вън ред 2'),
        ('klimatici2022-stock', 'Hitachi Вън', 3, 'Hitachi', 'e282', 'e282', 'e287', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Hitachi Вън ред 3'),
        ('klimatici2022-stock', 'Hitachi Вън', 5, 'Hitachi', 'as22c', 'as22c', 'as22c', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Hitachi Вън ред 5'),
        ('klimatici2022-stock', 'Hitachi Вън', 24, 'Hitachi', 'z40d2', 'z40d2', 'z40d', 200.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Hitachi Вън ред 24'),
        ('klimatici2022-stock', 'Hitachi Вън', 44, 'Hitachi', '12', '12', '200V', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Hitachi Вън ред 44'),
        ('klimatici2022-stock', 'Sanyo Вън', 2, 'Sanyo', 'ZK22X', 'ZK22X', 'czk22x', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Sanyo Вън ред 2'),
        ('klimatici2022-stock', 'Sharp Вън', 2, 'Sharp', 'z28sd', 'z28sd', 'z28sd', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Sharp Вън ред 2'),
        ('klimatici2022-stock', 'Sharp Вън', 3, 'Sharp', 'b28sd', 'b28sd', 'b28sdy', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Sharp Вън ред 3'),
        ('klimatici2022-stock', 'Sharp Вън', 6, 'Sharp', 'z28de7', 'z28de7', 'z28de', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Sharp Вън ред 6'),
        ('klimatici2022-stock', 'Sharp Вън', 8, 'Sharp', '281fd', '281fd', '281fd', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Sharp Вън ред 8'),
        ('klimatici2022-stock', 'Sharp Вън', 10, 'Sharp', '285fd', '285fd', '285fd', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Sharp Вън ред 10'),
        ('klimatici2022-stock', 'Sharp Вън', 13, 'Sharp', 'a40vx', 'a40vx', 'a40vx', 200.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Sharp Вън ред 13 · ПОДМЯНА ИВАН ФИСИНСКИ - ВЪНШНО'),
        ('klimatici2022-stock', 'Sharp Вън', 20, 'Sharp', 'z28sd', 'z28sd', 'z28sd', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Sharp Вън ред 20'),
        ('klimatici2022-stock', 'Sharp Вън', 30, 'Sharp', '8', '8', '200v', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2022 VTORA склад, лист Sharp Вън ред 30'),
        ('klimatici2023-stock', 'toshiba', 4, 'Toshiba', '221PV', '221PV', '221BAV', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист toshiba ред 4'),
        ('klimatici2023-stock', 'toshiba', 13, 'Toshiba', '251UDR', '251UDR', '251UADF', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист toshiba ред 13'),
        ('klimatici2023-stock', 'toshiba', 17, 'Toshiba', '281JDRS', '281JDRS', '281JADRS', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист toshiba ред 17 · ПЛОВДИВ'),
        ('klimatici2023-stock', 'toshiba', 20, 'Toshiba', '401GR', '401GR', '401GAR', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист toshiba ред 20'),
        ('klimatici2023-stock', 'toshiba', 21, 'Toshiba', '402GDRH', '402GDRH', '402GADR', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист toshiba ред 21'),
        ('klimatici2023-stock', 'mitsubishi', 5, 'Mitsubishi Electric', 'SV22T', 'SV22T', 'SV22T', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист mitsubishi ред 5'),
        ('klimatici2023-stock', 'mitsubishi', 13, 'Mitsubishi Electric', 'SV258', 'SV258', 'SV258', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист mitsubishi ред 13'),
        ('klimatici2023-stock', 'mitsubishi', 19, 'Mitsubishi Electric', 'P2816', 'P2816', 'P2816', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист mitsubishi ред 19'),
        ('klimatici2023-stock', 'nacional', 8, 'Nacional', '287TB', '287TB', '287TB', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист nacional ред 8'),
        ('klimatici2023-stock', 'nacional', 9, 'Nacional', 'X287A', 'X287A', 'X287A', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист nacional ред 9'),
        ('klimatici2023-stock', 'nacional', 12, 'Nacional', 'X408A2', 'X408A2', 'X408A2', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист nacional ред 12'),
        ('klimatici2023-stock', 'hitachi', 3, 'Hitachi', 'AJ25E', 'AJ25E', 'AJ25E', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист hitachi ред 3'),
        ('klimatici2023-stock', 'hitachi', 7, 'Hitachi', 'AJ28D', 'AJ28D', 'AJ28D', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист hitachi ред 7'),
        ('klimatici2023-stock', 'hitachi', 10, 'Hitachi', 'SV28A', 'SV28A', 'SV28A', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист hitachi ред 10'),
        ('klimatici2023-stock', 'hitachi', 24, 'Hitachi', 'SV40Z2', 'SV40Z2', 'SV40Z2', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист hitachi ред 24'),
        ('klimatici2023-stock', 'hitachi', 27, 'Hitachi', 'S40Y2', 'S40Y2', 'S40Y2', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист hitachi ред 27'),
        ('klimatici2023-stock', 'hitachi', 28, 'Hitachi', 'S40Y2', 'S40Y2', 'S40Y2', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист hitachi ред 28'),
        ('klimatici2023-stock', 'hitachi', 33, 'Hitachi', 'JT40X2E5', 'JT40X2E5', 'JT40X2E5', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист hitachi ред 33'),
        ('klimatici2023-stock', 'hitachi', 35, 'Hitachi', 'JT40Z2E7', 'JT40Z2E7', 'JT40Z2E7', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист hitachi ред 35'),
        ('klimatici2023-stock', 'hitachi', 40, 'Hitachi', 'AJL50Z2', 'AJL50Z2', 'AJL50Z2', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист hitachi ред 40'),
        ('klimatici2023-stock', 'hitachi', 43, 'Hitachi', 'JT56E2E3', 'JT56E2E3', 'JD56A2E8', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист hitachi ред 43'),
        ('klimatici2023-stock', 'hitachi', 45, 'Hitachi', 'S63Y2', 'S63Y2', 'S63YB', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист hitachi ред 45'),
        ('klimatici2023-stock', 'hitachi', 46, 'Hitachi', 'M28Y', 'M28Y', NULL::text, NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист hitachi ред 46'),
        ('klimatici2023-stock', 'panasonic', 4, 'Panasonic', '220DCFR', '220DCFR', '22CF', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист panasonic ред 4'),
        ('klimatici2023-stock', 'panasonic', 13, 'Panasonic', '223CFR', '223CFR', 'F223C', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист panasonic ред 13'),
        ('klimatici2023-stock', 'panasonic', 14, 'Panasonic', 'J224C', 'J224C', 'J224C', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист panasonic ред 14'),
        ('klimatici2023-stock', 'panasonic', 21, 'Panasonic', 'XS257C', 'XS257C', 'XS257C', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист panasonic ред 21 · ПЛОВДИВ'),
        ('klimatici2023-stock', 'panasonic', 22, 'Panasonic', 'EX250C', 'EX250C', 'EX250C', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист panasonic ред 22'),
        ('klimatici2023-stock', 'panasonic', 23, 'Panasonic', '257CF', '257CF', '257CF', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист panasonic ред 23 · Стоян Чавдаров - Гърция - вътрешно'),
        ('klimatici2023-stock', 'panasonic', 26, 'Panasonic', '28BLE', '28BLE', '28BLE', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист panasonic ред 26'),
        ('klimatici2023-stock', 'panasonic', 27, 'Panasonic', 'F289A', 'F289A', 'F289A', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист panasonic ред 27'),
        ('klimatici2023-stock', 'panasonic', 29, 'Panasonic', '284CFR', '284CFR', 'F284C', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист panasonic ред 29'),
        ('klimatici2023-stock', 'panasonic', 31, 'Panasonic', '28BFE4', '28BFE4', 'F286C', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист panasonic ред 31 · ПЛОВДИВ'),
        ('klimatici2023-stock', 'panasonic', 32, 'Panasonic', '283CXR', '283CXR', '283CXR', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист panasonic ред 32'),
        ('klimatici2023-stock', 'panasonic', 35, 'Panasonic', 'F366C2', 'F366C2', 'F366C2', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист panasonic ред 35'),
        ('klimatici2023-stock', 'sharp', 3, 'Sharp', 'C25DM', 'C25DM', 'C25DMY', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист sharp ред 3'),
        ('klimatici2023-stock', 'sharp', 5, 'Sharp', 'C28DH', 'C28DH', 'C28DHY', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист sharp ред 5 · за части'),
        ('klimatici2023-stock', 'sanyo', 3, 'Sanyo', 'ZK25X', 'ZK25X', 'CZK25X', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист sanyo ред 3'),
        ('klimatici2023-stock', 'fujitsu', 4, 'Fujitsu', '224NEV', '224NEV', '224NEV', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист fujitsu ред 4'),
        ('klimatici2023-stock', 'fujitsu', 7, 'Fujitsu', 'J28B', 'J28B', 'J28B', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист fujitsu ред 7'),
        ('klimatici2023-stock', 'fujitsu', 15, 'Fujitsu', 'W56D2W', 'W56D2W', 'W56D2', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист fujitsu ред 15 · 12,11,2024'),
        ('klimatici2023-stock', 'fujitsu', 16, 'Fujitsu', 'A288H', 'A288H', 'A28H', NULL::numeric(10,2), NULL::numeric(10,2), 'Импорт Klimatici2023 VTORA склад, лист fujitsu ред 16'),
        ('klimatici-vtora-stock', 'Toshiba вън', 6, 'Toshiba', '221ND', '221ND', '221NAD', 100.0::numeric(10,2), 750.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Toshiba вън ред 6'),
        ('klimatici-vtora-stock', 'Toshiba вън', 13, 'Toshiba', '221SX', '221SX', '221SAX', 100.0::numeric(10,2), 750.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Toshiba вън ред 13 · НАСКО'),
        ('klimatici-vtora-stock', 'Toshiba вън', 16, 'Toshiba', '2255DV', '2255DV', '2259AST', 100.0::numeric(10,2), 500.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Toshiba вън ред 16'),
        ('klimatici-vtora-stock', 'Daikin вън', 12, 'Daikin', 'ATE28MSE8', 'ATE28MSE8', 'ARE28MS', 100.0::numeric(10,2), 750.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Daikin вън ред 12'),
        ('klimatici-vtora-stock', 'Daikin вън', 31, 'Daikin', 'AN22LKS', 'AN22LKS', 'AR22LKS', 100.0::numeric(10,2), 600.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Daikin вън ред 31'),
        ('klimatici-vtora-stock', 'Mitsubishi вън', 3, 'Mitsubishi Electric', 'J40TS', NULL::text, 'J40TS', 200.0::numeric(10,2), 1.1::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Mitsubishi вън ред 3'),
        ('klimatici-vtora-stock', 'Mitsubishi вън', 18, 'Mitsubishi Electric', 'J288', NULL::text, 'J288', 100.0::numeric(10,2), 750.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Mitsubishi вън ред 18'),
        ('klimatici-vtora-stock', 'Nacional Вън', 4, 'Nacional', 'X367A', NULL::text, 'X367A', 100.0::numeric(10,2), NULL::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Nacional Вън ред 4 · избутване на клапата, аспирация, прахосмукачка, · за части'),
        ('klimatici-vtora-stock', 'Nacional Вън', 9, 'Nacional', '50RJX2', NULL::text, '50RJX2', 200.0::numeric(10,2), NULL::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Nacional Вън ред 9 · в сервиза'),
        ('klimatici-vtora-stock', 'Hitachi Вън', 2, 'Hitachi', 'AC28A', NULL::text, 'AC28A', 100.0::numeric(10,2), 600.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Hitachi Вън ред 2'),
        ('klimatici-vtora-stock', 'Hitachi Вън', 9, 'Hitachi', 'AJ28B', NULL::text, 'AJ28B', 100.0::numeric(10,2), 600.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Hitachi Вън ред 9'),
        ('klimatici-vtora-stock', 'Hitachi Вън', 11, 'Hitachi', 'AT28B', NULL::text, 'AT28B', 100.0::numeric(10,2), 600.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Hitachi Вън ред 11'),
        ('klimatici-vtora-stock', 'Hitachi Вън', 17, 'Hitachi', 'AJ25E', NULL::text, 'AJ25E', 100.0::numeric(10,2), 600.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Hitachi Вън ред 17'),
        ('klimatici-vtora-stock', 'Hitachi Вън', 18, 'Hitachi', 'JT28ZE7', NULL::text, 'JT28ZE7', 100.0::numeric(10,2), 800.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Hitachi Вън ред 18 · KOKO'),
        ('klimatici-vtora-stock', 'Hitachi Вън', 23, 'Hitachi', 'S28Z', NULL::text, 'S28Z', 100.0::numeric(10,2), 800.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Hitachi Вън ред 23'),
        ('klimatici-vtora-stock', 'Hitachi Вън', 24, 'Hitachi', 'SC36X', NULL::text, 'SC36X', 100.0::numeric(10,2), 800.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Hitachi Вън ред 24 · ЗЛАТИ'),
        ('klimatici-vtora-stock', 'Sharp Вън', 8, 'Sharp', 'A40DEY', NULL::text, 'A40DEY', 100.0::numeric(10,2), 700.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Sharp Вън ред 8'),
        ('klimatici-vtora-stock', 'Sharp Вън', 11, 'Sharp', 'Z40SXY', NULL::text, 'Z40SXY', 200.0::numeric(10,2), 1.1::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Sharp Вън ред 11'),
        ('klimatici-vtora-stock', 'Sharp Вън', 15, 'Sharp', 'B28BXY', NULL::text, 'B28BXY', 100.0::numeric(10,2), 600.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Sharp Вън ред 15'),
        ('klimatici-vtora-stock', 'Sharp Вън', 25, 'Sharp', 'Y28SVY', NULL::text, 'Y28SVY', 100.0::numeric(10,2), 600.0::numeric(10,2), 'Импорт KlimaticiVtora VTORA склад, лист Sharp Вън ред 25 · аспирация, самопочистване. Йон, плазма. Пропада клапата')
    ) AS stage(
      stock_slug_prefix, sheet_name, sheet_row, brand_name, model,
      indoor_serial, outdoor_serial, purchase_price, list_price, description
    )
    ORDER BY stock_slug_prefix, sheet_name, sheet_row
  LOOP
    v_product_id := NULL;
    v_slug := r.stock_slug_prefix || '-' || r.sheet_name || '-' || r.sheet_row;
    v_desc := r.description;
    v_price := coalesce(r.list_price, r.purchase_price, 0);

    IF EXISTS (SELECT 1 FROM public.products WHERE slug = v_slug) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.products
      WHERE description LIKE 'Импорт % VTORA склад, лист ' || r.sheet_name || ' ред ' || r.sheet_row || '%'
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    IF r.indoor_serial IS NOT NULL AND btrim(r.indoor_serial) <> '' THEN
      SELECT id INTO v_product_id FROM public.products p
      WHERE upper(btrim(p.indoor_unit_serial)) = upper(btrim(r.indoor_serial))
      LIMIT 1;
    END IF;
    IF v_product_id IS NULL AND r.outdoor_serial IS NOT NULL AND btrim(r.outdoor_serial) <> '' THEN
      SELECT id INTO v_product_id FROM public.products p
      WHERE upper(btrim(p.outdoor_unit_serial)) = upper(btrim(r.outdoor_serial))
      LIMIT 1;
    END IF;
    IF v_product_id IS NOT NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    SELECT id INTO v_brand_id FROM public.brands WHERE name = r.brand_name LIMIT 1;
    IF v_brand_id IS NULL THEN
      RAISE WARNING 'Klimatici stock % row %: липсва марка %', r.sheet_name, r.sheet_row, r.brand_name;
      CONTINUE;
    END IF;

    v_name := r.brand_name || ' ' || coalesce(nullif(btrim(r.model), ''), 'климатик');

    INSERT INTO public.products (
      slug, name, brand_id, type_id, model_code, description, price, purchase_price,
      indoor_unit_serial, outdoor_unit_serial, purchased_at,
      product_condition, product_region, stock_status, stock_quantity, sold_quantity,
      is_active, show_in_public_catalog
    ) VALUES (
      v_slug, v_name, v_brand_id, v_type_id, nullif(btrim(r.model), ''), v_desc,
      v_price, r.purchase_price,
      nullif(btrim(r.indoor_serial), ''), nullif(btrim(r.outdoor_serial), ''), NULL,
      'used', 'europe', 'in_stock', 1, 0, false, false
    );
    v_imported := v_imported + 1;
  END LOOP;

  RAISE NOTICE 'Klimatici used stock import: imported=%, skipped(existing)=%', v_imported, v_skipped;
END
$import$;
