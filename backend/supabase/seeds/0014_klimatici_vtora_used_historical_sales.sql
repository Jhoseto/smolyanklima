-- =====================================================================
-- Seed: Исторически продажби „втора употреба“ от Klimatici vtora.xlsx
-- =====================================================================
-- Редове: 142
-- Продукти: product_condition = used
-- Идемпотентност: notes LIKE 'Импорт KlimaticiVtora VTORA, лист % ред N'
-- Rollback: seeds/0015_rollback_klimatici_vtora_used_sales.sql
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
        ('Toshiba вън', 2, 'Toshiba', '506EDR', '506EDR', '506EADR', '2022-01-20'::date, 1300.0::numeric(10,2), 'СТОИЛ ХАСКОВО', '0886 616 782', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Toshiba вън ред 2'),
        ('Toshiba вън', 3, 'Toshiba', '401PV', '401PV', '401PAV', '2022-01-25'::date, 1500.0::numeric(10,2), 'ЛУБО ПАШОВ', '0878 776 056', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Toshiba вън ред 3'),
        ('Toshiba вън', 4, 'Toshiba', '361OD', '361OD', '361OAD', '2021-08-30'::date, 1000.0::numeric(10,2), 'АННА СТОЕВА', '0876 721 072', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Toshiba вън ред 4'),
        ('Toshiba вън', 5, 'Toshiba', '281NR', '281NR', '281NAR', '2022-12-22'::date, 1400.0::numeric(10,2), 'ЛИЛИЯ КОРЧЕВА', '0895 084 202', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Toshiba вън ред 5'),
        ('Toshiba вън', 7, 'Toshiba', '285GDR', '285GDR', '285GADR', '2022-10-19'::date, 1500.0::numeric(10,2), 'ИВАН БЕЧЕВ', '0882 042 511', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Toshiba вън ред 7'),
        ('Toshiba вън', 8, 'Toshiba', '281BDR', '281BDR', '281BADR', '2022-10-10'::date, 1500.0::numeric(10,2), 'НИКОЛА БЕЛЕВ', NULL::text, NULL::text, 'Импорт KlimaticiVtora VTORA, лист Toshiba вън ред 8'),
        ('Toshiba вън', 9, 'Toshiba', '2518D', '2518D', '2518AD', '2022-05-17'::date, 1200.0::numeric(10,2), 'НИКИ ГЪРКОВ', NULL::text, NULL::text, 'Импорт KlimaticiVtora VTORA, лист Toshiba вън ред 9'),
        ('Toshiba вън', 10, 'Toshiba', '3618D', '3618D', '3618AD1', '2022-10-27'::date, 1500.0::numeric(10,2), 'ВАСКО УЗУНОВ', '0878 662 122', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Toshiba вън ред 10'),
        ('Toshiba вън', 11, 'Toshiba', '361OD', '361OD', '361OAD', '2022-06-17'::date, 2000.0::numeric(10,2), 'НИКОЛАЙ ЦВЕТКОВ ГЪРЦИЯ', '0878 744 423', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Toshiba вън ред 11'),
        ('Toshiba вън', 12, 'Toshiba', 'E221E1R', 'E221E1R', 'E221E1AR', '2021-11-19'::date, 1100.0::numeric(10,2), 'АСЕН МЛАДЕНЧЕВ', '0879 384 203', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Toshiba вън ред 12 · САМОПОЧИСТВАНЕ'),
        ('Toshiba вън', 14, 'Toshiba', '2213RJ', '2213RJ', '2213ARJ', '2022-06-30'::date, 1200.0::numeric(10,2), 'ИВАН БУШЕВ', '0879 645 418', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Toshiba вън ред 14'),
        ('Toshiba вън', 15, 'Toshiba', '251BDR', '251BDR', '251BADR', '2022-07-28'::date, 1400.0::numeric(10,2), 'ГЕОРГИ СЕМЕРДЖИЕВ', '0877 826 823', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Toshiba вън ред 15'),
        ('Daikin вън', 2, 'Daikin', 'F40MTEP', 'F40MTEP', 'R40MEP', NULL::date, 1000.0::numeric(10,2), 'ТЕМЕНУЖКА БОТУНАРОВА', '0877 879 919', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 2 · стриймър, няма клапа'),
        ('Daikin вън', 3, 'Daikin', 'AN50JRPJ', 'AN50JRPJ', 'AR50JRPJ', '2022-10-07'::date, 2000.0::numeric(10,2), 'РОСЕН', '0898 949 920', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 3 · урурусарара'),
        ('Daikin вън', 4, 'Daikin', 'F40NTEP', 'F40NTEP', 'R40NEP', NULL::date, 1500.0::numeric(10,2), 'ИНВЕР МУСАТБАШЕВ', '0893 629 277', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 4'),
        ('Daikin вън', 5, 'Daikin', 'R22GPST', 'R22GPST', 'R22GPS', '2021-09-16'::date, 900.0::numeric(10,2), 'СТЕФАН ПЪРВЕНЕЦ', '0877 227 272', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 5'),
        ('Daikin вън', 6, 'Daikin', 'R22GPST', 'R22GPST', 'R22GPS', '2022-08-24'::date, 1300.0::numeric(10,2), 'ПАНАЬОТ ЧЕШМЕДЖИЕВ', '0888 307 668', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 6'),
        ('Daikin вън', 7, 'Daikin', 'F56PTEP', 'F56PTEP', 'R56PEP', NULL::date, 2000.0::numeric(10,2), 'СВИЛЕН', '0878 344 747', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 7'),
        ('Daikin вън', 8, 'Daikin', 'F22PTES', 'F22PTES', 'R22PES', '2021-11-22'::date, 1000.0::numeric(10,2), 'МАРЯН МИХАЙЛОВ', '0879 966 363', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 8'),
        ('Daikin вън', 9, 'Daikin', 'F22NTES', 'F22NTES', 'R22NES', NULL::date, 1000.0::numeric(10,2), 'СНЕЖАНА ГЮРОВА СМИЛЯН', '0878 288 781', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 9 · streamer'),
        ('Daikin вън', 11, 'Daikin', 'F22NTES', 'F22NTES', 'R22NES', '0201-09-24'::date, 1000.0::numeric(10,2), 'БИСЕР АШИКОВ РУДОЗЕМ', '0895 509 035', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 11 · streamer'),
        ('Daikin вън', 13, 'Daikin', 'няма табелка', NULL::text, 'няма табелка', '2022-05-25'::date, 1000.0::numeric(10,2), 'МАРИЯН МИХАЙЛОВ', '0879 966 363', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 13 · streamer'),
        ('Daikin вън', 14, 'Daikin', 'F22NTES', 'F22NTES', 'R22NES', NULL::date, 0.0::numeric(10,2), 'РОСЕН', '0898 949 920', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 14 · streamer'),
        ('Daikin вън', 15, 'Daikin', 'F22NTES', 'F22NTES', 'R22NES', NULL::date, 0.0::numeric(10,2), 'РОСЕН', '0898 949 920', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 15 · streamer'),
        ('Daikin вън', 16, 'Daikin', 'AN25RCS-W', 'AN25RCS-W', 'AR25RCS', '2021-11-10'::date, 1100.0::numeric(10,2), 'Северин Василев Девин -', '0895 328 003', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 16 · streamer'),
        ('Daikin вън', 17, 'Daikin', 'AN40KKP', 'AN40KKP', 'AR40KKP', '2022-01-31'::date, 1500.0::numeric(10,2), 'АНЕТА МОМЧИЛОВЦИ', '0893 860 693', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 17'),
        ('Daikin вън', 18, 'Daikin', 'F50JTNP', 'F50JTNP', 'R50JNP', '2021-09-13'::date, 1500.0::numeric(10,2), 'ДАМЯН', NULL::text, NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 18'),
        ('Daikin вън', 19, 'Daikin', 'AN22LKS', 'AN22LKS', 'AR22LKS', '2021-10-18'::date, 900.0::numeric(10,2), 'ЕМО КОВАЧЕВ', '0878 894 545', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 19'),
        ('Daikin вън', 20, 'Daikin', 'AN22MCSJ', 'AN22MCSJ', 'AR22MCSJ', '2022-02-07'::date, 0.0::numeric(10,2), 'КОКО', NULL::text, NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 20'),
        ('Daikin вън', 21, 'Daikin', 'F40NTEP-W', 'F40NTEP-W', 'R40NEP', '2022-03-12'::date, 1800.0::numeric(10,2), 'КОЛЬО ЯНАКИЕВ', '0877 676 755', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 21'),
        ('Daikin вън', 22, 'Daikin', 'F40NTEP-W', 'F40NTEP-W', 'R40NEP', '2021-11-10'::date, 1300.0::numeric(10,2), 'Веско Исмена', NULL::text, NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 22'),
        ('Daikin вън', 23, 'Daikin', 'F22NTES', 'F22NTES', 'R22NES', '2021-10-21'::date, 1000.0::numeric(10,2), 'Жасмин Альов Рудозем', '0899 168 345', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 23 · streamer'),
        ('Daikin вън', 24, 'Daikin', 'F22NTES', 'F22NTES', 'R22NES', '2021-10-21'::date, 1000.0::numeric(10,2), 'Жасмин Альов Рудозем', '0899 168 345', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 24 · streamer'),
        ('Daikin вън', 25, 'Daikin', 'F22NTES', 'F22NTES', 'R22NES', '2021-10-22'::date, 1000.0::numeric(10,2), 'Аделино', '0878 934 236', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 25 · streamer'),
        ('Daikin вън', 26, 'Daikin', 'F22NTES', 'F22NTES', 'R22NES', '2021-12-10'::date, 1000.0::numeric(10,2), 'ВЕЛИСЛАВ ХАДЖИЙСКИ', '0893 656 660', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 26 · streamer'),
        ('Daikin вън', 27, 'Daikin', 'F22NTES', 'F22NTES', 'R22NES', '2021-12-10'::date, 1000.0::numeric(10,2), 'ВЕЛИСЛАВ ХАДЖИЙСКИ', '0893 656 660', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 27 · streamer'),
        ('Daikin вън', 28, 'Daikin', 'ATP22JSE', 'ATP22JSE', 'ARP22JS', '2021-09-16'::date, 900.0::numeric(10,2), 'СТЕФАН ПЪРВЕНЕЦ', '0877 227 272', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 28'),
        ('Daikin вън', 29, 'Daikin', 'F36LTCXS', 'F36LTCXS', 'R36LCXS', '2021-11-22'::date, 1700.0::numeric(10,2), 'ЕЛЕНА ГЕОРГИЕВА', '0878 297 534', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 29'),
        ('Daikin вън', 32, 'Daikin', 'R28HTNS', 'R28HTNS', 'R28HNS', '2021-11-11'::date, 1300.0::numeric(10,2), 'ЖЕКО КАВАЛСКИ', '0897 615 734', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 32 · streamer'),
        ('Daikin вън', 33, 'Daikin', 'F22NES', 'F22NES', 'R22NES', '2021-11-10'::date, 1000.0::numeric(10,2), 'Северин Василев Девин -', '0895 328 003', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 33 · streamer'),
        ('Daikin вън', 34, 'Daikin', 'без табелка', NULL::text, 'без табелка', '2022-08-29'::date, 1050.0::numeric(10,2), 'РОСЕН КАРАДЖОВ Средногорци', '0893 385 615', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 34'),
        ('Daikin вън', 35, 'Daikin', 'F25KTNS', 'F25KTNS', 'R25KNS', '2022-08-29'::date, 1050.0::numeric(10,2), 'РОСЕН КАРАДЖОВ Средногорци', '0893 385 615', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 35'),
        ('Daikin вън', 36, 'Daikin', 'AN28MCSJ', 'AN28MCSJ', 'AR28MCSJ', NULL::date, 1600.0::numeric(10,2), 'ДИМИТЪР ДЕЛЧЕВ', '0889 778 485', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 36 · Стриймър, самопочистване'),
        ('Daikin вън', 37, 'Daikin', 'F28NTES', 'F28NTES', 'R28NES', '2021-11-04'::date, 1000.0::numeric(10,2), 'РОСЕН', '0898 949 920', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 37 · streamer'),
        ('Daikin вън', 38, 'Daikin', 'F25NTES', 'F25NTES', 'R25NES', NULL::date, 0.0::numeric(10,2), 'РОСЕН', '0898 949 920', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 38 · streamer'),
        ('Daikin вън', 39, 'Daikin', 'AN22NESJ', 'AN22NESJ', 'AR22NESj', '2022-04-20'::date, 1200.0::numeric(10,2), 'ИВАН БУШЕВ', '0879 645 418', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 39'),
        ('Daikin вън', 40, 'Daikin', 'АN22MCSJ', 'АN22MCSJ', 'AR22MCSJ', '2022-01-21'::date, 1200.0::numeric(10,2), 'КРАСИМИР ДЕНЕВ ДЕВИН', '0884 867 727', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 40 · не му работи прахосмукачката'),
        ('Daikin вън', 41, 'Daikin', 'F22NES', 'F22NES', 'R22NES', '2022-04-20'::date, 1200.0::numeric(10,2), 'ИВАН БУШЕВ', '0879 645 418', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 41 · streamer'),
        ('Daikin вън', 42, 'Daikin', 'AR22PESJ-W', 'AR22PESJ-W', 'AR22PESJ', '2022-07-27'::date, 1200.0::numeric(10,2), 'МАРТИН ГОЛЕМЕЧЕВ ДЕВИН', '0889 175 625', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 42'),
        ('Daikin вън', 45, 'Daikin', 'F22KTNS', 'F22KTNS', 'R22KNS', '2022-06-16'::date, 1200.0::numeric(10,2), 'НИКОЛАЙ ЦВЕТКОВ ГЪРЦИЯ', '0878 744 423', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 45'),
        ('Daikin вън', 46, 'Daikin', 'ATN22HSE', 'ATN22HSE', 'ARN22HS', '2022-07-26'::date, 1200.0::numeric(10,2), 'МАРТИН ГОЛЕМЕЧЕВ ДЕВИН', '0889 175 625', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 46'),
        ('Daikin вън', 47, 'Daikin', 'F25KTNS', 'F25KTNS', 'R25KNS', '2022-05-16'::date, 1200.0::numeric(10,2), 'НИКОЛАЙ ЦВЕТКОВ ГЪРЦИЯ', '0878 744 423', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Daikin вън ред 47'),
        ('Mitsubishi вън', 2, 'Mitsubishi Electric', 'GV280', NULL::text, 'GV280', '2021-12-10'::date, 1400.0::numeric(10,2), 'Хасан Илязов Върбина', '0893 921 784', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 2'),
        ('Mitsubishi вън', 4, 'Mitsubishi Electric', 'AXV289', NULL::text, 'AXV289', '2021-08-31'::date, 1200.0::numeric(10,2), 'АГЛИКА', '0895 666 756', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 4 · sensor'),
        ('Mitsubishi вън', 5, 'Mitsubishi Electric', '25TB', NULL::text, '25TB', '2021-09-07'::date, 1000.0::numeric(10,2), 'ГЕОРГИ РУДОЗЕМ', '0888 285 944', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 5'),
        ('Mitsubishi вън', 6, 'Mitsubishi Electric', '25TB', NULL::text, '25TB', '2021-10-29'::date, 1000.0::numeric(10,2), 'МАРИН МАРОКОВ', '0887 280 027', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 6'),
        ('Mitsubishi вън', 7, 'Mitsubishi Electric', 'ZW561S', NULL::text, 'ZW561S', '2022-01-25'::date, 2500.0::numeric(10,2), 'Д-Р ТАЛЕВ', '0877 733 037', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 7'),
        ('Mitsubishi вън', 8, 'Mitsubishi Electric', '28TB', NULL::text, '28TB', '2021-10-28'::date, 1300.0::numeric(10,2), 'СВИЛЕН', '0878 344 747', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 8'),
        ('Mitsubishi вън', 9, 'Mitsubishi Electric', '28TB', NULL::text, '28TB', '2021-11-10'::date, 1300.0::numeric(10,2), 'Веско Исмена', NULL::text, NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 9'),
        ('Mitsubishi вън', 10, 'Mitsubishi Electric', '25TB', NULL::text, '25TB', '2022-05-20'::date, 1150.0::numeric(10,2), 'СЕНЕХА ХОДЖОВА', '0899 534 421', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 10'),
        ('Mitsubishi вън', 11, 'Mitsubishi Electric', '25TB', NULL::text, '25TB', NULL::date, 1000.0::numeric(10,2), 'СУЗИ', '0894 473 520', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 11'),
        ('Mitsubishi вън', 12, 'Mitsubishi Electric', '25TB', NULL::text, '25TB', NULL::date, 1100.0::numeric(10,2), 'Сергей Пенев Мадан', '0895 516 074', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 12'),
        ('Mitsubishi вън', 13, 'Mitsubishi Electric', 'SV22R', NULL::text, 'SV22R', '2022-05-20'::date, 1150.0::numeric(10,2), 'СЕНЕХА ХОДЖОВА', '0899 534 421', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 13'),
        ('Mitsubishi вън', 14, 'Mitsubishi Electric', '28TB', NULL::text, '28TB', NULL::date, 1000.0::numeric(10,2), 'СУЗИ', '0894 473 520', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 14'),
        ('Mitsubishi вън', 15, 'Mitsubishi Electric', '28TB', NULL::text, '28TB', '2022-04-12'::date, 1400.0::numeric(10,2), 'ИВАН БЕЧЕВ ДЕВИН', '0882 042 511', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 15'),
        ('Mitsubishi вън', 16, 'Mitsubishi Electric', '25TB', NULL::text, '25TB', '2022-06-30'::date, 1200.0::numeric(10,2), 'ВАСИЛ АЛЕКСАНДРОВ', '0886 584 962', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 16'),
        ('Mitsubishi вън', 17, 'Mitsubishi Electric', '25TB', NULL::text, '25TB', '2022-08-08'::date, 0.0::numeric(10,2), 'Лефтер Юзеиров - Девин', '0885 633 765', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 17'),
        ('Mitsubishi вън', 19, 'Mitsubishi Electric', 'GV250', NULL::text, 'GV250', '2022-07-27'::date, 1200.0::numeric(10,2), 'МАРИЯ КОВАЧЕВА', '0878 219 159', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 19'),
        ('Mitsubishi вън', 20, 'Mitsubishi Electric', '25TB', NULL::text, '25TB', '2022-08-08'::date, 1200.0::numeric(10,2), 'ПЕНКО ПЕНЕВ', '0883 329 005', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 20'),
        ('Mitsubishi вън', 21, 'Mitsubishi Electric', '28TB', NULL::text, '28TB', '2022-07-08'::date, 1400.0::numeric(10,2), 'ПЕТЬО ОДЖАКА', '0887 631 730', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 21'),
        ('Mitsubishi вън', 22, 'Mitsubishi Electric', '28TB', NULL::text, '28TB', '2022-07-08'::date, 1400.0::numeric(10,2), 'ПЕТЬО ОДЖАКА', '0887 631 730', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Mitsubishi вън ред 22'),
        ('Nacional Вън', 2, 'Nacional', 'ЕХ228', 'ЕХ228', 'EX228A', '2021-11-11'::date, 1100.0::numeric(10,2), 'КОСТАДИН КАЛОФЕРОВ РУДОЗЕМ', '0887 348 539', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Nacional Вън ред 2'),
        ('Nacional Вън', 3, 'Nacional', 'X256A', NULL::text, 'X256A', '2022-10-24'::date, 1500.0::numeric(10,2), 'ВАСКО УЗУНОВ', '0878 662 122', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Nacional Вън ред 3'),
        ('Nacional Вън', 5, 'Nacional', 'AX286A', NULL::text, 'AX286A', '2022-08-22'::date, 1600.0::numeric(10,2), 'ВЛАДИМИР ЧЕРНЕВ', '0876 458 896', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Nacional Вън ред 5'),
        ('Nacional Вън', 6, 'Nacional', 'H225A', NULL::text, 'H225A', '2022-08-18'::date, 1100.0::numeric(10,2), 'НИКОЛАЙ РАЙЧЕВ', '0897 810 280', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Nacional Вън ред 6'),
        ('Nacional Вън', 7, 'Nacional', 'H225A', NULL::text, 'H225A', '2022-08-18'::date, 1100.0::numeric(10,2), 'НИКОЛАЙ РАЙЧЕВ', '0897 810 280', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Nacional Вън ред 7'),
        ('Nacional Вън', 8, 'Nacional', 'EX228A', NULL::text, 'EX228A', NULL::date, 1200.0::numeric(10,2), 'МАРТИН ГОЛЕМЕЧЕВ ДЕВИН', '0889 175 625', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Nacional Вън ред 8'),
        ('Nacional Вън', 10, 'Nacional', 'EX288A', NULL::text, 'EX288A', NULL::date, 1200.0::numeric(10,2), 'МАРТИН ГОЛЕМЕЧЕВ ДЕВИН', '0889 175 625', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Nacional Вън ред 10'),
        ('Nacional Вън', 11, 'Nacional', 'H228A', NULL::text, 'H228A', '2022-06-03'::date, 800.0::numeric(10,2), 'ГЕОРГИ ГЕНЧЕВ ГЪРЦИЯ', '0886 176 531', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Nacional Вън ред 11 · КЛАПА НЕ РАБОТИ'),
        ('Panasonic вън', 2, 'Panasonic', 'EX281C', NULL::text, 'EX281C', '2022-05-17'::date, 750.0::numeric(10,2), 'НАСКО', NULL::text, NULL::text, 'Импорт KlimaticiVtora VTORA, лист Panasonic вън ред 2'),
        ('Panasonic вън', 3, 'Panasonic', 'J253C', NULL::text, 'J253C', '2022-02-03'::date, 1200.0::numeric(10,2), 'ИВАН ПЕЧУРОВ', '0878 484 023', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Panasonic вън ред 3'),
        ('Panasonic вън', 4, 'Panasonic', 'V229A', NULL::text, 'V229A', '2022-08-19'::date, 1100.0::numeric(10,2), 'ТОДОР ПЕТРОВ', '0898 720 777', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Panasonic вън ред 4'),
        ('Panasonic вън', 5, 'Panasonic', 'F285C', NULL::text, 'F285C', '2021-10-12'::date, 1200.0::numeric(10,2), 'БИСЕР МИХАЙЛОВ РУДОЗЕМ', '0899 876 293', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Panasonic вън ред 5'),
        ('Panasonic вън', 6, 'Panasonic', 'F220C', NULL::text, 'F220C', '2022-08-29'::date, 700.0::numeric(10,2), 'РОСЕН КАРАДЖОВ Средногорци', '0893 385 615', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Panasonic вън ред 6 · няма капак'),
        ('Panasonic вън', 7, 'Panasonic', '285CF', NULL::text, '285CF', '2022-02-03'::date, 1200.0::numeric(10,2), 'ИВАН ПЕЧУРОВ', '0878 484 023', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Panasonic вън ред 7'),
        ('Panasonic вън', 8, 'Panasonic', 'J256C', NULL::text, 'J256C', '2021-11-04'::date, 1000.0::numeric(10,2), 'Емо Мадан', '0893 551 010', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Panasonic вън ред 8'),
        ('Panasonic вън', 9, 'Panasonic', '22TEXJ', NULL::text, '22TEXJ', '2021-11-19'::date, 1100.0::numeric(10,2), 'АСЕН МЛАДЕНЧЕВ', '0879 384 203', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Panasonic вън ред 9'),
        ('Panasonic вън', 10, 'Panasonic', '40PEX2J', NULL::text, '40PEX2J', '2021-11-25'::date, 1600.0::numeric(10,2), 'ЗАРО БЯЛА РЕКА', '0894 765 499', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Panasonic вън ред 10 · прахосмукачка аспирация еколайн, нано е'),
        ('Panasonic вън', 11, 'Panasonic', '229TB', NULL::text, '229TB', '2022-02-03'::date, 1600.0::numeric(10,2), 'ИВАН ПЕЧУРОВ', '0878 484 023', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Panasonic вън ред 11'),
        ('Panasonic вън', 12, 'Panasonic', '40TCXR2', NULL::text, '40TCXR2', '2022-08-19'::date, 2000.0::numeric(10,2), 'СИЛВА ТЮТЮНАРОВА', '0887 159 705', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Panasonic вън ред 12'),
        ('Panasonic вън', 13, 'Panasonic', '40MEX2J', NULL::text, '40MEX2J', '2022-09-01'::date, 1800.0::numeric(10,2), 'ДИМИТЪР КРЪСТАНОВ', '0884 302 230', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Panasonic вън ред 13'),
        ('Fujitsu Вън', 2, 'Fujitsu', 'A28 - nocria', NULL::text, 'A28 - nocria', '2024-07-04'::date, 1500.0::numeric(10,2), 'МОНИКА КИЧУКОВА', '0893 385 624', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Fujitsu Вън ред 2'),
        ('Fujitsu Вън', 3, 'Fujitsu', 'R22H - nocria', NULL::text, 'R22H - nocria', '2021-10-08'::date, 1500.0::numeric(10,2), 'МИТКО И МИГЛЕНА /', '0893 328 472', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Fujitsu Вън ред 3'),
        ('Fujitsu Вън', 4, 'Fujitsu', 'E22S', NULL::text, 'E22S', '2022-03-21'::date, 800.0::numeric(10,2), 'ДАНЧО', '0878 730 303', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Fujitsu Вън ред 4'),
        ('Fujitsu Вън', 5, 'Fujitsu', 'R40D', NULL::text, 'R40D', '2022-01-06'::date, 1800.0::numeric(10,2), 'МИТКО ВЪРБИНА', '0899 248 838', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Fujitsu Вън ред 5 · най-висок клас всичко има'),
        ('Fujitsu Вън', 6, 'Fujitsu', 'F28C', NULL::text, 'F28C', '2021-12-13'::date, 1500.0::numeric(10,2), 'ТОДОР', '0887 769 578', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Fujitsu Вън ред 6 · сензор, самопочистване, дигащ капак'),
        ('Fujitsu Вън', 7, 'Fujitsu', 'J22T', NULL::text, 'J22T', '2022-01-06'::date, 1000.0::numeric(10,2), 'МИТКО ВЪРБИНА', '0899 248 838', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Fujitsu Вън ред 7'),
        ('Fujitsu Вън', 8, 'Fujitsu', 'S28VNOCRIA', NULL::text, 'S28VNOCRIA', '2022-11-14'::date, 1800.0::numeric(10,2), 'ЦЕЦА БЕЧЕВА', '0877 007 339', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Fujitsu Вън ред 8'),
        ('Fujitsu Вън', 9, 'Fujitsu', 'AO22PPE', NULL::text, 'AO22PPE', '2021-10-18'::date, 500.0::numeric(10,2), 'ЕЛЕНА РАДЕВА', NULL::text, NULL::text, 'Импорт KlimaticiVtora VTORA, лист Fujitsu Вън ред 9'),
        ('Hitachi Вън', 3, 'Hitachi', 'MJ25X', NULL::text, 'MJ25X', '2023-11-02'::date, 1600.0::numeric(10,2), 'АЛЕКСАНДЪР ПЛАХОВ', '0887 934 979', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 3'),
        ('Hitachi Вън', 4, 'Hitachi', 'AJ28J', NULL::text, 'AJ28J', '2021-09-14'::date, 1000.0::numeric(10,2), 'Стоил Йорданов', '0877 879 919', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 4'),
        ('Hitachi Вън', 5, 'Hitachi', 'ET28D', NULL::text, 'ET28D', '2021-12-09'::date, 1700.0::numeric(10,2), 'ТИХОМИР ДРИНГОВ', '0878 472 255', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 5 · прахосмукачка, сензор сънлайт'),
        ('Hitachi Вън', 6, 'Hitachi', 'M28ZE7', NULL::text, 'M28ZE7', '2022-03-28'::date, 18.0::numeric(10,2), 'РАДОСТИНА', '0888 582 104', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 6'),
        ('Hitachi Вън', 7, 'Hitachi', 'JT25ZE7', NULL::text, 'JT25ZE7', '2022-01-14'::date, 1400.0::numeric(10,2), 'Костадин Куцков', '0879 221 104', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 7'),
        ('Hitachi Вън', 8, 'Hitachi', 'JT40Z2E7', NULL::text, 'JT40Z2E7', '2022-01-11'::date, 1800.0::numeric(10,2), 'МЕРИ ШУКЕРОВА', '0879 043 360', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 8'),
        ('Hitachi Вън', 10, 'Hitachi', 'MJ28Y', NULL::text, 'MJ28Y', '2022-08-19'::date, 1600.0::numeric(10,2), 'МИЛКО ЧАУШЕВ Ряка', '0878 239 006', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 10'),
        ('Hitachi Вън', 12, 'Hitachi', 'LC25X', NULL::text, 'LC25X', '2022-06-15'::date, 1300.0::numeric(10,2), 'АНКА КОЛЕВА', '0878 488 771', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 12'),
        ('Hitachi Вън', 13, 'Hitachi', 'AS25B', NULL::text, 'AS25B', '2021-11-01'::date, 1000.0::numeric(10,2), 'Младен Цонев Чепеларе', '0884 675 560', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 13'),
        ('Hitachi Вън', 14, 'Hitachi', 'E2200DJ', NULL::text, 'E2200DJ', '2022-05-17'::date, 750.0::numeric(10,2), 'НАСКО', NULL::text, NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 14'),
        ('Hitachi Вън', 15, 'Hitachi', 'AJ25C', NULL::text, 'AJ25C', '2021-11-04'::date, 1000.0::numeric(10,2), 'ГАЛЯ ПОЛИРЕС', '0878 955 581', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 15'),
        ('Hitachi Вън', 16, 'Hitachi', 'AN28C', NULL::text, 'AN28C', '2021-08-11'::date, 1200.0::numeric(10,2), 'РОСЕН АРНАУДОВ', '0878 468 636', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 16'),
        ('Hitachi Вън', 19, 'Hitachi', 'AC28C', NULL::text, 'AC28C', '2022-02-25'::date, 1400.0::numeric(10,2), 'ЯСЕН САРАЛИЕВ ГАЛИЩЕ', '0894 234 353', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 19'),
        ('Hitachi Вън', 20, 'Hitachi', 'X28X', NULL::text, 'X28X', '2023-07-13'::date, 1200.0::numeric(10,2), 'ИВАН МИРКОВ', '0887 250 851', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 20'),
        ('Hitachi Вън', 21, 'Hitachi', 'S28Z', NULL::text, 'S28Z', '2022-02-14'::date, 1400.0::numeric(10,2), 'ЛИЛИЯ МАРЧЕВА', '0878 959 420', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 21'),
        ('Hitachi Вън', 22, 'Hitachi', 'S28Z', NULL::text, 'S28Z', '2022-04-20'::date, 1500.0::numeric(10,2), 'ИВАН БУШЕВ', '0879 645 418', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Hitachi Вън ред 22'),
        ('Sanyo Вън', 2, 'Sanyo', 'ZK28X', 'ZK28X', 'CZK28X', '2023-12-19'::date, 1300.0::numeric(10,2), 'ГАМАКАБЕЛ ФИЛИП НИНОВ', '0887 581 669', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sanyo Вън ред 2'),
        ('Sanyo Вън', 3, 'Sanyo', 'ZK45R2', 'ZK45R2', 'CZK45R2', '2022-07-28'::date, 1600.0::numeric(10,2), 'ГЕОРГИ СЕМЕРДЖИЕВ', '0877 826 823', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sanyo Вън ред 3'),
        ('Sharp Вън', 2, 'Sharp', 'Z40SDY', NULL::text, 'Z40SDY', '2021-11-09'::date, 1500.0::numeric(10,2), 'НИКОЛАЙ БОНЧЕВ', '0888 705 915', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 2 · ION, PLAZMA'),
        ('Sharp Вън', 3, 'Sharp', 'Z28SEY', NULL::text, 'Z28SEY', '2022-05-26'::date, 1700.0::numeric(10,2), 'РУМЯНА ОВЧАРОВА', '0889 791 996', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 3'),
        ('Sharp Вън', 5, 'Sharp', 'C40EXY', NULL::text, 'C40EXY', '2022-01-19'::date, 1800.0::numeric(10,2), 'БИЛЯН ХРИСТОВ РУДОЗЕМ', '0885 512 820', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 5'),
        ('Sharp Вън', 6, 'Sharp', 'Y22SCY', NULL::text, 'Y22SCY', '2021-11-29'::date, 1300.0::numeric(10,2), 'АСЕН МЛАДЕНЧЕВ', '0879 384 203', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 6 · плазма, йон , аспирация, самопочистване'),
        ('Sharp Вън', 7, 'Sharp', 'F25TDY', NULL::text, 'F25TDY', '2022-03-30'::date, 1200.0::numeric(10,2), 'БОНКА МАЧОКОВА', '0878 376 015', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 7'),
        ('Sharp Вън', 9, 'Sharp', 'A28VXY', NULL::text, 'A28VXY', '2022-01-19'::date, 1800.0::numeric(10,2), 'ДАФИНКА ХРИСТОВА ЕЛХОВЕЦ', '0893 568 606', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 9'),
        ('Sharp Вън', 10, 'Sharp', '252FDY', NULL::text, '252FDY', '2021-10-21'::date, 1000.0::numeric(10,2), 'ЖАСМИН АЛЬОВ РУДОЗЕМ', '0899 168 345', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 10 · йон, плазма'),
        ('Sharp Вън', 12, 'Sharp', 'B28SXY', NULL::text, 'B28SXY', '2022-08-18'::date, 1800.0::numeric(10,2), 'НИКОЛАЙ РАЙЧЕВ мадан', '0897 810 280', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 12'),
        ('Sharp Вън', 13, 'Sharp', 'Y28SJY', NULL::text, 'Y28SJY', '2022-06-01'::date, 1800.0::numeric(10,2), 'СЕВДАЛИН КОТУЗОВ РУДОЗЕМ', '0988 788 397', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 13'),
        ('Sharp Вън', 14, 'Sharp', 'B36SXY', NULL::text, 'B36SXY', '2021-11-18'::date, 1500.0::numeric(10,2), 'ЗЛАТИНА УЗУНОВА', '0887 738 465', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 14'),
        ('Sharp Вън', 16, 'Sharp', 'A28VXY', NULL::text, 'A28VXY', '2022-06-17'::date, 1200.0::numeric(10,2), 'ДАНЧО', '0878 730 303', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 16'),
        ('Sharp Вън', 17, 'Sharp', 'D25EEY', NULL::text, 'D25EEY', '2021-10-01'::date, 1400.0::numeric(10,2), 'ВЕСЕЛИНА ЛОЗАНОВА РУДОЗЕМ', '0879 555 893', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 17'),
        ('Sharp Вън', 18, 'Sharp', 'A40SEY', NULL::text, 'A40SEY', '2022-06-29'::date, 2000.0::numeric(10,2), 'ВЕНЦИ АНГЕЛОВ', '0889 507 660', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 18'),
        ('Sharp Вън', 19, 'Sharp', 'G40SY', NULL::text, 'G40SY', '2021-11-03'::date, 1500.0::numeric(10,2), 'ДЕСИСЛАВА ДИМИТРОВА', '0877 668 788', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 19 · йон и плазма'),
        ('Sharp Вън', 20, 'Sharp', 'B28SDY', NULL::text, 'B28SDY', '2022-03-02'::date, 1500.0::numeric(10,2), 'АТАНАС БЕШИРОВ', '0878 285 712', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 20'),
        ('Sharp Вън', 21, 'Sharp', 'Z28SDY', NULL::text, 'Z28SDY', '2022-03-02'::date, 1500.0::numeric(10,2), 'АТАНАС БЕШИРОВ', '0878 285 712', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 21'),
        ('Sharp Вън', 22, 'Sharp', '405FEY', NULL::text, '405FEY', '2021-10-25'::date, 1400.0::numeric(10,2), 'Дельо', NULL::text, NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 22 · PLASMACLUSTER ION. САМОПОЧИСТВАНЕ'),
        ('Sharp Вън', 23, 'Sharp', 'А40SD-W', 'А40SD-W', 'A40SDY', '2021-07-28'::date, 1000.0::numeric(10,2), 'АЛЕКСЕЙ ДРЕНЧЕВ ЧЕПЕЛАРЕ', '0886 860 570', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 23 · PLASMACLUSTER ION'),
        ('Sharp Вън', 24, 'Sharp', 'Y28SXY', NULL::text, 'Y28SXY', '2022-05-30'::date, 1800.0::numeric(10,2), 'Краси Карабалийски', '0877 411 484', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 24 · плазма, йон , аспирация, самопочистване'),
        ('Sharp Вън', 26, 'Sharp', 'Y28SXY', NULL::text, 'Y28SXY', '2023-02-17'::date, 1000.0::numeric(10,2), 'КЪЦИ', '0887 973 896', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 26'),
        ('Sharp Вън', 27, 'Sharp', 'A25VXY', NULL::text, 'A25VXY', '2024-02-29'::date, 1500.0::numeric(10,2), 'СЕЛВИ ДЕРВИШЕВ ВЪРБИНА', '0893 679 794', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 27 · плазма, йон , аспирация, самопочистване'),
        ('Sharp Вън', 28, 'Sharp', 'E22EX', 'E22EX', 'E22EXY', '2021-10-01'::date, 1300.0::numeric(10,2), 'ВЕСЕЛИНА ЛОЗАНОВА РУДОЗЕМ', '0879 555 893', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 28'),
        ('Sharp Вън', 29, 'Sharp', 'C25SDY', NULL::text, 'C25SDY', '2022-03-14'::date, 1500.0::numeric(10,2), 'ГЕОРГИ КИСЬОВ ДЕВИН', '0878 177 198', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 29 · СМЕНЕНО ВЪТРЕШНО С ЛУКС'),
        ('Sharp Вън', 30, 'Sharp', 'A40SEY', NULL::text, 'A40SEY', '2022-06-07'::date, 1800.0::numeric(10,2), 'АНЕЛИЯ АБАДЖИЕВА', '0879 850 480', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 30 · в сервиза'),
        ('Sharp Вън', 31, 'Sharp', 'A25EE8', 'A25EE8', 'A25EEY', '2021-09-07'::date, 1500.0::numeric(10,2), 'ГЕОРГИ РУДОЗЕМ', '0888 285 944', NULL::text, 'Импорт KlimaticiVtora VTORA, лист Sharp Вън ред 31 · ЙОН, ПЛАЗМА, ЕКО, САМОПОЧИСТВАНЕ')
    ) AS stage(
      sheet_name, sheet_row, brand_name, model,
      indoor_serial, outdoor_serial, sale_date, sale_price,
      client_name, client_phone, client_address, notes
    )
    ORDER BY sheet_name, sheet_row
  LOOP
    v_product_id := NULL;
    v_contact_id := NULL;
    v_slug := 'klimatici-vtora-used-' || r.sheet_name || '-' || r.sheet_row;
    v_note := r.notes;

    IF EXISTS (
      SELECT 1 FROM public.work_items
      WHERE event_code = 'sale'
        AND notes LIKE 'Импорт KlimaticiVtora VTORA, лист ' || r.sheet_name || ' ред ' || r.sheet_row || '%'
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
      RAISE WARNING 'Klimaticivtora % row %: липсва марка %', r.sheet_name, r.sheet_row, r.brand_name;
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

  RAISE NOTICE 'Klimaticivtora used import: imported=%, skipped(existing)=%', v_imported, v_skipped;
END
$import$;
