-- =====================================================================
-- Seed: Наличност (нови) от aerf.xls — черен текст, не зелен/червен
-- =====================================================================
-- Редове: 59
-- product_condition = new, stock_status = in_stock, product_region = europe | japan
-- Идемпотентност: description LIKE 'Импорт AERF склад, лист %'
-- Rollback: seeds/0023_rollback_aerf_stock.sql
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
  VALUES ('condex', 'Condex', '#0D9488', true)
  ON CONFLICT (slug) DO UPDATE SET is_active = excluded.is_active;

  SELECT id INTO v_type_id FROM public.product_types ORDER BY name LIMIT 1;
  IF v_type_id IS NULL THEN
    RAISE EXCEPTION 'Липсва product_types seed.';
  END IF;

  FOR r IN
    SELECT *
    FROM (
      VALUES
        ('EUROPA', 2, 'europe', 'Fujitsu', '12-KETA', 'T000532', 'T001024', '2020-06-29'::date, 'БУЛКЛИМА', '20025545', 1240.0::numeric(10,2), 1240.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 2 · доставчик: БУЛКЛИМА · ф-ра доставка: 20025545'),
        ('EUROPA', 3, 'europe', 'Toshiba', '13 ШОРАЙ', '02200053', '02200014', '2020-07-09'::date, 'БИТТЕЛ', '109220', 1200.0::numeric(10,2), 1200.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 3 · доставчик: БИТТЕЛ · ф-ра доставка: 109220'),
        ('EUROPA', 4, 'europe', 'Fujitsu', '12 KМCС', 'E106496', 'E003384', '2021-08-02'::date, 'БУЛКЛИМА', '20033988', 950.0::numeric(10,2), 950.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 4 · доставчик: БУЛКЛИМА · ф-ра доставка: 20033988'),
        ('EUROPA', 5, 'europe', 'Mitsubishi Electric', 'HR35', '0Е079720TR', '1C116391TR', '2021-08-19'::date, 'БИТТЕЛ', '129605', 988.0::numeric(10,2), 988.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 5 · доставчик: БИТТЕЛ · ф-ра доставка: 129605'),
        ('EUROPA', 6, 'europe', 'Fujitsu', '12LUCA', 'E011524', 'E006726', '2021-08-26'::date, 'БУЛКЛИМА', '20034897', 1170.0::numeric(10,2), 1170.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 6 · доставчик: БУЛКЛИМА · ф-ра доставка: 20034897'),
        ('EUROPA', 8, 'europe', 'Kaisai', '12 ФЛАЙ', '12HRGIK004947', '12HRGOK004504', '2022-02-25'::date, 'БУЛКЛИМА', '20038938', 656.0::numeric(10,2), 656.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 8 · доставчик: БУЛКЛИМА · ф-ра доставка: 20038938'),
        ('EUROPA', 9, 'europe', 'Fujitsu', '12КР', 'E002859-', 'E057218', '2022-06-09'::date, 'БУЛКЛИМА', '20041126', 907.0::numeric(10,2), 907.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 9 · доставчик: БУЛКЛИМА · ф-ра доставка: 20041126'),
        ('EUROPA', 10, 'europe', 'Fujitsu', '12KETA', 'T101215-', 'T002172', '2022-06-16'::date, 'БУЛКЛИМА', '20041338', 1325.0::numeric(10,2), 1325.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 10 · доставчик: БУЛКЛИМА · ф-ра доставка: 20041338'),
        ('EUROPA', 11, 'europe', 'Fujitsu', '12KMCC', 'E001952-', 'E021313', '2022-06-16'::date, 'БУЛКЛИМА', '20041338', 1037.0::numeric(10,2), 1037.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 11 · доставчик: БУЛКЛИМА · ф-ра доставка: 20041338'),
        ('EUROPA', 13, 'europe', 'Mitsubishi Electric', 'HR-35VF', '2E003767TR-', '2C058155TR', '2022-06-17'::date, 'БИТТЕЛ', '146621', 1122.0::numeric(10,2), 1122.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 13 · доставчик: БИТТЕЛ · ф-ра доставка: 146621'),
        ('EUROPA', 14, 'europe', 'Mitsubishi Heavy', '35 ZSP-W', '257201179CF-', '1936311289CE', '2022-06-17'::date, 'БИТТЕЛ', '146621', 1129.0::numeric(10,2), 1129.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 14 · доставчик: БИТТЕЛ · ф-ра доставка: 146621'),
        ('EUROPA', 15, 'europe', 'Daikin', 'FTXF 35', 'T013902-', 'T051270', '2022-06-23'::date, 'БИТТЕЛ', '147009', 1183.0::numeric(10,2), 1183.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 15 · доставчик: БИТТЕЛ · ф-ра доставка: 147009'),
        ('EUROPA', 16, 'europe', 'Daikin', 'FTXP 35', 'T072810-', 'T082388', '2022-06-23'::date, 'БИТТЕЛ', '147009', 1462.0::numeric(10,2), 1462.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 16 · доставчик: БИТТЕЛ · ф-ра доставка: 147009'),
        ('EUROPA', 17, 'europe', 'Daikin', 'FTXM 35', 'T129211-', 'T071018', '2022-06-23'::date, 'БИТТЕЛ', '147013', 1960.0::numeric(10,2), 1960.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 17 · доставчик: БИТТЕЛ · ф-ра доставка: 147013'),
        ('EUROPA', 18, 'europe', 'Daikin', 'FTXC 35', 'K074670-', 'K083505', '2022-06-23'::date, 'БИТТЕЛ', '147013', 883.0::numeric(10,2), 883.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 18 · доставчик: БИТТЕЛ · ф-ра доставка: 147013'),
        ('EUROPA', 19, 'europe', 'Mitsubishi Electric', 'FH 35', '2000239T-', '1000527T', '2022-06-30'::date, 'БИТТЕЛ', '147529', 2200.0::numeric(10,2), 2200.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 19 · доставчик: БИТТЕЛ · ф-ра доставка: 147529'),
        ('EUROPA', 20, 'europe', 'Mitsubishi Heavy', 'ZSP 35', '154838254CF', '193631430CE', '2022-07-05'::date, 'БИТТЕЛ', '147858', 1130.0::numeric(10,2), 1130.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 20 · доставчик: БИТТЕЛ · ф-ра доставка: 147858'),
        ('EUROPA', 23, 'europe', 'Gree', '09 ФЕРИ ЧЕРНО', '4M75620004239', '4M75720002432', '2022-08-22'::date, 'БИТТЕЛ', '151411', 987.0::numeric(10,2), 1320.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 23 · доставчик: БИТТЕЛ · ф-ра доставка: 151411'),
        ('EUROPA', 24, 'europe', 'Gree', '09 ФЕРИ ЧЕРНО', '4M75620004230', '4M75720002416', '2022-08-22'::date, 'БИТТЕЛ', '151411', 987.0::numeric(10,2), 1320.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 24 · доставчик: БИТТЕЛ · ф-ра доставка: 151411'),
        ('EUROPA', 25, 'europe', 'Gree', '09 ФЕРИ ЧЕРНО', '4M75620004221', '4M75720002392', '2022-08-22'::date, 'БИТТЕЛ', '151411', 987.0::numeric(10,2), 1320.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 25 · доставчик: БИТТЕЛ · ф-ра доставка: 151411'),
        ('EUROPA', 26, 'europe', 'Gree', '24 КОЛОНА', '6385210000978', '6385111002108', '2022-08-25'::date, 'БИТТЕЛ', '151763', 2983.0::numeric(10,2), 4000.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 26 · доставчик: БИТТЕЛ · ф-ра доставка: 151763'),
        ('EUROPA', 29, 'europe', 'Mitsubishi Heavy', '35 ZS-W', '246616875CF', '286728087CE', '2022-10-26'::date, 'БИТТЕЛ', '156987', 1532.0::numeric(10,2), 1532.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 29 · доставчик: БИТТЕЛ · ф-ра доставка: 156987'),
        ('EUROPA', 30, 'europe', 'Arielli', 'AAC-09CH2XA71-I', '1Z477NM400ZM40100872', '1Z605WM400ZM40100757', '2022-10-27'::date, 'МАГНУМ-Д', '3216445', 520.0::numeric(10,2), 520.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 30 · доставчик: МАГНУМ-Д · ф-ра доставка: 3216445'),
        ('EUROPA', 32, 'europe', 'Toshiba', '13 ЕЙЧ', '22600611', '42501589', '2022-11-11'::date, 'БИТТЕЛ', '158460', 1512.0::numeric(10,2), 1512.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 32 · доставчик: БИТТЕЛ · ф-ра доставка: 158460'),
        ('EUROPA', 33, 'europe', 'Toshiba', '13 ЕЙЧ', '22701224-', '42501595', '2022-11-11'::date, 'БИТТЕЛ', '158460', 1512.0::numeric(10,2), 1512.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 33 · доставчик: БИТТЕЛ · ф-ра доставка: 158460'),
        ('EUROPA', 34, 'europe', 'Fujitsu', '12 LMCE', 'Е231220', 'Е135865', '2022-11-16'::date, 'ТЕРМОКЛИМА', '12178', 1200.0::numeric(10,2), 1200.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 34 · доставчик: ТЕРМОКЛИМА · ф-ра доставка: 12178'),
        ('EUROPA', 35, 'europe', 'Fujitsu', '12KG', 'T002921-', 'E012201', '2022-12-29'::date, 'БУЛКЛИМА', '20047546', 1613.0::numeric(10,2), 1613.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 35 · доставчик: БУЛКЛИМА · ф-ра доставка: 20047546'),
        ('EUROPA', 36, 'europe', 'Fujitsu', '12KV ПОДОВ', 'E101274', 'E000872', '2022-12-29'::date, 'БУЛКЛИМА', '20047546', 2723.0::numeric(10,2), 2723.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 36 · доставчик: БУЛКЛИМА · ф-ра доставка: 20047546'),
        ('EUROPA', 40, 'europe', 'Daikin', 'FTXC35', 'K127850', 'K126540', '2023-05-12'::date, 'БИТТЕЛ', '170817', 1030.0::numeric(10,2), 1030.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 40 · доставчик: БИТТЕЛ · ф-ра доставка: 170817'),
        ('EUROPA', 41, 'europe', 'Mitsubishi Electric', 'FH35', '2001672T', '2001566T', '2023-06-30'::date, 'БИТТЕЛ', '174321', 2312.0::numeric(10,2), 2312.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 41 · доставчик: БИТТЕЛ · ф-ра доставка: 174321'),
        ('EUROPA', 45, 'europe', 'Daikin', 'FTXM35', 'T201711', 'T160789', '2023-09-26'::date, 'БИТТЕЛ', '182470', 2115.0::numeric(10,2), 2115.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 45 · доставчик: БИТТЕЛ · ф-ра доставка: 182470'),
        ('EUROPA', 50, 'europe', 'Fujitsu', '12KP', 'E027371', 'E079254', '2024-07-15'::date, 'БУЛКЛИМА', '20060155', 980.0::numeric(10,2), 980.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 50 · доставчик: БУЛКЛИМА · ф-ра доставка: 20060155'),
        ('EUROPA', 93, 'europe', 'Nacional', '12 СИЛВЪР ЙОН', 'N00025', 'W00038', '2025-03-04'::date, 'БИТТЕЛ', '231134', 600.0::numeric(10,2), 600.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 93 · доставчик: БИТТЕЛ · ф-ра доставка: 231134'),
        ('EUROPA', 114, 'europe', 'Kaisai', '12 АЙС', 'K000504', 'K001907', '2025-05-28'::date, 'БУЛКЛИМА', '20068383', 836.0::numeric(10,2), 836.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 114 · доставчик: БУЛКЛИМА · ф-ра доставка: 20068383'),
        ('EUROPA', 115, 'europe', 'Mitsubishi Heavy', '35 ZSX', '445000677CF', '483302861CE', '2025-05-28'::date, 'БУЛКЛИМА', '20068383', 2385.0::numeric(10,2), 2385.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 115 · доставчик: БУЛКЛИМА · ф-ра доставка: 20068383'),
        ('EUROPA', 116, 'europe', 'Kaisai', '12 ПРО ХЕТ+', 'K003821', 'K003683', '2025-05-28'::date, 'БУЛКЛИМА', '20068383', 904.0::numeric(10,2), 904.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 116 · доставчик: БУЛКЛИМА · ф-ра доставка: 20068383'),
        ('EUROPA', 144, 'europe', 'Daikin', '25 FTXF', 'T118738', 'T030214', '2025-06-12'::date, 'БИТТЕЛ', '239527', 1078.0::numeric(10,2), 1078.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 144 · доставчик: БИТТЕЛ · ф-ра доставка: 239527'),
        ('EUROPA', 164, 'europe', 'Condex', 'ЛЕОН', '540N277660145170130622', NULL::text, '2025-06-26'::date, 'КОНДЕКС', '100007777', 762.0::numeric(10,2), 762.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 164 · доставчик: КОНДЕКС · ф-ра доставка: 100007777'),
        ('EUROPA', 279, 'europe', 'Fujitsu', '12 LMCA', 'E172904', 'E119929', '2025-09-16'::date, 'БУЛКЛИМА', '20072023', 1161.0::numeric(10,2), 1161.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 279 · доставчик: БУЛКЛИМА · ф-ра доставка: 20072023'),
        ('EUROPA', 309, 'europe', 'Mitsubishi Heavy', '25ZS-ПОДОВ', '563801526CF', '542717509CE', '2025-10-10'::date, 'БИТТЕЛ', '253160', 2042.0::numeric(10,2), 2042.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 309 · доставчик: БИТТЕЛ · ф-ра доставка: 253160'),
        ('EUROPA', 312, 'europe', 'Mitsubishi Electric', 'AY35', '5E010242TR', '5C039189TR', '2025-10-16'::date, 'БИТТЕЛ', '253772', 1874.0::numeric(10,2), 1874.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 312 · доставчик: БИТТЕЛ · ф-ра доставка: 253772'),
        ('EUROPA', 327, 'europe', 'Daikin', '35 FTXP', 'T045359', 'T040419', '2025-11-03'::date, 'БИТТЕЛ', '255701', 1625.0::numeric(10,2), 1625.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 327 · доставчик: БИТТЕЛ · ф-ра доставка: 255701'),
        ('EUROPA', 330, 'europe', 'Kaisai', '12 ПРО ХИЙТ+', 'K000074', 'K005012', '2025-11-11'::date, 'БУЛКЛИМА', '20073637', 951.0::numeric(10,2), 951.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 330 · доставчик: БУЛКЛИМА · ф-ра доставка: 20073637'),
        ('EUROPA', 375, 'europe', 'Mitsubishi Heavy', '35ZSX', '545401120CF', '545502390CE', '2026-01-12'::date, 'КОНДЕКС', 'ПФ10086', 1263.0::numeric(10,2), 1263.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 375 · доставчик: КОНДЕКС · ф-ра доставка: ПФ10086'),
        ('EUROPA', 386, 'europe', 'Kaisai', '12 ПОДОВ', NULL::text, NULL::text, '2026-02-06'::date, 'БУЛКЛИМА', '20075511', 687.0::numeric(10,2), 687.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 386 · доставчик: БУЛКЛИМА · ф-ра доставка: 20075511'),
        ('EUROPA', 399, 'europe', 'Mitsubishi Heavy', '25 ПОДОВ', '563803315CF', '542725098CE', '2026-02-23'::date, 'БИТТЕЛ', '267248', 1044.0::numeric(10,2), 1044.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 399 · доставчик: БИТТЕЛ · ф-ра доставка: 267248'),
        ('EUROPA', 405, 'europe', 'Mitsubishi Heavy', '35 ZS', '542432302CF', '542860413CE', '2026-03-20'::date, 'КОНДЕКС', '100016598', 803.0::numeric(10,2), 803.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 405 · доставчик: КОНДЕКС · ф-ра доставка: 100016598'),
        ('EUROPA', 406, 'europe', 'Mitsubishi Heavy', '35 ZS', '542432298CF', '542857834CE', '2026-03-20'::date, 'КОНДЕКС', '100016598', 803.0::numeric(10,2), 803.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 406 · доставчик: КОНДЕКС · ф-ра доставка: 100016598'),
        ('EUROPA', 424, 'europe', 'Mitsubishi Electric', 'AY50', '5E007281TR', '50007183', '2026-03-23'::date, 'БИТТЕЛ', '269712', 1140.0::numeric(10,2), 1140.0::numeric(10,2), 'Импорт AERF склад, лист EUROPA ред 424 · доставчик: БИТТЕЛ · ф-ра доставка: 269712'),
        ('JAPAN', 2, 'japan', 'Toshiba', 'RAS-2212TM', NULL::text, NULL::text, '2025-02-03'::date, 'НТТ 3', '100002211', 1250.0::numeric(10,2), 2040.0::numeric(10,2), 'Импорт AERF склад, лист JAPAN ред 2 · доставчик: НТТ 3 · ф-ра доставка: 100002211'),
        ('JAPAN', 3, 'japan', 'Mitsubishi Electric', 'MSZ-GV2523', NULL::text, NULL::text, '2025-02-03'::date, 'НТТ 3', '100002211', 1529.0::numeric(10,2), 2480.0::numeric(10,2), 'Импорт AERF склад, лист JAPAN ред 3 · доставчик: НТТ 3 · ф-ра доставка: 100002211'),
        ('JAPAN', 4, 'japan', 'Mitsubishi Electric', 'MSZ-BXV2823', NULL::text, NULL::text, '2025-02-03'::date, 'НТТ 3', '100002211', 2150.0::numeric(10,2), 3300.0::numeric(10,2), 'Импорт AERF склад, лист JAPAN ред 4 · доставчик: НТТ 3 · ф-ра доставка: 100002211'),
        ('JAPAN', 5, 'japan', 'Mitsubishi Electric', 'MSZ-ZXV2523', NULL::text, NULL::text, '2025-02-03'::date, 'НТТ 3', '100002211', 3090.0::numeric(10,2), 4390.0::numeric(10,2), 'Импорт AERF склад, лист JAPAN ред 5 · доставчик: НТТ 3 · ф-ра доставка: 100002211'),
        ('JAPAN', 6, 'japan', 'Mitsubishi Electric', 'MFZ-K2822AS-ПОДОВ', NULL::text, NULL::text, '2025-02-03'::date, 'НТТ 3', '100002211', 3290.0::numeric(10,2), 4800.0::numeric(10,2), 'Импорт AERF склад, лист JAPAN ред 6 · доставчик: НТТ 3 · ф-ра доставка: 100002211'),
        ('JAPAN', 7, 'japan', 'Panasonic', 'CS-222DFL', NULL::text, NULL::text, '2025-02-03'::date, 'НТТ 3', '100002211', 1360.0::numeric(10,2), 2100.0::numeric(10,2), 'Импорт AERF склад, лист JAPAN ред 7 · доставчик: НТТ 3 · ф-ра доставка: 100002211'),
        ('JAPAN', 8, 'japan', 'Panasonic', 'CS-256CX', NULL::text, NULL::text, '2025-02-03'::date, 'НТТ 3', '100002211', 2550.0::numeric(10,2), 3700.0::numeric(10,2), 'Импорт AERF склад, лист JAPAN ред 8 · доставчик: НТТ 3 · ф-ра доставка: 100002211'),
        ('JAPAN', 9, 'japan', 'Daikin', 'S-28ZVV-ПОДОВ', NULL::text, NULL::text, '2025-02-03'::date, 'НТТ 3', '100002211', 3300.0::numeric(10,2), 4870.0::numeric(10,2), 'Импорт AERF склад, лист JAPAN ред 9 · доставчик: НТТ 3 · ф-ра доставка: 100002211'),
        ('JAPAN', 10, 'japan', 'Fujitsu', 'AS-C223N', NULL::text, NULL::text, '2025-02-03'::date, 'НТТ 3', '100002211', 1310.0::numeric(10,2), 2100.0::numeric(10,2), 'Импорт AERF склад, лист JAPAN ред 10 · доставчик: НТТ 3 · ф-ра доставка: 100002211'),
        ('JAPAN', 11, 'japan', 'Fujitsu', 'AS-J252M', NULL::text, NULL::text, '2025-02-03'::date, 'НТТ 3', '100002211', 1400.0::numeric(10,2), 2250.0::numeric(10,2), 'Импорт AERF склад, лист JAPAN ред 11 · доставчик: НТТ 3 · ф-ра доставка: 100002211')
    ) AS stage(
      sheet_name, sheet_row, product_region, brand_name, model,
      indoor_serial, outdoor_serial, purchase_date, supplier,
      purchase_invoice, purchase_price, list_price, description
    )
    ORDER BY sheet_name, sheet_row
  LOOP
    v_product_id := NULL;
    v_slug := 'aerf-stock-' || lower(r.sheet_name) || '-' || r.sheet_row;
    v_desc := r.description;
    v_price := coalesce(r.list_price, r.purchase_price, 0);

    IF EXISTS (SELECT 1 FROM public.products WHERE slug = v_slug) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.products WHERE description LIKE 'Импорт AERF склад, лист ' || r.sheet_name || ' ред ' || r.sheet_row || '%') THEN
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
      RAISE WARNING 'AERF stock % row %: липсва марка %', r.sheet_name, r.sheet_row, r.brand_name;
      CONTINUE;
    END IF;

    v_name := r.brand_name || ' ' || coalesce(nullif(btrim(r.model), ''), 'климатик');

    INSERT INTO public.products (
      slug, name, brand_id, type_id, model_code, description, price, purchase_price,
      indoor_unit_serial, outdoor_unit_serial, supplier_invoice_number, purchased_at,
      product_condition, product_region, stock_status, stock_quantity, sold_quantity,
      is_active, show_in_public_catalog
    ) VALUES (
      v_slug, v_name, v_brand_id, v_type_id, nullif(btrim(r.model), ''), v_desc,
      v_price, r.purchase_price,
      nullif(btrim(r.indoor_serial), ''), nullif(btrim(r.outdoor_serial), ''),
      nullif(btrim(r.purchase_invoice), ''), r.purchase_date,
      'new', r.product_region, 'in_stock', 1, 0, false, false
    );
    v_imported := v_imported + 1;
  END LOOP;

  RAISE NOTICE 'AERF stock import: imported=%, skipped(existing)=%', v_imported, v_skipped;
END
$import$;
