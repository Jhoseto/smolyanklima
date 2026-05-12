-- =====================================================================
-- Seed: Клиенти от Klimatici vtora2024.xlsx (contact_kind = 'client')
-- =====================================================================
--
-- Източник: H:\Apps\SmolyanKlima\Doc\Klimatici vtora2024.xlsx
-- (6 sheets: Toshiba/Daikin/Mitsubishi/Nacional/Panasonic/Fujitsu).
--
-- Скриптът създава САМО контактни форми (име, телефон/и, адрес).
-- БЕЗ история на продажбите, БЕЗ записи в bележки.
--
-- Дедупликация:
--   * Канонизиран телефон (BG → +359…) ИЛИ нормализирано име.
--   * Между sheet-ове и в рамките на един sheet.
--
-- ИДЕМПОТЕНТНОСТ:
--   * Ако клиент с такъв телефон/име вече съществува (напр. от
--     seed 0004_clients_from_aerf) → пропуска го изцяло.
--   * Изисква миграция 0037_contacts_phone_nullable.
--
-- Контакти за вмъкване: 53
--
-- Изпълнение: копирай в Supabase SQL Editor → Run.
-- =====================================================================

BEGIN;

-- Защита: спираме, ако миграция 0037 още не е приложена.
DO $check$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts'
      AND column_name = 'phone' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Seed 0006 изисква миграция 0037_contacts_phone_nullable. Приложете я първо.';
  END IF;
END
$check$;

CREATE OR REPLACE FUNCTION pg_temp.upsert_client(
  p_full_name    text,
  p_phone        text,
  p_extra_phones text[],
  p_address      text,
  p_status       text DEFAULT 'active'
) RETURNS uuid
LANGUAGE plpgsql AS $fn$
DECLARE
  v_contact_id uuid;
  v_phone      text;
  v_idx        int := 0;
BEGIN
  IF p_phone IS NOT NULL AND length(btrim(p_phone)) >= 3 THEN
    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE phone = p_phone AND contact_kind = 'client'
    LIMIT 1;
  ELSE
    SELECT id INTO v_contact_id
    FROM public.contacts
    WHERE upper(btrim(full_name)) = upper(btrim(p_full_name))
      AND contact_kind = 'client'
      AND phone IS NULL
    LIMIT 1;
  END IF;
  IF v_contact_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.contacts (
    full_name, phone, address, contact_kind, customer_status
  ) VALUES (
    p_full_name, p_phone, p_address, 'client', p_status
  )
  RETURNING id INTO v_contact_id;

  IF p_phone IS NOT NULL AND length(btrim(p_phone)) >= 3 THEN
    INSERT INTO public.contact_phones (
      contact_id, phone, label, is_primary, sort_order
    ) VALUES (v_contact_id, p_phone, NULL, true, 0);
    v_idx := 1;
  END IF;
  IF p_extra_phones IS NOT NULL THEN
    FOREACH v_phone IN ARRAY p_extra_phones LOOP
      IF length(btrim(v_phone)) >= 3 THEN
        INSERT INTO public.contact_phones (
          contact_id, phone, label, is_primary, sort_order
        ) VALUES (v_contact_id, v_phone, NULL, false, v_idx)
        ON CONFLICT DO NOTHING;
        v_idx := v_idx + 1;
      END IF;
    END LOOP;
  END IF;

  RETURN v_contact_id;
END;
$fn$;

--   1. Анета Старева  (+359 893 860 693)
SELECT pg_temp.upsert_client(
  'Анета Старева',
  '+359893860693',
  NULL::text[],
  NULL
);

--   2. Антонио  (+359 898 873 636)
SELECT pg_temp.upsert_client(
  'Антонио',
  '+359898873636',
  NULL::text[],
  NULL
);

--   3. Асен Павлов  (+359 878 240 722)
SELECT pg_temp.upsert_client(
  'Асен Павлов',
  '+359878240722',
  NULL::text[],
  NULL
);

--   4. Бойко Челебиев  (+359 877 525 227)
SELECT pg_temp.upsert_client(
  'Бойко Челебиев',
  '+359877525227',
  ARRAY['+359899957799']::text[],
  NULL
);

--   5. Валентина Георгиева  (+359 892 390 638)
SELECT pg_temp.upsert_client(
  'Валентина Георгиева',
  '+359892390638',
  NULL::text[],
  NULL
);

--   6. Виолета Топузлиева  (+359 988 763 059)
SELECT pg_temp.upsert_client(
  'Виолета Топузлиева',
  '+359988763059',
  NULL::text[],
  NULL
);

--   7. Владимир Бошнаков  (+359 878 849 961)
SELECT pg_temp.upsert_client(
  'Владимир Бошнаков',
  '+359878849961',
  NULL::text[],
  'СОФИЯ'
);

--   8. Владимир Моллов  (+359 878 248 682)
SELECT pg_temp.upsert_client(
  'Владимир Моллов',
  '+359878248682',
  NULL::text[],
  NULL
);

--   9. Владислав  (+359 893 736 784)
SELECT pg_temp.upsert_client(
  'Владислав',
  '+359893736784',
  NULL::text[],
  NULL
);

--  10. Десислава  (+359 893 544 611)
SELECT pg_temp.upsert_client(
  'Десислава',
  '+359893544611',
  NULL::text[],
  NULL
);

--  11. Деян Пулев  (+359 893 343 664)
SELECT pg_temp.upsert_client(
  'Деян Пулев',
  '+359893343664',
  NULL::text[],
  'Мадан'
);

--  12. Евгени Якимов  (+359 878 885 455)
SELECT pg_temp.upsert_client(
  'Евгени Якимов',
  '+359878885455',
  NULL::text[],
  NULL
);

--  13. Живко  (+359 878 202 036)
SELECT pg_temp.upsert_client(
  'Живко',
  '+359878202036',
  NULL::text[],
  'МОМЧИЛОВЦИ'
);

--  14. Живко Тодоров  (+359 878 585 885)
SELECT pg_temp.upsert_client(
  'Живко Тодоров',
  '+359878585885',
  NULL::text[],
  NULL
);

--  15. Заро  (+359 878 229 291)
SELECT pg_temp.upsert_client(
  'Заро',
  '+359878229291',
  NULL::text[],
  NULL
);

--  16. Звезделин Манев  (+359 878 767 973)
SELECT pg_temp.upsert_client(
  'Звезделин Манев',
  '+359878767973',
  NULL::text[],
  NULL
);

--  17. Илиян Кадиев  (+359 884 701 652)
SELECT pg_temp.upsert_client(
  'Илиян Кадиев',
  '+359884701652',
  NULL::text[],
  NULL
);

--  18. Исмет Караасенов  (+359 896 929 209)
SELECT pg_temp.upsert_client(
  'Исмет Караасенов',
  '+359896929209',
  NULL::text[],
  NULL
);

--  19. Йордана Зайчева  (+359 878 907 151)
SELECT pg_temp.upsert_client(
  'Йордана Зайчева',
  '+359878907151',
  NULL::text[],
  NULL
);

--  20. Лазар Василев  (+447477129668)
SELECT pg_temp.upsert_client(
  'Лазар Василев',
  '+447477129668',
  ARRAY['+359893406276']::text[],
  NULL
);

--  21. Лефтер Юзейров  (+359 885 633 765)
SELECT pg_temp.upsert_client(
  'Лефтер Юзейров',
  '+359885633765',
  NULL::text[],
  NULL
);

--  22. Мариян Михайлов  (+359 879 966 363)
SELECT pg_temp.upsert_client(
  'Мариян Михайлов',
  '+359879966363',
  NULL::text[],
  'ФАТОВО'
);

--  23. Мартин Божанов  (+359 878 318 737)
SELECT pg_temp.upsert_client(
  'Мартин Божанов',
  '+359878318737',
  NULL::text[],
  NULL
);

--  24. Мехмед Мехмед  (+359 877 792 233)
SELECT pg_temp.upsert_client(
  'Мехмед Мехмед',
  '+359877792233',
  NULL::text[],
  NULL
);

--  25. Милена Истрефова  (+359 877 818 163)
SELECT pg_temp.upsert_client(
  'Милена Истрефова',
  '+359877818163',
  NULL::text[],
  NULL
);

--  26. Наско Джиджов Национал  (+359 879 888 299)
SELECT pg_temp.upsert_client(
  'Наско Джиджов Национал',
  '+359879888299',
  NULL::text[],
  NULL
);

--  27. Николай Симеонов  (+359 882 705 379)
SELECT pg_temp.upsert_client(
  'Николай Симеонов',
  '+359882705379',
  NULL::text[],
  NULL
);

--  28. Панайот Чешмеджиев  (+359 888 307 668)
SELECT pg_temp.upsert_client(
  'Панайот Чешмеджиев',
  '+359888307668',
  NULL::text[],
  NULL
);

--  29. Петър Йорданов  (+359 876 243 315)
SELECT pg_temp.upsert_client(
  'Петър Йорданов',
  '+359876243315',
  NULL::text[],
  NULL
);

--  30. Петър Тодоров  (+359 879 933 443)
SELECT pg_temp.upsert_client(
  'Петър Тодоров',
  '+359879933443',
  NULL::text[],
  NULL
);

--  31. Селви Мехмедалиев  (+359 893 656 171)
SELECT pg_temp.upsert_client(
  'Селви Мехмедалиев',
  '+359893656171',
  NULL::text[],
  NULL
);

--  32. Сергей  (+359 898 579 235)
SELECT pg_temp.upsert_client(
  'Сергей',
  '+359898579235',
  NULL::text[],
  NULL
);

--  33. Сергей Пенев  (+359 895 516 074)
SELECT pg_temp.upsert_client(
  'Сергей Пенев',
  '+359895516074',
  NULL::text[],
  NULL
);

--  34. Силви Карамитев  (+359 893 368 506)
SELECT pg_temp.upsert_client(
  'Силви Карамитев',
  '+359893368506',
  NULL::text[],
  'ВЪРБИНА'
);

--  35. Станислав  (+359 876 636 387)
SELECT pg_temp.upsert_client(
  'Станислав',
  '+359876636387',
  NULL::text[],
  NULL
);

--  36. Стефан Лазаров  (+359 876 440 854)
SELECT pg_temp.upsert_client(
  'Стефан Лазаров',
  '+359876440854',
  NULL::text[],
  NULL
);

--  37. Съби Тамашов  (+359 888 566 454)
SELECT pg_temp.upsert_client(
  'Съби Тамашов',
  '+359888566454',
  NULL::text[],
  NULL
);

--  38. Тасо  (+359 884 463 040)
SELECT pg_temp.upsert_client(
  'Тасо',
  '+359884463040',
  NULL::text[],
  'ЧЕПЕЛАРЕ'
);

--  39. Тодор Петров  (+359 898 720 777)
SELECT pg_temp.upsert_client(
  'Тодор Петров',
  '+359898720777',
  NULL::text[],
  NULL
);

--  40. Тони Ангелов  (+359 879 557 928)
SELECT pg_temp.upsert_client(
  'Тони Ангелов',
  '+359879557928',
  NULL::text[],
  NULL
);

--  41. Фахри Волевски  (+4915736044084)
SELECT pg_temp.upsert_client(
  'Фахри Волевски',
  '+4915736044084',
  NULL::text[],
  NULL
);

--  42. Шваба  (+359 878 599 877)
SELECT pg_temp.upsert_client(
  'Шваба',
  '+359878599877',
  NULL::text[],
  NULL
);

--  43. Вера Алексиева  (без телефон)
SELECT pg_temp.upsert_client(
  'Вера Алексиева',
  NULL,
  NULL::text[],
  'ПЛОВДИВ'
);

--  44. Гамакабел  (без телефон)
SELECT pg_temp.upsert_client(
  'Гамакабел',
  NULL,
  NULL::text[],
  NULL
);

--  45. Георги  (без телефон)
SELECT pg_temp.upsert_client(
  'Георги',
  NULL,
  NULL::text[],
  'Гърция'
);

--  46. Диана Добрева  (без телефон)
SELECT pg_temp.upsert_client(
  'Диана Добрева',
  NULL,
  NULL::text[],
  'с. ВАСИЛ ЛЕВСКИ'
);

--  47. Костадин Калайджиев  (без телефон)
SELECT pg_temp.upsert_client(
  'Костадин Калайджиев',
  NULL,
  NULL::text[],
  NULL
);

--  48. Митко Мазара  (без телефон)
SELECT pg_temp.upsert_client(
  'Митко Мазара',
  NULL,
  NULL::text[],
  NULL
);

--  49. Пловдив - Кръстьо  (без телефон)
SELECT pg_temp.upsert_client(
  'Пловдив - Кръстьо',
  NULL,
  NULL::text[],
  NULL
);

--  50. Росен  (без телефон)
SELECT pg_temp.upsert_client(
  'Росен',
  NULL,
  NULL::text[],
  'МАДАН'
);

--  51. Сашо Секулов  (без телефон)
SELECT pg_temp.upsert_client(
  'Сашо Секулов',
  NULL,
  NULL::text[],
  'ПЛОВДИВ'
);

--  52. Стефан  (без телефон)
SELECT pg_temp.upsert_client(
  'Стефан',
  NULL,
  NULL::text[],
  NULL
);

--  53. Стоян Чавдаров  (без телефон)
SELECT pg_temp.upsert_client(
  'Стоян Чавдаров',
  NULL,
  NULL::text[],
  'ГЪРЦИЯ'
);

COMMIT;
