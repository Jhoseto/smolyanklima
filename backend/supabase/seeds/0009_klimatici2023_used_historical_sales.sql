-- =====================================================================
-- Seed: Исторически продажби „втора употреба“ от Klimatici 2023.xlsx
-- =====================================================================
-- Редове: 124
-- Продукти: product_condition = used
-- Идемпотентност: notes LIKE 'Импорт Klimatici2023 VTORA, лист % ред N'
-- Rollback: seeds/0010_rollback_klimatici2023_used_sales.sql
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
        ('toshiba', 3, 'Toshiba', '221B', '221B', '221AB', '2023-10-10'::date, 222.0::numeric(10,2), 'ВАЛЕНТИН ДИМИТРОВ', '0878 912 584', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 3'),
        ('toshiba', 5, 'Toshiba', '2219D', '2219D', '2219AD', '2023-09-04'::date, 1350.0::numeric(10,2), 'МИРО КРИС-ТМ', '0887 422 424', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 5'),
        ('toshiba', 6, 'Toshiba', 'N221E9R', 'N221E9R', '221E9AR', '2023-08-22'::date, 1300.0::numeric(10,2), 'МАРИАНА ЕМИРСКА РУДОЗЕМ', '0877 886 201', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 6'),
        ('toshiba', 7, 'Toshiba', '2212D', '2212D', '2212AD', '2023-11-07'::date, 1050.0::numeric(10,2), 'РОСИЦА СТАНЕВСКА', '0899 992 136', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 7'),
        ('toshiba', 8, 'Toshiba', '221UD', '221UD', '221UAD', '2023-12-06'::date, 1000.0::numeric(10,2), 'ГЕОРГИ ЗДРАВКОВ', '0895 183 439', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 8'),
        ('toshiba', 9, 'Toshiba', '221E', '221E', '221AE', '2023-11-07'::date, 1050.0::numeric(10,2), 'РОСИЦА СТАНЕВСКА', '0899 992 136', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 9'),
        ('toshiba', 10, 'Toshiba', '221GP', '221GP', '221GAP', '2024-06-18'::date, 1200.0::numeric(10,2), 'ЗЛАТИ ТОДОРОВ', '0889 455 653', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 10'),
        ('toshiba', 11, 'Toshiba', '2512D', '2512D', '2512AD', '2024-06-19'::date, 1400.0::numeric(10,2), 'ЗЛАТИ ТОДОРОВ', '0889 455 653', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 11'),
        ('toshiba', 12, 'Toshiba', '251SDX', '251SDX', '251SADX', '2025-09-10'::date, 1600.0::numeric(10,2), 'КМЕТА НА КАТРАНИЦА', '0878 695 234', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 12'),
        ('toshiba', 14, 'Toshiba', '251ND', '251ND', '251NAD', '2024-07-22'::date, 1300.0::numeric(10,2), 'КОЛЬО ДАРИДКОВ', '0878 800 954', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 14'),
        ('toshiba', 15, 'Toshiba', 'B251E5R', 'B251E5R', 'B251E5AR', NULL::date, 0.0::numeric(10,2), 'КОЛЬО ДАРИДКОВ', '0878 800 954', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 15'),
        ('toshiba', 16, 'Toshiba', '281GP', '281GP', '281GAP', '2025-04-03'::date, 1400.0::numeric(10,2), 'НАСКО НАЦИОНАЛА', '0879 888 299', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 16'),
        ('toshiba', 18, 'Toshiba', '281NDS', '281NDS', '281NADNS', '2024-09-20'::date, 1900.0::numeric(10,2), 'МАРИЯ ПЕПЕЛАНОВА', '0897 857 624', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 18'),
        ('toshiba', 19, 'Toshiba', '4022D', '4022D', '4022AD', '2025-01-21'::date, 1900.0::numeric(10,2), 'Валдемар Славчев Иванов', '0894 559 919', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 19'),
        ('toshiba', 22, 'Toshiba', '281EDRS', '281EDRS', '281EADR', '2024-09-28'::date, 1700.0::numeric(10,2), 'РАДКО ШУКЕРОВ КАТРАНИЦА', '0878 695 234', NULL::text, 'Импорт Klimatici2023 VTORA, лист toshiba ред 22'),
        ('mitsubishi', 3, 'Mitsubishi Electric', 'SV22T', 'SV22T', 'SV22T', '2023-09-26'::date, 1100.0::numeric(10,2), 'БИЛЯН ХРИСТОВ', '0885 512 820', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 3'),
        ('mitsubishi', 4, 'Mitsubishi Electric', 'SV22T', 'SV22T', 'SV22T', '2024-01-17'::date, 1100.0::numeric(10,2), 'НЕДКО КЮША RUDOZEM', '0898 425 878', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 4'),
        ('mitsubishi', 6, 'Mitsubishi Electric', 'SV229', 'SV229', 'SV259', '2024-08-09'::date, 1300.0::numeric(10,2), 'ГАЛЯ МАРИНОВА', '0879 330 865', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 6'),
        ('mitsubishi', 7, 'Mitsubishi Electric', 'EN22E4', 'EN22E4', 'EM22E4', '2023-11-30'::date, 1500.0::numeric(10,2), 'АСАН ДЕЛИЛОВ', '0887 233 383', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 7'),
        ('mitsubishi', 8, 'Mitsubishi Electric', 'HN221', 'HN221', 'HM221', '2023-10-19'::date, 1000.0::numeric(10,2), 'КРАСИМИР МИЛЕВ ВАРНА', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 8'),
        ('mitsubishi', 9, 'Mitsubishi Electric', 'GM221M', 'GM221M', 'GM221', '2024-08-22'::date, 1000.0::numeric(10,2), 'ТОДОР ДАРЛЯНОВ', '0892 945 555', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 9'),
        ('mitsubishi', 10, 'Mitsubishi Electric', 'J228', 'J228', 'J228', '2024-09-27'::date, 1300.0::numeric(10,2), 'РАСИМ КЕХАЙОВ РАВНИЩА', '0895 525 616', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 10'),
        ('mitsubishi', 11, 'Mitsubishi Electric', 'SV228', 'SV228', 'SV228', '2024-07-05'::date, 1000.0::numeric(10,2), 'РАДОСЛАВ ПАЗВАНТОВ', '0882 171 465', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 11'),
        ('mitsubishi', 12, 'Mitsubishi Electric', 'H258', 'H258', 'H258', '2024-08-19'::date, 1400.0::numeric(10,2), 'МИНКА БАШЕВА', '0884 917 525', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 12'),
        ('mitsubishi', 14, 'Mitsubishi Electric', 'SV257', 'SV257', 'SV257', '2024-06-13'::date, 1400.0::numeric(10,2), 'МИЛКО САНЕВ', '0878 266 766', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 14'),
        ('mitsubishi', 15, 'Mitsubishi Electric', 'GV2516T', 'GV2516T', 'G2516', '2024-06-13'::date, 1500.0::numeric(10,2), 'ВЕЛИН АЛЕКОВ', '0889 547 047', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 15'),
        ('mitsubishi', 16, 'Mitsubishi Electric', 'GV2818', 'GV2818', 'G2818', '2024-07-31'::date, 1500.0::numeric(10,2), 'АНГЕЛ СПАСОВ', '0882 258 819', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 16'),
        ('mitsubishi', 17, 'Mitsubishi Electric', 'SJ28T', 'SJ28T', 'SY28T', '2024-06-13'::date, 1500.0::numeric(10,2), 'ВЕЛИН АЛЕКОВ', '0889 547 047', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 17'),
        ('mitsubishi', 18, 'Mitsubishi Electric', 'P285', 'P285', 'P285', '2024-10-23'::date, 1600.0::numeric(10,2), 'ИВАН ДЖАМБАЗОВ ДЕВИН', '0882 564 486', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 18'),
        ('mitsubishi', 20, 'Mitsubishi Electric', 'GE2817', 'GE2817', 'G2817', '2025-01-07'::date, 1500.0::numeric(10,2), 'АЛЕКСАНДЪР БАЛЕВСКИ 087259696', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 20'),
        ('mitsubishi', 21, 'Mitsubishi Electric', 'EX36E2', 'EX36E2', 'EX36E2', '2024-10-11'::date, 2100.0::numeric(10,2), 'ЕМИЛ ДИМОВ', '0888 326 016', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 21'),
        ('mitsubishi', 22, 'Mitsubishi Electric', 'SS508S', 'SS508S', 'SS508S', '2024-05-10'::date, 2500.0::numeric(10,2), 'ЕМИЛ МАДЖАРОВ', '0876 735 289', NULL::text, 'Импорт Klimatici2023 VTORA, лист mitsubishi ред 22'),
        ('nacional', 3, 'Nacional', '228TB', '228TB', '228TB', '2023-07-18'::date, 1000.0::numeric(10,2), 'МИРОСЛАВ КЕХАЙОВ', '0887 422 424', NULL::text, 'Импорт Klimatici2023 VTORA, лист nacional ред 3'),
        ('nacional', 4, 'Nacional', '227TV', '227TV', '227TB', '2024-10-03'::date, 1000.0::numeric(10,2), 'НИКИ РАЙЧЕВ ЛЪКИ', '0898 308 350', NULL::text, 'Импорт Klimatici2023 VTORA, лист nacional ред 4'),
        ('nacional', 5, 'Nacional', '22RFH', '22RFH', 'H226A', '2023-07-18'::date, 1000.0::numeric(10,2), 'МИРОСЛАВ КЕХАЙОВ', '0887 422 424', NULL::text, 'Импорт Klimatici2023 VTORA, лист nacional ред 5'),
        ('nacional', 6, 'Nacional', 'X257A', 'X257A', 'X257A', '2024-08-21'::date, 1000.0::numeric(10,2), 'НАСКО ЗАРЕВ', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист nacional ред 6'),
        ('nacional', 7, 'Nacional', 'X256A', 'X256A', 'X256A', '2024-09-01'::date, 1000.0::numeric(10,2), 'НА ЯВОР ВНУКА ЗА ЕКСПЕРИМЕНТ', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист nacional ред 7'),
        ('nacional', 10, 'Nacional', '287VB', '287VB', '287VB', '2023-09-04'::date, 1350.0::numeric(10,2), 'МИРО КРИС-ТМ', '0887 422 424', NULL::text, 'Импорт Klimatici2023 VTORA, лист nacional ред 10'),
        ('nacional', 11, 'Nacional', '28RFH', '28RFH', 'H286A', '2023-09-04'::date, 1350.0::numeric(10,2), 'МИРО КРИС-ТМ', '0887 422 424', NULL::text, 'Импорт Klimatici2023 VTORA, лист nacional ред 11'),
        ('hitachi', 4, 'Hitachi', 'AC25C', 'AC25C', 'AC25C', '2024-06-25'::date, 1400.0::numeric(10,2), 'ИВАН БУШЕВ', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 4'),
        ('hitachi', 5, 'Hitachi', 'AC25A', 'AC25A', 'ne se chete', '2024-06-25'::date, 900.0::numeric(10,2), 'ЕЛЕНА РАДЕВА', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 5'),
        ('hitachi', 6, 'Hitachi', 'AJ25D', 'AJ25D', 'AJ25D', '2023-09-07'::date, 1500.0::numeric(10,2), 'МОНИКА МАДАН', '0893 385 624', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 6'),
        ('hitachi', 8, 'Hitachi', 'S28A', 'S28A', 'S28A', '2024-05-16'::date, 1700.0::numeric(10,2), 'СИЛВИ', '0893 380 938', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 8'),
        ('hitachi', 9, 'Hitachi', 'M28Y', 'M28Y', 'M28Y', '2024-03-12'::date, 1000.0::numeric(10,2), 'ИВАЙЛО УЗУНОВ', '0876 064 584', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 9'),
        ('hitachi', 11, 'Hitachi', 'R28V', 'R28V', 'R28B', '2024-06-25'::date, 1400.0::numeric(10,2), 'ИВАН БУШЕВ', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 11'),
        ('hitachi', 12, 'Hitachi', 'K28E', 'K28E', 'G28E', '2024-06-14'::date, 1800.0::numeric(10,2), 'АХМЕД МЕКОВ', '0879 533 096', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 12'),
        ('hitachi', 13, 'Hitachi', 'A28Z', 'A28Z', 'A287', '2023-06-14'::date, 1300.0::numeric(10,2), 'МИРО', '0878 461 155', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 13'),
        ('hitachi', 14, 'Hitachi', 'G28H', 'G28H', 'G28H', '2024-03-06'::date, 1800.0::numeric(10,2), 'МУРАТ БАКЪРДЖИЕВ', '0876 262 682', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 14'),
        ('hitachi', 15, 'Hitachi', 'JT28Ce1', 'JT28Ce1', 'SV28A', '2024-08-02'::date, 1750.0::numeric(10,2), 'ТОДОР КИСЬОВ', '0899 829 338', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 15'),
        ('hitachi', 16, 'Hitachi', 'AS28A', 'AS28A', 'AS28A', '2023-12-06'::date, 1400.0::numeric(10,2), 'ЗДРАВКО РЪЖЕНИКОВ', '0887 561 693', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 16'),
        ('hitachi', 17, 'Hitachi', 'L28FE4', 'L28FE4', 'L28FE4', '2025-09-15'::date, 1500.0::numeric(10,2), 'СТЕФАН КАМАРТОН', '0877 227 272', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 17'),
        ('hitachi', 18, 'Hitachi', 'AJ28G', 'AJ28G', 'AJ28G', '2023-09-07'::date, 1600.0::numeric(10,2), 'МОНИКА МАДАН', '0893 385 624', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 18'),
        ('hitachi', 19, 'Hitachi', 'E36Y', 'E36Y', 'E36Y', '2023-12-01'::date, 1700.0::numeric(10,2), 'РАЙФ МАХМУДОВ', '0893 328 484', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 19'),
        ('hitachi', 20, 'Hitachi', 'AJ36F', 'AJ36F', 'AJ36F', '2023-09-06'::date, 1550.0::numeric(10,2), 'МИРО КРИС-ТМ МАДАН', '0887 422 424', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 20'),
        ('hitachi', 21, 'Hitachi', 'K36F', 'K36F', 'W36F', '2024-05-16'::date, 1700.0::numeric(10,2), 'СИЛВИ', '0893 380 938', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 21'),
        ('hitachi', 22, 'Hitachi', 'AJ36B', 'AJ36B', 'AJ36B', '2023-08-28'::date, 1600.0::numeric(10,2), 'ХАМДИ БОБОВ ЕЛХОВЕЦ', '0877 354 609', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 22'),
        ('hitachi', 23, 'Hitachi', 'SV40Y2', 'SV40Y2', 'SV40Y2', '2024-06-12'::date, 1800.0::numeric(10,2), 'АНИ БОЯНОВА', '0888 783 717', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 23'),
        ('hitachi', 25, 'Hitachi', 'K40C2', 'K40C2', 'K40C2', '2024-06-25'::date, 1500.0::numeric(10,2), 'ЕЛЕНА РАДЕВА', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 25'),
        ('hitachi', 26, 'Hitachi', 'VJ40A2', 'VJ40A2', 'VJ40A2', '2025-05-13'::date, 1900.0::numeric(10,2), 'Рудозем-Рубела', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 26'),
        ('hitachi', 29, 'Hitachi', 'M40E2E3', 'M40E2E3', 'M40E2E3', '2024-04-08'::date, 2400.0::numeric(10,2), 'ГИНКА ЖЕКОВА', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 29'),
        ('hitachi', 30, 'Hitachi', 'AE40B2', 'AE40B2', 'AE40B2', '2024-11-04'::date, 2000.0::numeric(10,2), 'ТОНИ АБАДЖИЕВ', '0876 179 997', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 30 · БРАК'),
        ('hitachi', 31, 'Hitachi', 'JT40Y2E6', 'JT40Y2E6', 'JT40Y2E6', '2023-01-09'::date, 0.0::numeric(10,2), 'НАСКО И ЖАКИ ПЛОВДИВ', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 31'),
        ('hitachi', 32, 'Hitachi', 'SC40Y2', 'SC40Y2', 'SC40Y2', '2024-06-14'::date, 1800.0::numeric(10,2), 'ЕВГЕНИ МАДАН', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 32'),
        ('hitachi', 34, 'Hitachi', 'HS40B2E9', 'HS40B2E9', 'HS40B2E9', '2025-07-23'::date, 2000.0::numeric(10,2), 'ВАСИЛ', '0879 459 995', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 34'),
        ('hitachi', 36, 'Hitachi', 'JT40ZX2E5', 'JT40ZX2E5', 'JT40X2E5', '2023-12-10'::date, 1500.0::numeric(10,2), 'ИВАН БУШЕВ 1600 ЛВ', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 36'),
        ('hitachi', 37, 'Hitachi', 'A40F2', 'A40F2', 'A40F2', '2025-07-09'::date, 0.0::numeric(10,2), 'АНЕЛИЯ АБАДЖИЕВА', '0879 850 480', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 37 · СМЯНА ШАРП'),
        ('hitachi', 38, 'Hitachi', 'JT40A3E8', 'JT40A3E8', 'JT40A3E8', NULL::date, 2400.0::numeric(10,2), 'ИЛИЯН КАДИЕВ ДЕВИН', '0884 701 652', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 38'),
        ('hitachi', 39, 'Hitachi', 'LJ50Y2', 'LJ50Y2', 'LJ50Y2', '2023-11-21'::date, 1500.0::numeric(10,2), 'СТОИЛ', '0877 613 100', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 39'),
        ('hitachi', 41, 'Hitachi', 'JT50Z2E7', 'JT50Z2E7', 'skusana lepenka', '2023-11-13'::date, 2000.0::numeric(10,2), 'МИРО КРИС ТМ', '0887 422 424', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 41'),
        ('hitachi', 42, 'Hitachi', 'JT56A2E8', 'JT56A2E8', 'JT56E2E3', '2024-03-14'::date, 2000.0::numeric(10,2), 'СТОИЛ КЪРДЖАЛИ', '0877 613 100', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 42'),
        ('hitachi', 44, 'Hitachi', 'JT63Z2E7', 'JT63Z2E7', 'JT63Z2E7', '2023-11-13'::date, 2000.0::numeric(10,2), 'МИРО КРИС ТМ', '0887 422 424', NULL::text, 'Импорт Klimatici2023 VTORA, лист hitachi ред 44'),
        ('panasonic', 3, 'Panasonic', '220CFR', '220CFR', 'F220C', '2023-07-29'::date, 1000.0::numeric(10,2), 'АНГЕЛ ПРИНЦА', '0889 327 227', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 3'),
        ('panasonic', 5, 'Panasonic', '22BLE', '22BLE', '22BLE', '2023-12-13'::date, 800.0::numeric(10,2), 'ВЕСЕЛИН ХАДЖИЕВ', '0883 342 675', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 5'),
        ('panasonic', 6, 'Panasonic', '223CFR', '223CFR', 'F223C', '2025-01-16'::date, 1100.0::numeric(10,2), 'ВЕСКО ИСМЕНА', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 6'),
        ('panasonic', 7, 'Panasonic', '223CFR', '223CFR', 'F223C', '2024-12-13'::date, 1000.0::numeric(10,2), 'АТАНАС', '0893 664 294', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 7'),
        ('panasonic', 8, 'Panasonic', '22MFE8', '22MFE8', 'F221C', '2023-11-03'::date, 1000.0::numeric(10,2), 'ЦВЕТАН ПЕТКАНОВ', '0876 157 857', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 8'),
        ('panasonic', 9, 'Panasonic', '224CFR', '224CFR', 'F224C', '2023-10-09'::date, 1100.0::numeric(10,2), 'МИНКА ЯРЪМОВА', '0892 483 738', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 9'),
        ('panasonic', 10, 'Panasonic', 'J227C', 'J227C', 'J227C', '2023-12-28'::date, 1100.0::numeric(10,2), 'Светла Ковачева НЕДЕЛИНО', '0878 226 663', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 10'),
        ('panasonic', 11, 'Panasonic', '222CF', '222CF', 'F222C', '2024-12-13'::date, 1000.0::numeric(10,2), 'АТАНАС', '0893 664 294', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 11'),
        ('panasonic', 12, 'Panasonic', '224CFR', '224CFR', 'F224C', '2024-11-19'::date, 1050.0::numeric(10,2), 'ЕВЕЛИН АФУЗОВ', '0895 569 969', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 12'),
        ('panasonic', 15, 'Panasonic', '222CFR', '222CFR', 'F222C', '2023-11-28'::date, 1000.0::numeric(10,2), 'МИРО КРИ ТМ', NULL::text, NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 15'),
        ('panasonic', 16, 'Panasonic', '222CFR', '222CFR', 'F222C', '2023-12-07'::date, 1000.0::numeric(10,2), 'АНЕТА СТАРЕВА', '0893 860 693', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 16'),
        ('panasonic', 17, 'Panasonic', '223CF', '223CF', '223CF', '2023-11-03'::date, 1000.0::numeric(10,2), 'ЦВЕТАН ПЕТКАНОВ', '0876 157 857', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 17'),
        ('panasonic', 18, 'Panasonic', '222CF', '222CF', '222CF', '2024-10-03'::date, 1200.0::numeric(10,2), 'МАЙКЪЛ РУДОЗЕМ', '0876 391 808', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 18'),
        ('panasonic', 19, 'Panasonic', 'J223C', 'J223C', 'J223C', '2024-01-12'::date, 1200.0::numeric(10,2), 'ТЕМЕНУЖКА МИХАЙЛОВА ЛОВЦИ', '0898 583 213', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 19'),
        ('panasonic', 20, 'Panasonic', '222CF', '222CF', '222CF', '2023-09-28'::date, 1000.0::numeric(10,2), 'ДАНЧО', '0878 730 303', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 20'),
        ('panasonic', 24, 'Panasonic', 'EX250C', 'EX250C', 'EX250C', '2024-06-26'::date, 1300.0::numeric(10,2), 'ИВАН КОКИЛКОВ', '0897 525 565', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 24'),
        ('panasonic', 25, 'Panasonic', '251CF', '251CF', '251CF', '2023-10-10'::date, 1500.0::numeric(10,2), 'СИЛВА ТЮТЮНАРОВА', '0887 159 705', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 25'),
        ('panasonic', 28, 'Panasonic', '283CF', '283CF', '283CF', '2023-10-10'::date, 1600.0::numeric(10,2), 'СИЛВА ТЮТЮНАРОВА', '0887 159 705', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 28'),
        ('panasonic', 30, 'Panasonic', 'X289A', 'X289A', 'X289A', '2024-09-28'::date, 0.0::numeric(10,2), 'РАДКО ШУКЕРОВ КАТРАНИЦА', '0878 695 234', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 30'),
        ('panasonic', 33, 'Panasonic', 'EX289A', 'EX289A', 'EX289A', '2024-02-29'::date, 1700.0::numeric(10,2), 'СЕЛВИ ДЕРВИШЕВ ВЪРБИНА', '0893 679 794', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 33'),
        ('panasonic', 34, 'Panasonic', '280CFR', '280CFR', 'F280C', '2023-09-30'::date, 1400.0::numeric(10,2), 'ИЦО ПАЛАГАЧЕВ', '0878 403 530', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 34'),
        ('panasonic', 36, 'Panasonic', 'XS404C2', 'XS404C2', 'XS404C2', '2024-09-11'::date, 2500.0::numeric(10,2), 'АЛЕКСАНДЪР ДИМИТРОВ', '0897 662 165', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 36'),
        ('panasonic', 37, 'Panasonic', 'EX404C2', 'EX404C2', 'EX404C2', '2024-08-14'::date, 2000.0::numeric(10,2), 'РОСЕН МАДАН', '0897 949 920', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 37'),
        ('panasonic', 38, 'Panasonic', '501CXR2', '501CXR2', '501CXR2', '2024-05-07'::date, 2200.0::numeric(10,2), 'ФИЛИП НИНОВ', '0887 581 669', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 38'),
        ('panasonic', 39, 'Panasonic', '563CXR2', '563CXR2', '563CXR2', '2024-03-15'::date, 2500.0::numeric(10,2), 'АНДРЕЙ', '0876 686 880', NULL::text, 'Импорт Klimatici2023 VTORA, лист panasonic ред 39'),
        ('sharp', 4, 'Sharp', 'D28EX', 'D28EX', 'D28EXY', '2024-10-25'::date, 1700.0::numeric(10,2), 'ВАСКО УЗУНОВ', '0878 662 122', NULL::text, 'Импорт Klimatici2023 VTORA, лист sharp ред 4'),
        ('sharp', 6, 'Sharp', 'F28TD', 'F28TD', 'F28TDY', '2023-11-23'::date, 1500.0::numeric(10,2), 'КРАСИ ХАДЖИЕВ', '0879 556 560', NULL::text, 'Импорт Klimatici2023 VTORA, лист sharp ред 6'),
        ('sharp', 7, 'Sharp', 'Y28XEC', 'Y28XEC', 'Y28XEY', '2025-06-26'::date, 2000.0::numeric(10,2), 'ЕМИЛ ДИМОВ', '0888 326 016', NULL::text, 'Импорт Klimatici2023 VTORA, лист sharp ред 7'),
        ('sharp', 8, 'Sharp', 'В28EE9', 'В28EE9', 'B28EEY', '2024-02-29'::date, 1700.0::numeric(10,2), 'СЕЛВИ ДЕРВИШЕВ ВЪРБИНА', '0893 679 794', NULL::text, 'Импорт Klimatici2023 VTORA, лист sharp ред 8'),
        ('sharp', 9, 'Sharp', '404FD2', '404FD2', '404FDY', '2024-10-18'::date, 1850.0::numeric(10,2), 'ИВАН ФИСИНСКИ', '0878 441 541', NULL::text, 'Импорт Klimatici2023 VTORA, лист sharp ред 9'),
        ('sharp', 10, 'Sharp', 'D40EX', 'D40EX', 'D40EXY', '2026-02-11'::date, 1000.0::numeric(10,2), 'СЕРГЕЙ ЧАВДАРОВ', '0878 112 305', NULL::text, 'Импорт Klimatici2023 VTORA, лист sharp ред 10'),
        ('sanyo', 4, 'Sanyo', 'WK250A', 'WK250A', 'CWK250A', '2023-11-28'::date, 1300.0::numeric(10,2), 'ЗЛАТКА', '0879 433 019', NULL::text, 'Импорт Klimatici2023 VTORA, лист sanyo ред 4'),
        ('sanyo', 5, 'Sanyo', 'ZK28X', 'ZK28X', 'CZK28X', '2025-11-17'::date, 1500.0::numeric(10,2), 'ТОНИ АНГЕЛОВ', '0879 557 928', NULL::text, 'Импорт Klimatici2023 VTORA, лист sanyo ред 5'),
        ('fujitsu', 3, 'Fujitsu', 'J22D', 'J22D', 'J22D', '2023-12-28'::date, 1300.0::numeric(10,2), 'Светла Ковачева НЕДЕЛИНО', '0878 226 663', NULL::text, 'Импорт Klimatici2023 VTORA, лист fujitsu ред 3'),
        ('fujitsu', 5, 'Fujitsu', 'A250H', 'A250H', 'A250', '2024-09-16'::date, 1300.0::numeric(10,2), 'ТОДОР ЗГУРОВ', '0887 109 462', NULL::text, 'Импорт Klimatici2023 VTORA, лист fujitsu ред 5'),
        ('fujitsu', 6, 'Fujitsu', 'W28B', 'W28B', 'W28B', '2024-08-28'::date, 1700.0::numeric(10,2), 'АДРИАН ЧАНГАЛОВ', '0877 552 252', NULL::text, 'Импорт Klimatici2023 VTORA, лист fujitsu ред 6'),
        ('fujitsu', 8, 'Fujitsu', 'J28V', 'J28V', 'J28V', '2024-08-02'::date, 1350.0::numeric(10,2), 'ТОДОР КИСЬОВ', '0899 829 338', NULL::text, 'Импорт Klimatici2023 VTORA, лист fujitsu ред 8'),
        ('fujitsu', 9, 'Fujitsu', 'Z283P', 'Z283P', 'Z283P', '2024-08-22'::date, 2000.0::numeric(10,2), 'ТОДОР ДАРЛЯНОВ', '0892 945 555', NULL::text, 'Импорт Klimatici2023 VTORA, лист fujitsu ред 9'),
        ('fujitsu', 10, 'Fujitsu', 'V28K', 'V28K', 'B28K', NULL::date, 1400.0::numeric(10,2), 'Йордан Йорданов', '0878 730 303', NULL::text, 'Импорт Klimatici2023 VTORA, лист fujitsu ред 10'),
        ('fujitsu', 11, 'Fujitsu', '406C2E4', '406C2E4', '406CVE4', '2025-01-20'::date, 2500.0::numeric(10,2), 'САНКО', '0893 327 459', NULL::text, 'Импорт Klimatici2023 VTORA, лист fujitsu ред 11'),
        ('fujitsu', 12, 'Fujitsu', 'V40D', 'V40D', 'V40D', '2024-08-14'::date, 2000.0::numeric(10,2), 'РОСЕН МАДАН', '0897 949 920', NULL::text, 'Импорт Klimatici2023 VTORA, лист fujitsu ред 12'),
        ('fujitsu', 13, 'Fujitsu', 'E40V', 'E40V', 'bez tabela 100v', '2024-09-02'::date, 1800.0::numeric(10,2), 'АНАСТАСИЯ ГЕРГЬОВСКА', '0889 368 802', NULL::text, 'Импорт Klimatici2023 VTORA, лист fujitsu ред 13'),
        ('fujitsu', 14, 'Fujitsu', 'R56C2W', 'R56C2W', 'R56C2', '2024-03-14'::date, 2000.0::numeric(10,2), 'СТОИЛ КЪРДЖАЛИ', '0877 613 100', NULL::text, 'Импорт Klimatici2023 VTORA, лист fujitsu ред 14'),
        ('daikin', 3, 'Daikin', 'F22PTES', 'F22PTES', '22PES', '2023-12-06'::date, 1300.0::numeric(10,2), 'ВЕРОНИКА ДУГАНДЖИЕВА РУДОЗЕМ', '0876 737 576', NULL::text, 'Импорт Klimatici2023 VTORA, лист daikin ред 3'),
        ('daikin', 4, 'Daikin', 'AJT22TJS', 'AJT22TJS', 'AJR22TES', '2023-11-15'::date, 1400.0::numeric(10,2), 'НИКОЛА ТАБАКОВ', '0893 860 337', NULL::text, 'Импорт Klimatici2023 VTORA, лист daikin ред 4'),
        ('daikin', 5, 'Daikin', 'F22GTNS', 'F22GTNS', '22JNS', '2023-08-31'::date, 1200.0::numeric(10,2), 'КЕМИЛ КАБААХМЕДОВ ВЪРБИНА', '0893 563 560', NULL::text, 'Импорт Klimatici2023 VTORA, лист daikin ред 5'),
        ('daikin', 6, 'Daikin', 'F22HTSS', 'F22HTSS', 'R22HSS', '2023-08-31'::date, 1200.0::numeric(10,2), 'КЕМИЛ КАБААХМЕДОВ ВЪРБИНА', '0893 563 560', NULL::text, 'Импорт Klimatici2023 VTORA, лист daikin ред 6'),
        ('daikin', 7, 'Daikin', 'F25STES', 'F25STES', 'R25SES', '2024-09-11'::date, 1400.0::numeric(10,2), 'РОСЕН МАДАН', '0897 949 920', NULL::text, 'Импорт Klimatici2023 VTORA, лист daikin ред 7'),
        ('daikin', 8, 'Daikin', '25UNS', '25UNS', 'AJR25UNS', '2024-07-26'::date, 1500.0::numeric(10,2), 'ЕМИЛИЯ ГЪРБЕЛОВА', '0878 873 416', NULL::text, 'Импорт Klimatici2023 VTORA, лист daikin ред 8'),
        ('daikin', 9, 'Daikin', '28LTRXS', '28LTRXS', 'R28LRX5 ururu sarara', '2024-08-16'::date, 1800.0::numeric(10,2), 'РАЙКО', '0878 144 145', NULL::text, 'Импорт Klimatici2023 VTORA, лист daikin ред 9'),
        ('daikin', 10, 'Daikin', '28RTES', '28RTES', 'R28AES', '2024-09-09'::date, 1600.0::numeric(10,2), 'ПАНАЙОТ ЧЕШМЕДЖИЕВ', '0888 307 668', NULL::text, 'Импорт Klimatici2023 VTORA, лист daikin ред 10'),
        ('daikin', 11, 'Daikin', 'F36GTNS', 'F36GTNS', 'R36GNS', '2023-11-21'::date, 1000.0::numeric(10,2), 'СТОИЛ', '0877 613 100', NULL::text, 'Импорт Klimatici2023 VTORA, лист daikin ред 11'),
        ('daikin', 12, 'Daikin', 'F28HTNS', 'F28HTNS', NULL::text, '2024-06-11'::date, 1500.0::numeric(10,2), 'АСЕН КЕХАЙОВ', '0876 505 067', NULL::text, 'Импорт Klimatici2023 VTORA, лист daikin ред 12')
    ) AS stage(
      sheet_name, sheet_row, brand_name, model,
      indoor_serial, outdoor_serial, sale_date, sale_price,
      client_name, client_phone, client_address, notes
    )
    ORDER BY sheet_name, sheet_row
  LOOP
    v_product_id := NULL;
    v_contact_id := NULL;
    v_slug := 'klimatici2023-used-' || r.sheet_name || '-' || r.sheet_row;
    v_note := r.notes;

    IF EXISTS (
      SELECT 1 FROM public.work_items
      WHERE event_code = 'sale'
        AND notes LIKE 'Импорт Klimatici2023 VTORA, лист ' || r.sheet_name || ' ред ' || r.sheet_row || '%'
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
      RAISE WARNING 'Klimatici2023 % row %: липсва марка %', r.sheet_name, r.sheet_row, r.brand_name;
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

  RAISE NOTICE 'Klimatici2023 used import: imported=%, skipped(existing)=%', v_imported, v_skipped;
END
$import$;
