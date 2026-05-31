-- =====================================================================
-- Seed: Исторически продажби „втора употреба“ от Klimatici 2022.xlsx
-- =====================================================================
-- Редове: 123
-- Продукти: product_condition = used
-- Идемпотентност: notes LIKE 'Импорт Klimatici2022 VTORA, лист % ред N'
-- Rollback: seeds/0012_rollback_klimatici2022_used_sales.sql
-- ВАЖНО: Един DO блок — пусни целия файл (Ctrl+A → Run).
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
  v_note text;
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
        ('Toshiba вън', 2, 'Toshiba', 'g401e2r', 'g401e2r', 'g401e2ar', '2023-02-20'::date, 2000.0::numeric(10,2), 'ДИНКО', '0878 584 433', NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 2'),
        ('Toshiba вън', 3, 'Toshiba', '2512arks', '2512arks', '2512arks', '2023-07-21'::date, 1000.0::numeric(10,2), 'СЕРГО', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 3'),
        ('Toshiba вън', 4, 'Toshiba', '221ur', '221ur', '221uar', '2023-12-21'::date, 1500.0::numeric(10,2), 'ТОДОР КОВАЧЕВ', '0894 720 234', NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 4'),
        ('Toshiba вън', 6, 'Toshiba', '281edrs', '281edrs', '281eadr', '2023-07-18'::date, 1600.0::numeric(10,2), 'НИКОЛАЙ РАЙЧЕВ', '0898 308 350', NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 6'),
        ('Toshiba вън', 8, 'Toshiba', '221b', '221b', '221ab', '2022-10-27'::date, 1300.0::numeric(10,2), 'ВАСКО УЗУНОВ', '0878 662 122', NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 8'),
        ('Toshiba вън', 9, 'Toshiba', '2210d', '2210d', '2210ad', '2022-11-28'::date, 1300.0::numeric(10,2), 'ЙОРДАН ДИМИТРОВ', '0896 899 057', NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 9'),
        ('Toshiba вън', 10, 'Toshiba', '221edx', '221edx', '221eadx', '2023-08-22'::date, 1300.0::numeric(10,2), 'МАРИАНА ЕМИРСКА', '0877 886 201', NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 10'),
        ('Toshiba вън', 11, 'Toshiba', '281pdr', '281pdr', '251badr', '2023-07-25'::date, 1300.0::numeric(10,2), 'РАДКО ШУКЕРОВ', '0878 695 234', NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 11'),
        ('Toshiba вън', 12, 'Toshiba', '401pd', '401pd', '401pad', '2023-02-14'::date, 0.0::numeric(10,2), 'САШО', '0895 757 572', NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 12'),
        ('Toshiba вън', 13, 'Toshiba', '4020d', '4020d', '4020ad', '2023-10-16'::date, 1750.0::numeric(10,2), 'АНГЕЛ ПРИНЦА', '0889 327 227', NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 13'),
        ('Toshiba вън', 15, 'Toshiba', '2514d', '2514d', '2514ad', '2023-10-05'::date, 1400.0::numeric(10,2), 'БОЙКО ЧЕЛЕБИЕВ', '0877 525 227', NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 15'),
        ('Toshiba вън', 16, 'Toshiba', '2556d', '2556d', '2556ad', '2022-10-21'::date, 1300.0::numeric(10,2), 'Силвия Далипова Кина', '0897 633 486', NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 16'),
        ('Toshiba вън', 17, 'Toshiba', '221UR', '221UR', '221UAR', '2023-07-25'::date, 1300.0::numeric(10,2), 'РАДКО ШУКЕРОВ', '0878 695 234', NULL::text, 'Импорт Klimatici2022 VTORA, лист Toshiba вън ред 17'),
        ('Daikin вън', 2, 'Daikin', 'f25htns', 'f25htns', 'r28hns', '2022-12-14'::date, 1300.0::numeric(10,2), 'МАРИЯН', '0879 966 363', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 2'),
        ('Daikin вън', 3, 'Daikin', 'an28lrs', 'an28lrs', 'ar28lrs', '2022-11-22'::date, 2000.0::numeric(10,2), 'РОСЕН МАДАН +359 89 7949920', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 3'),
        ('Daikin вън', 4, 'Daikin', 'f25htns', 'f25htns', 'r28hns', '2022-11-14'::date, 1500.0::numeric(10,2), 'ГАМАКАБЕЛ ФИЛИП НОНОВ', '0887 581 669', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 4'),
        ('Daikin вън', 6, 'Daikin', 'ate22lse7', 'ate22lse7', 'are22ls', '2023-02-24'::date, 1200.0::numeric(10,2), 'ВАЛЬО ХАДЖИЕВ', '0889 513 247', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 6'),
        ('Daikin вън', 8, 'Daikin', 'f28htus', 'f28htus', 'r28hns', '2024-06-11'::date, 1500.0::numeric(10,2), 'АСЕН КЕХАЙОВ', '0876 505 067', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 8'),
        ('Daikin вън', 9, 'Daikin', 'f22ntes', 'f22ntes', 'r22nes', '2022-10-19'::date, 1200.0::numeric(10,2), 'МАРИЯН', '0879 966 363', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 9'),
        ('Daikin вън', 10, 'Daikin', 'f28htns', 'f28htns', 'r28hns', '2022-12-14'::date, 1500.0::numeric(10,2), 'МАРИЯН', '0879 966 363', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 10'),
        ('Daikin вън', 11, 'Daikin', 'f28ltes', 'f28ltes', 'r28les', '2023-02-24'::date, 1300.0::numeric(10,2), 'ВАЛЬО ХАДЖИЕВ', '0889 513 247', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 11'),
        ('Daikin вън', 12, 'Daikin', 'f28ntes', 'f28ntes', 'r28nes', '2023-03-12'::date, 1500.0::numeric(10,2), 'РАЙЧО МРЪВКОВ', '0879 992 997', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 12'),
        ('Daikin вън', 13, 'Daikin', 'an63nsp', 'an63nsp', 'ar63nsp', '2023-03-12'::date, 2500.0::numeric(10,2), 'РАЙЧО МРЪВКОВ', '0879 992 997', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 13'),
        ('Daikin вън', 14, 'Daikin', 'f56step', 'f56step', 'r56sep', '2022-10-24'::date, 2200.0::numeric(10,2), 'ТОШО СИРАКОВ', '0879 629 990', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 14'),
        ('Daikin вън', 15, 'Daikin', 'atn25hse', 'atn25hse', 'arn25hs', '2022-11-28'::date, 1400.0::numeric(10,2), 'БОРИСЛАВ АЛЬОВ', '0898 532 210', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 15'),
        ('Daikin вън', 16, 'Daikin', 'f28ptes', 'f28ptes', 'r28pes', '2023-01-26'::date, 1800.0::numeric(10,2), 'МИНКА ШЕМШИРОВА', '0878 652 094', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 16'),
        ('Daikin вън', 17, 'Daikin', 'f25mtes', 'f25mtes', 'r25mes', '2022-10-01'::date, 1300.0::numeric(10,2), 'Галя', '0878 955 581', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 17'),
        ('Daikin вън', 18, 'Daikin', 'f22ntes', 'f22ntes', 'r22nes', '2022-10-19'::date, 1200.0::numeric(10,2), 'МАРИЯН', '0879 966 363', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 18'),
        ('Daikin вън', 19, 'Daikin', 'an36mebbs', 'an36mebbs', 'ar36mebbs', '2022-11-22'::date, 1600.0::numeric(10,2), 'РОСЕН МАДАН', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 19'),
        ('Daikin вън', 21, 'Daikin', 'f36ltes', 'f36ltes', 'r36les', '2023-02-24'::date, 1300.0::numeric(10,2), 'ВАЛЬО ХАДЖИЕВ', '0889 513 247', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 21'),
        ('Daikin вън', 22, 'Daikin', 'f28mtes', 'f28mtes', 'r28mes', '2024-11-12'::date, 1400.0::numeric(10,2), 'БОЙКО ЧЕЛЕБИЕВ', '0877 525 227', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 22'),
        ('Daikin вън', 23, 'Daikin', 'f25htns', 'f25htns', NULL::text, '2023-10-11'::date, 1100.0::numeric(10,2), 'ПЛАМЕНА СЛАВОВА СТАРА ЗАГОРА', '0896 506 530', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 23'),
        ('Daikin вън', 24, 'Daikin', 'F28PTES', 'F28PTES', NULL::text, '2023-12-08'::date, 1600.0::numeric(10,2), 'ГЕОРГИ ЛАКУДОВ', '0895 458 875', NULL::text, 'Импорт Klimatici2022 VTORA, лист Daikin вън ред 24'),
        ('Mitsubishi вън', 2, 'Mitsubishi Electric', 'ge2817', 'ge2817', 'g2817', '2023-04-25'::date, 1400.0::numeric(10,2), 'САШО СЕКУЛОВ', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 2'),
        ('Mitsubishi вън', 3, 'Mitsubishi Electric', 'hm361', 'hm361', 'hm361', '2023-05-03'::date, 2200.0::numeric(10,2), 'ЮЛИЯН КОМИТОВ', '0884 980 810', NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 3'),
        ('Mitsubishi вън', 5, 'Mitsubishi Electric', 'sj28t', 'sj28t', 'sj28t', '2025-05-22'::date, 1400.0::numeric(10,2), 'МАРИЯ ПОПИНСКА', '0898 555 347', 'ДЕВИН', 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 5'),
        ('Mitsubishi вън', 6, 'Mitsubishi Electric', 'sv36t', 'sv36t', 'sv36t', '2023-11-08'::date, 1600.0::numeric(10,2), 'АЧО', '0878 357 918', NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 6'),
        ('Mitsubishi вън', 7, 'Mitsubishi Electric', 'gm282', 'gm282', 'gm282', '2023-10-17'::date, 1600.0::numeric(10,2), 'АГЛИКА КАМЕНОВА', '0895 666 756', NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 7'),
        ('Mitsubishi вън', 8, 'Mitsubishi Electric', 'j227', 'j227', 'j227', '2023-07-21'::date, 0.0::numeric(10,2), 'МИЛКО САНЕВ', '0878 266 766', NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 8'),
        ('Mitsubishi вън', 10, 'Mitsubishi Electric', 'zxv507s', 'zxv507s', 'zxv507s', '2024-01-08'::date, 71.0::numeric(10,2), 'ВЕНЦИСЛАВ УЗУНОВ', '0893 627 361', NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 10'),
        ('Mitsubishi вън', 11, 'Mitsubishi Electric', 'axv283s', 'axv283s', 'axv283s', '2024-07-31'::date, 1400.0::numeric(10,2), 'МИТКО МАЗАРА', '0889 902 286', NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 11'),
        ('Mitsubishi вън', 12, 'Mitsubishi Electric', 'j288', 'j288', 'j288,', '2023-06-21'::date, 1400.0::numeric(10,2), 'МАНОЛ ГВОЗДЕВ', '0888 304 872', NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 12'),
        ('Mitsubishi вън', 13, 'Mitsubishi Electric', 'sv40ts', 'sv40ts', 'sv40ts', NULL::date, 1400.0::numeric(10,2), 'КУЗМАН', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 13'),
        ('Mitsubishi вън', 14, 'Mitsubishi Electric', 'zw563s', 'zw563s', 'zw563s', '2022-10-03'::date, 2500.0::numeric(10,2), 'МИТКО ДЕВИН', '0888 088 696', NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 14'),
        ('Mitsubishi вън', 15, 'Mitsubishi Electric', 'zxv713s', 'zxv713s', 'zxv713s', '2024-07-26'::date, 2500.0::numeric(10,2), 'САШО СЕКУЛОВ', '0888 772 422', NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 15'),
        ('Mitsubishi вън', 17, 'Mitsubishi Electric', 'jxv407s', 'jxv407s', 'jxv407s', '2023-05-03'::date, 2300.0::numeric(10,2), 'ЮЛИЯН КОМИТОВ', '0884 980 810', NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 17'),
        ('Mitsubishi вън', 18, 'Mitsubishi Electric', 'zw40ts', 'zw40ts', 'zw40ts', '2023-09-04'::date, 2050.0::numeric(10,2), 'МИРО КРИС-ТМ МАДАН', '0887 422 424', NULL::text, 'Импорт Klimatici2022 VTORA, лист Mitsubishi вън ред 18'),
        ('Nacional Вън', 2, 'Nacional', '257tb', '257tb', '257tb', '2022-11-08'::date, 1300.0::numeric(10,2), 'МИЛЕН ОГНЯНОВ', '0887 566 607', NULL::text, 'Импорт Klimatici2022 VTORA, лист Nacional Вън ред 2'),
        ('Nacional Вън', 3, 'Nacional', 'ax286a', 'ax286a', 'ax286a', '2023-04-05'::date, 1200.0::numeric(10,2), 'АСЕН', '0876 505 067', NULL::text, 'Импорт Klimatici2022 VTORA, лист Nacional Вън ред 3'),
        ('Nacional Вън', 4, 'Nacional', '286tb', '286tb', '286tb', '2023-09-27'::date, 1500.0::numeric(10,2), 'ДОНА КЕЛЕВСКА 030180656', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Nacional Вън ред 4'),
        ('Nacional Вън', 5, 'Nacional', '40rfxz', '40rfxz', '40rfx', '2023-08-14'::date, 1900.0::numeric(10,2), 'АНГЕЛ ПРИНЦА', '0889 327 227', NULL::text, 'Импорт Klimatici2022 VTORA, лист Nacional Вън ред 5'),
        ('Nacional Вън', 6, 'Nacional', '286tb', '286tb', '286tb', '2023-07-01'::date, 1300.0::numeric(10,2), 'РУМЕН БЕЧЕВ', '0876 787 656', NULL::text, 'Импорт Klimatici2022 VTORA, лист Nacional Вън ред 6'),
        ('Nacional Вън', 10, 'Nacional', '1', '1', '22', NULL::date, 0.0::numeric(10,2), 'Николай Сираков', '0894 768 869', NULL::text, 'Импорт Klimatici2022 VTORA, лист Nacional Вън ред 10'),
        ('Panasonic вън', 2, 'Panasonic', 'f254c', 'f254c', 'f254c', '2023-08-08'::date, 1400.0::numeric(10,2), 'СЕБИХА АЛИАГОВА ВЪРБИНА', '0895 083 245', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 2'),
        ('Panasonic вън', 5, 'Panasonic', 'ex285c', 'ex285c', 'ex285c', '2023-03-20'::date, 1600.0::numeric(10,2), 'МИНКА ЧЕРНЕВА', '0879 330 626', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 5'),
        ('Panasonic вън', 7, 'Panasonic', '28rkh', '28rkh', 'h289a', '2025-02-14'::date, 1600.0::numeric(10,2), 'Лефтер', '0885 633 765', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 7'),
        ('Panasonic вън', 8, 'Panasonic', '283cfr', '283cfr', 'f283c', '2022-11-14'::date, 1400.0::numeric(10,2), 'САШО ПАШОВ', '0877 487 844', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 8'),
        ('Panasonic вън', 9, 'Panasonic', '28bke', '28bke', '28bke', '2022-12-08'::date, 1500.0::numeric(10,2), 'ПЕТКО ЧОНГАРОВ', '0879 284 056', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 9'),
        ('Panasonic вън', 10, 'Panasonic', 'j227c', 'j227c', 'j227c', '2022-10-21'::date, 1400.0::numeric(10,2), 'КОЦЕ И ЛЮСИ', '0889 141 941', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 10'),
        ('Panasonic вън', 11, 'Panasonic', '281cf', '281cf', '281cf', '2022-11-09'::date, 1300.0::numeric(10,2), 'ЕВГЕНИ МАДАН', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 11'),
        ('Panasonic вън', 13, 'Panasonic', '281cf', '281cf', '281cf', '2023-02-02'::date, 1200.0::numeric(10,2), 'ЕВГЕНИ МАДАН', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 13'),
        ('Panasonic вън', 17, 'Panasonic', '22mze8', '22mze8', '22mze8', '2023-04-11'::date, 1200.0::numeric(10,2), 'ДАНЧО ЕСКОМ', '0878 730 303', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 17'),
        ('Panasonic вън', 18, 'Panasonic', '222cf', '222cf', '222cf', '2024-06-25'::date, 700.0::numeric(10,2), 'АНДРЕЙ ЛИСОВ', '0887 673 369', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 18'),
        ('Panasonic вън', 19, 'Panasonic', '403cfr2', '403cfr2', 'f403c2', '2023-07-31'::date, 1700.0::numeric(10,2), 'СЛАВИ КОЧМАРОВ', '0878 930 223', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 19'),
        ('Panasonic вън', 20, 'Panasonic', '284cfr', '284cfr', 'f284c', '2023-09-05'::date, 1350.0::numeric(10,2), 'МИРО КРИС-ТМ', '0887 422 424', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 20'),
        ('Panasonic вън', 22, 'Panasonic', 'ex280c', 'ex280c', 'ex280c', '2023-02-07'::date, 1600.0::numeric(10,2), 'ХРИСТО СТОЯНОВ', '0877 806 460', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 22'),
        ('Panasonic вън', 24, 'Panasonic', '40ble', '40ble', '40ble', '2024-08-14'::date, 2000.0::numeric(10,2), 'РОСЕН МАДАН', '0897 949 920', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 24'),
        ('Panasonic вън', 26, 'Panasonic', '400cfr', '400cfr', 'f400c2', '2023-10-16'::date, 1750.0::numeric(10,2), 'АНГЕЛ ПРИНЦА', '0889 327 227', NULL::text, 'Импорт Klimatici2022 VTORA, лист Panasonic вън ред 26'),
        ('Fujitsu Вън', 2, 'Fujitsu', 'e368h', 'e368h', 'e368', '2022-12-13'::date, 2000.0::numeric(10,2), 'БОРИСЛАВ ЧИЛИНГИРОВ', '0878 306 888', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 2'),
        ('Fujitsu Вън', 3, 'Fujitsu', 'a401h', 'a401h', 'a401', '2023-01-03'::date, 0.0::numeric(10,2), 'КРАСИМИР ГОВЕДАРОВ', '0878 566 628', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 3'),
        ('Fujitsu Вън', 6, 'Fujitsu', 'r28e', 'r28e', 'r28e', '2023-04-25'::date, 1000.0::numeric(10,2), 'КЪЦИ', '0887 973 896', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 6'),
        ('Fujitsu Вън', 7, 'Fujitsu', 'v28w', 'v28w', 'v28w', '2023-08-12'::date, 1300.0::numeric(10,2), 'ВАНКАТА', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 7'),
        ('Fujitsu Вън', 8, 'Fujitsu', 'e22s', 'e22s', 'e22s', '2022-12-08'::date, 1300.0::numeric(10,2), 'МАРИЯ КОВАЧЕВА', '0878 219 159', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 8'),
        ('Fujitsu Вън', 9, 'Fujitsu', 'r40a', 'r40a', 'r40a', '2023-03-27'::date, 1800.0::numeric(10,2), 'АТАНАС КИСЬОВ', '0886 303 586', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 9'),
        ('Fujitsu Вън', 12, 'Fujitsu', 'j22b', 'j22b', 'j22b', '2023-01-03'::date, 0.0::numeric(10,2), 'КРАСИМИР ГОВЕДАРОВ', '0878 566 628', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 12'),
        ('Fujitsu Вън', 13, 'Fujitsu', 'r40h', 'r40h', 'r40a', '2023-08-24'::date, 2000.0::numeric(10,2), 'МАРИЯ ЛОЙТОВА', '+306992657614', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 13'),
        ('Fujitsu Вън', 14, 'Fujitsu', 'e25r', 'e25r', 'e25r', '2023-01-03'::date, 0.0::numeric(10,2), 'КРАСИМИР ГОВЕДАРОВ', '0878 566 628', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 14'),
        ('Fujitsu Вън', 15, 'Fujitsu', 'e50t', 'e50t', 'e50t', '2022-10-27'::date, 2000.0::numeric(10,2), 'ВЕСЕЛИН БАШЕВ', '0876 860 097', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 15'),
        ('Fujitsu Вън', 16, 'Fujitsu', 'j40s', 'j40s', 'j40s', '2022-10-27'::date, 2000.0::numeric(10,2), 'РОСЕН УВАЛИЕВ', '0878 511 919', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 16'),
        ('Fujitsu Вън', 17, 'Fujitsu', 'r25f', 'r25f', 'r25f', '2023-04-25'::date, 1000.0::numeric(10,2), 'КЪЦИ', '0887 973 896', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 17'),
        ('Fujitsu Вън', 18, 'Fujitsu', 'r28j', 'r28j', 'r28j', NULL::date, 750.0::numeric(10,2), 'ВЕСО', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 18'),
        ('Fujitsu Вън', 21, 'Fujitsu', 'e258h', 'e258h', 'e258', '2023-10-24'::date, 1400.0::numeric(10,2), 'ФЕХРИ АДЕМОВ', '0878 236 569', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 21'),
        ('Fujitsu Вън', 22, 'Fujitsu', 'e258h', 'e258h', 'e258', '0204-01-23'::date, 1500.0::numeric(10,2), 'КРАСИМИР ПАНОВ ДАВИДКОВО', '0899 166 245', NULL::text, 'Импорт Klimatici2022 VTORA, лист Fujitsu Вън ред 22'),
        ('Hitachi Вън', 4, 'Hitachi', 'l22je5', 'l22je5', 'l22ge5', '2022-11-04'::date, 1300.0::numeric(10,2), 'РАДОСЛАВ МИЛУШЕВ', '0878 259 075', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 4'),
        ('Hitachi Вън', 6, 'Hitachi', 'aj36h', 'aj36h', 'aj36h', '2023-09-06'::date, 1550.0::numeric(10,2), 'МИРО КРИС-ТМ МАДАН', '0887 422 424', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 6'),
        ('Hitachi Вън', 7, 'Hitachi', 'aj36a', 'aj36a', 'aj36a', '2022-10-17'::date, 1700.0::numeric(10,2), 'НАСКО ПОПОВ', '0878 256 601', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 7'),
        ('Hitachi Вън', 8, 'Hitachi', 'aj28f', 'aj28f', 'aj28f', '2022-12-06'::date, 0.0::numeric(10,2), 'МИЛКО', '0878 239 006', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 8'),
        ('Hitachi Вън', 9, 'Hitachi', 'l28ge5', 'l28ge5', 'l28ge5', '2023-03-17'::date, 1500.0::numeric(10,2), 'ИСМЕТ ХАЛИЛ', '0893 667 382', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 9'),
        ('Hitachi Вън', 10, 'Hitachi', 's28y', 's28y', 's28y', '2022-11-22'::date, 1800.0::numeric(10,2), 'АГЛИКА КАМЕНОВА 1800 ЛВ', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 10'),
        ('Hitachi Вън', 11, 'Hitachi', 'ae28a', 'ae28a', 'ae28a', '2023-08-09'::date, 1750.0::numeric(10,2), 'СИЛВИ БАНЖОВ', '0893 380 938', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 11'),
        ('Hitachi Вън', 12, 'Hitachi', 'as28a', 'as28a', 'as28a', '2025-07-10'::date, 1600.0::numeric(10,2), 'Таня Златоград', '0894 720 234', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 12'),
        ('Hitachi Вън', 13, 'Hitachi', 'r28z', 'r28z', 'r28z', '2023-01-24'::date, 1100.0::numeric(10,2), 'МИРО', '0878 461 155', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 13'),
        ('Hitachi Вън', 14, 'Hitachi', 'mf28x', 'mf28x', 'mf28x', '2023-04-11'::date, 1500.0::numeric(10,2), 'ДАНЧО ЕСКОМ', '0878 730 303', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 14'),
        ('Hitachi Вън', 15, 'Hitachi', 's40z2', 's40z2', 's40z2', '2023-08-07'::date, 1800.0::numeric(10,2), 'ТОДОР КИСЬОВ', '0899 829 338', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 15'),
        ('Hitachi Вън', 16, 'Hitachi', 'aj28b', 'aj28b', 'aj28b', '2022-10-27'::date, 1500.0::numeric(10,2), 'АЛЕКСАНДЪР', '0894 511 089', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 16'),
        ('Hitachi Вън', 17, 'Hitachi', 'aj28b', 'aj28b', 'aj28b', '2022-10-27'::date, 1500.0::numeric(10,2), 'АЛЕКСАНДЪР', '0894 511 089', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 17'),
        ('Hitachi Вън', 18, 'Hitachi', 'aj36a', 'aj36a', 'aj36a', '2023-06-14'::date, 1700.0::numeric(10,2), 'ЕВГЕНИ МРЪВКОВ', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 18'),
        ('Hitachi Вън', 19, 'Hitachi', 'm28a', 'm28a', 'm28a', '2023-08-09'::date, 1750.0::numeric(10,2), 'СИЛВИ БАНЖОВ', '0893 380 938', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 19'),
        ('Hitachi Вън', 20, 'Hitachi', 'aj28z', 'aj28z', 'aj28z', '2023-05-02'::date, 1500.0::numeric(10,2), 'АЛЕКСАНДЪР КИЧУКОВ', '0896 118 484', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 20'),
        ('Hitachi Вън', 21, 'Hitachi', 'mf28x', 'mf28x', 'mf28x', '2024-07-31'::date, 28.0::numeric(10,2), 'АГЛИКА КАМЕНОВА', '0895 666 756', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 21'),
        ('Hitachi Вън', 23, 'Hitachi', 'as28b', 'as28b', 'as28b', '2023-05-02'::date, 1400.0::numeric(10,2), 'АЛЕКСАНДЪР КИЧУКОВ', '0896 118 484', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 23'),
        ('Hitachi Вън', 25, 'Hitachi', 'aj40d2', 'aj40d2', 'aj40d2', '2022-11-29'::date, 1500.0::numeric(10,2), 'ЕКОНТ', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 25'),
        ('Hitachi Вън', 26, 'Hitachi', 'w40f2', 'w40f2', 'w40f', '2023-03-17'::date, 1800.0::numeric(10,2), 'НАТАЛИЯ', '0898 583 191', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 26'),
        ('Hitachi Вън', 27, 'Hitachi', 'sx40z2', 'sx40z2', 'zx40z2', '2023-06-19'::date, 2000.0::numeric(10,2), 'ЗДРАВКО РЪЖЕНИКОВ', '0887 561 693', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 27'),
        ('Hitachi Вън', 28, 'Hitachi', 's63z2', 's63z2', 's63z2', '2022-10-27'::date, 2500.0::numeric(10,2), 'АЛЕКСАНДЪР', '0894 511 089', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 28'),
        ('Hitachi Вън', 29, 'Hitachi', 'aj25c', 'aj25c', 'aj25c', '2023-05-02'::date, 1500.0::numeric(10,2), 'АЛЕКСАНДЪР КИЧУКОВ', '0896 118 484', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 29'),
        ('Hitachi Вън', 30, 'Hitachi', 'aj56hb', 'aj56hb', 'aj56h2', '2022-10-30'::date, 1700.0::numeric(10,2), 'КУЗМА', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 30'),
        ('Hitachi Вън', 31, 'Hitachi', 's56c2', 's56c2', 's56c', '2022-11-04'::date, 2400.0::numeric(10,2), 'РАДОСЛАВ МИЛУШЕВ', '0878 259 075', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 31'),
        ('Hitachi Вън', 32, 'Hitachi', 'ajl56c2', 'ajl56c2', 'ajl56c', '2023-01-25'::date, 2000.0::numeric(10,2), 'РАЙЧО АРЪЧКОВ', NULL::text, NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 32'),
        ('Hitachi Вън', 33, 'Hitachi', 'x40z2', 'x40z2', 'x40z2', '2022-12-06'::date, 0.0::numeric(10,2), 'МИЛКО', '0878 239 006', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 33'),
        ('Hitachi Вън', 34, 'Hitachi', 's63w2', 's63w2', 's63w', '2022-09-23'::date, 2000.0::numeric(10,2), 'Гамакабел Филип Нинов', '0887 581 669', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 34'),
        ('Hitachi Вън', 35, 'Hitachi', 'SX28Z', 'SX28Z', 'AS28B', '2023-08-07'::date, 1700.0::numeric(10,2), 'ТОДОР КИСЬОВ', '0899 829 338', NULL::text, 'Импорт Klimatici2022 VTORA, лист Hitachi Вън ред 35'),
        ('Sharp Вън', 4, 'Sharp', 'b28de9', 'b28de9', 'b28dey', '2023-08-01'::date, 1400.0::numeric(10,2), 'Албена Андреева', '0877 277 741', NULL::text, 'Импорт Klimatici2022 VTORA, лист Sharp Вън ред 4'),
        ('Sharp Вън', 5, 'Sharp', 'f25de4', 'f25de4', 'f25dey', '2022-11-08'::date, 1500.0::numeric(10,2), 'ВЕСЕЛИН КЕХАЬОВ', '0877 751 277', NULL::text, 'Импорт Klimatici2022 VTORA, лист Sharp Вън ред 5'),
        ('Sharp Вън', 7, 'Sharp', 'f25td', 'f25td', 'f25td', '2022-10-01'::date, 1200.0::numeric(10,2), 'Тони Чакъров', '0879 435 190', NULL::text, 'Импорт Klimatici2022 VTORA, лист Sharp Вън ред 7'),
        ('Sharp Вън', 9, 'Sharp', 'f28dg', 'f28dg', 'f28dgy', '2022-12-09'::date, 1500.0::numeric(10,2), 'КРАСИ РУДОЗЕМ', '0879 556 560', NULL::text, 'Импорт Klimatici2022 VTORA, лист Sharp Вън ред 9'),
        ('Sharp Вън', 11, 'Sharp', 'a63sx', 'a63sx', 'a63sx', '2022-12-08'::date, 2200.0::numeric(10,2), 'ХАСАН МЕХМЕД', '0877 330 499', NULL::text, 'Импорт Klimatici2022 VTORA, лист Sharp Вън ред 11'),
        ('Sharp Вън', 12, 'Sharp', '281fd', '281fd', '281fd', '2023-09-06'::date, 1350.0::numeric(10,2), 'МИРО КРИС-ТМ МАДАН', '0887 422 424', NULL::text, 'Импорт Klimatici2022 VTORA, лист Sharp Вън ред 12'),
        ('Sharp Вън', 14, 'Sharp', 'b56sx', 'b56sx', 'b56sx', '2022-10-27'::date, 2200.0::numeric(10,2), 'Наско Манолевски', '0887 305 873', NULL::text, 'Импорт Klimatici2022 VTORA, лист Sharp Вън ред 14'),
        ('Sharp Вън', 15, 'Sharp', 'b56sx', 'b56sx', 'b56sx', '2023-03-28'::date, 2500.0::numeric(10,2), 'ИВАН БОЖИНОВ', '0896 734 669', NULL::text, 'Импорт Klimatici2022 VTORA, лист Sharp Вън ред 15'),
        ('Sharp Вън', 16, 'Sharp', 'z71sx', 'z71sx', 'z71sx', '2023-09-28'::date, 2500.0::numeric(10,2), 'ВЕНЦИСЛАВ УЗУНОВ', '0893 627 361', NULL::text, 'Импорт Klimatici2022 VTORA, лист Sharp Вън ред 16'),
        ('Sharp Вън', 18, 'Sharp', 'z40sx', 'z40sx', 'z40sx', '2023-08-22'::date, 2300.0::numeric(10,2), 'МАРИАНА ЕМИРСКА', '0877 886 201', NULL::text, 'Импорт Klimatici2022 VTORA, лист Sharp Вън ред 18'),
        ('Sharp Вън', 19, 'Sharp', 'w50se', 'w50se', 'w50se', '2022-12-15'::date, 2200.0::numeric(10,2), 'ГЕОРГИ ГРЕГ', '0899 804 045', NULL::text, 'Импорт Klimatici2022 VTORA, лист Sharp Вън ред 19')
    ) AS stage(
      sheet_name, sheet_row, brand_name, model,
      indoor_serial, outdoor_serial, sale_date, sale_price,
      client_name, client_phone, client_address, notes
    )
    ORDER BY sheet_name, sheet_row
  LOOP
    v_product_id := NULL;
    v_contact_id := NULL;
    v_slug := 'klimatici2022-used-' || r.sheet_name || '-' || r.sheet_row;
    v_note := r.notes;

    IF EXISTS (
      SELECT 1 FROM public.work_items
      WHERE event_code = 'sale'
        AND notes LIKE 'Импорт Klimatici2022 VTORA, лист ' || r.sheet_name || ' ред ' || r.sheet_row || '%'
    ) THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM public.products WHERE slug = v_slug) THEN
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
      RAISE WARNING 'Klimatici2022 % row %: липсва марка %', r.sheet_name, r.sheet_row, r.brand_name;
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
      indoor_unit_serial, outdoor_unit_serial, purchased_at,
      product_condition, stock_status, stock_quantity, sold_quantity,
      is_active, show_in_public_catalog
    ) VALUES (
      v_slug, v_name, v_brand_id, v_type_id, nullif(btrim(r.model), ''),
      coalesce(r.sale_price, 0), NULL,
      nullif(btrim(r.indoor_serial), ''), nullif(btrim(r.outdoor_serial), ''), r.sale_date,
      'used', 'out_of_stock', 0, 1, false, false
    ) RETURNING id INTO v_product_id;

    INSERT INTO public.work_items (
      type, event_code, status, priority, title, notes, due_date, completed_at,
      product_id, contact_id, customer_name, customer_phone, customer_address,
      quantity, unit_price, total_amount, purchase_price, sale_install_state
    ) VALUES (
      'sale', 'sale', 'done', 'medium',
      'Продажба: ' || v_name,
      v_note,
      r.sale_date,
      (coalesce(r.sale_date, current_date) + time '12:00:00') AT TIME ZONE 'Europe/Sofia',
      v_product_id, v_contact_id, r.client_name, r.client_phone, r.client_address,
      1, coalesce(r.sale_price, 0), coalesce(r.sale_price, 0), NULL, 'completed'
    ) RETURNING id INTO v_sale_id;
    v_imported := v_imported + 1;
  END LOOP;

  RAISE NOTICE 'Klimatici2022 used import: imported=%, skipped(existing)=%', v_imported, v_skipped;
END
$import$;
