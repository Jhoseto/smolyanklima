-- =====================================================================
-- Seed: Клиенти от aerf.xls (contact_kind = 'client')
-- =====================================================================
--
-- Източник: H:\Apps\SmolyanKlima\Doc\aerf.xls — листи EUROPA + JAPAN.
--
-- Скриптът създава САМО контактни форми (име, телефон/и, адрес).
-- БЕЗ история на продажбите — те ще се водят оперативно през UI-то.
--
-- Дедупликация:
--   * По канонизиран телефон (BG → +359…) ИЛИ case-insensitive име
--     ако телефонът липсва.
--   * customer_status = 'active' (имали са поне една продажба).
--
-- ИДЕМПОТЕНТНОСТ:
--   * Ако клиент с такъв телефон/име вече съществува → пропуска го
--     изцяло (не презаписва ръчни редакции).
--   * Изисква миграция 0037_contacts_phone_nullable за клиентите без
--     телефон (ИСМЕНА, ДАВИДКОВО, АСЕН АСЕНОВ и др.).
--
-- Контакти за вмъкване: 212
--
-- Изпълнение: psql ... -f 0004_clients_from_aerf.sql
--             ИЛИ копирай в Supabase SQL Editor.
-- =====================================================================

begin;

-- Защита: спираме seed-а, ако миграция 0037 още не е приложена.
do $check$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'contacts'
      and column_name = 'phone' and is_nullable = 'NO'
  ) then
    raise exception 'Seed 0004 изисква миграция 0037_contacts_phone_nullable. Приложете я първо.';
  end if;
end
$check$;

create or replace function pg_temp.upsert_client(
  p_full_name    text,
  p_phone        text,
  p_extra_phones text[],
  p_address      text,
  p_status       text default 'active'
) returns uuid
language plpgsql as $$
declare
  v_contact_id uuid;
  v_phone      text;
  v_idx        int := 0;
begin
  -- Lookup по телефон ИЛИ име
  if p_phone is not null and length(btrim(p_phone)) >= 3 then
    select id into v_contact_id
    from public.contacts
    where phone = p_phone and contact_kind = 'client'
    limit 1;
  else
    select id into v_contact_id
    from public.contacts
    where upper(btrim(full_name)) = upper(btrim(p_full_name))
      and contact_kind = 'client'
      and phone is null
    limit 1;
  end if;
  if v_contact_id is not null then
    return null;  -- вече съществува
  end if;

  insert into public.contacts (
    full_name, phone, address, contact_kind, customer_status
  ) values (
    p_full_name, p_phone, p_address, 'client', p_status
  )
  returning id into v_contact_id;

  -- contact_phones — основен + допълнителни
  if p_phone is not null and length(btrim(p_phone)) >= 3 then
    insert into public.contact_phones (
      contact_id, phone, label, is_primary, sort_order
    ) values (v_contact_id, p_phone, null, true, 0);
    v_idx := 1;
  end if;
  if p_extra_phones is not null then
    foreach v_phone in array p_extra_phones loop
      if length(btrim(v_phone)) >= 3 then
        insert into public.contact_phones (
          contact_id, phone, label, is_primary, sort_order
        ) values (v_contact_id, v_phone, null, false, v_idx)
        on conflict do nothing;
        v_idx := v_idx + 1;
      end if;
    end loop;
  end if;

  return v_contact_id;
end;
$$;

--   1. Адриана  (+359 878 342 862)
select pg_temp.upsert_client(
  'Адриана',
  '+359878342862',
  NULL::text[],
  NULL
);

--   2. Айдин Върбинов  (+359 899 808 922)
select pg_temp.upsert_client(
  'Айдин Върбинов',
  '+359899808922',
  NULL::text[],
  NULL
);

--   3. Албен Хубенов  (+359 888 531 159)
select pg_temp.upsert_client(
  'Албен Хубенов',
  '+359888531159',
  NULL::text[],
  NULL
);

--   4. Алберт Еленски  (+359 888 938 010)
select pg_temp.upsert_client(
  'Алберт Еленски',
  '+359888938010',
  NULL::text[],
  NULL
);

--   5. Алекс Радигов  (+359 893 381 386)
select pg_temp.upsert_client(
  'Алекс Радигов',
  '+359893381386',
  NULL::text[],
  NULL
);

--   6. Александър Качаров  (+359 876 712 953)
select pg_temp.upsert_client(
  'Александър Качаров',
  '+359876712953',
  NULL::text[],
  NULL
);

--   7. Александър Мичинов  (+359 894 486 841)
select pg_temp.upsert_client(
  'Александър Мичинов',
  '+359894486841',
  NULL::text[],
  NULL
);

--   8. Александър Секулов  (+359 888 772 422)
select pg_temp.upsert_client(
  'Александър Секулов',
  '+359888772422',
  NULL::text[],
  'с. Гълъбово'
);

--   9. Александър Терзиев  (+359 895 525 602)
select pg_temp.upsert_client(
  'Александър Терзиев',
  '+359895525602',
  NULL::text[],
  NULL
);

--  10. Ана Чанкова  (+359 888 285 793)
select pg_temp.upsert_client(
  'Ана Чанкова',
  '+359888285793',
  NULL::text[],
  NULL
);

--  11. Ангелина Аврамова  (+359 879 376 605)
select pg_temp.upsert_client(
  'Ангелина Аврамова',
  '+359879376605',
  NULL::text[],
  NULL
);

--  12. Андро Черна  (+359 893 495 656)
select pg_temp.upsert_client(
  'Андро Черна',
  '+359893495656',
  NULL::text[],
  NULL
);

--  13. Анита Ратайска  (+359 877 582 939)
select pg_temp.upsert_client(
  'Анита Ратайска',
  '+359877582939',
  NULL::text[],
  NULL
);

--  14. Антоан Райчев  (+359 888 941 904)
select pg_temp.upsert_client(
  'Антоан Райчев',
  '+359888941904',
  NULL::text[],
  NULL
);

--  15. Антон Иванов  (+359 888 375 799)
select pg_temp.upsert_client(
  'Антон Иванов',
  '+359888375799',
  NULL::text[],
  NULL
);

--  16. Антония Бабашева  (+359 894 744 275)
select pg_temp.upsert_client(
  'Антония Бабашева',
  '+359894744275',
  NULL::text[],
  NULL
);

--  17. Артур  (+359 878 621 279)
select pg_temp.upsert_client(
  'Артур',
  '+359878621279',
  NULL::text[],
  NULL
);

--  18. Асен Асенов  (+359 888 057 278)
select pg_temp.upsert_client(
  'Асен Асенов',
  '+359888057278',
  NULL::text[],
  NULL
);

--  19. Асен Кехайов  (+359 876 505 067)
select pg_temp.upsert_client(
  'Асен Кехайов',
  '+359876505067',
  NULL::text[],
  NULL
);

--  20. Атанас Капсъзов  (+359 878 461 913)
select pg_temp.upsert_client(
  'Атанас Капсъзов',
  '+359878461913',
  NULL::text[],
  NULL
);

--  21. Атанас Пелтеков  (+359 877 266 999)
select pg_temp.upsert_client(
  'Атанас Пелтеков',
  '+359877266999',
  NULL::text[],
  NULL
);

--  22. Ахмед Ахмедов  (+359 895 466 608)
select pg_temp.upsert_client(
  'Ахмед Ахмедов',
  '+359895466608',
  NULL::text[],
  NULL
);

--  23. Бейхан Топчиев  (+359 893 328 415)
select pg_temp.upsert_client(
  'Бейхан Топчиев',
  '+359893328415',
  NULL::text[],
  NULL
);

--  24. Бесри Карасалихов  (+359 894 449 303)
select pg_temp.upsert_client(
  'Бесри Карасалихов',
  '+359894449303',
  NULL::text[],
  NULL
);

--  25. Билял Ходжов  (+359 894 315 139)
select pg_temp.upsert_client(
  'Билял Ходжов',
  '+359894315139',
  NULL::text[],
  NULL
);

--  26. Биляна Каукова  (+359 897 425 094)
select pg_temp.upsert_client(
  'Биляна Каукова',
  '+359897425094',
  NULL::text[],
  'БЯЛА РЕКА'
);

--  27. Бисер Хаджов  (+359 889 022 860)
select pg_temp.upsert_client(
  'Бисер Хаджов',
  '+359889022860',
  NULL::text[],
  NULL
);

--  28. Богомил Цветанов  (+359 885 597 129)
select pg_temp.upsert_client(
  'Богомил Цветанов',
  '+359885597129',
  NULL::text[],
  NULL
);

--  29. Борислав Коленаров  (+359 888 278 870)
select pg_temp.upsert_client(
  'Борислав Коленаров',
  '+359888278870',
  NULL::text[],
  NULL
);

--  30. Борислав Лясково  (+359 887 348 411)
select pg_temp.upsert_client(
  'Борислав Лясково',
  '+359887348411',
  NULL::text[],
  NULL
);

--  31. Борислав Чилингиров  (+359 878 306 888)
select pg_temp.upsert_client(
  'Борислав Чилингиров',
  '+359878306888',
  NULL::text[],
  NULL
);

--  32. Валя Мадан  (+359 897 039 840)
select pg_temp.upsert_client(
  'Валя Мадан',
  '+359897039840',
  NULL::text[],
  NULL
);

--  33. Ваня Даридкова  (+359 878 209 514)
select pg_temp.upsert_client(
  'Ваня Даридкова',
  '+359878209514',
  NULL::text[],
  NULL
);

--  34. Ваня Малашева  (+359 896 245 721)
select pg_temp.upsert_client(
  'Ваня Малашева',
  '+359896245721',
  NULL::text[],
  NULL
);

--  35. Ваня Николова  (+359 879 524 450)
select pg_temp.upsert_client(
  'Ваня Николова',
  '+359879524450',
  NULL::text[],
  NULL
);

--  36. Ваня Чолакова  (+359 897 898 339)
select pg_temp.upsert_client(
  'Ваня Чолакова',
  '+359897898339',
  NULL::text[],
  NULL
);

--  37. Васко Узунов  (+359 877 980 616)
select pg_temp.upsert_client(
  'Васко Узунов',
  '+359877980616',
  NULL::text[],
  NULL
);

--  38. Велин Терзиев  (+359 898 942 696)
select pg_temp.upsert_client(
  'Велин Терзиев',
  '+359898942696',
  NULL::text[],
  NULL
);

--  39. Величко  (+359 879 377 324)
select pg_temp.upsert_client(
  'Величко',
  '+359879377324',
  NULL::text[],
  NULL
);

--  40. Венелин Огнянов  (+359 886 461 855)
select pg_temp.upsert_client(
  'Венелин Огнянов',
  '+359886461855',
  NULL::text[],
  NULL
);

--  41. Венци Ораков  (+359 894 768 048)
select pg_temp.upsert_client(
  'Венци Ораков',
  '+359894768048',
  NULL::text[],
  NULL
);

--  42. Вера Русева  (+359 899 942 362)
select pg_temp.upsert_client(
  'Вера Русева',
  '+359899942362',
  NULL::text[],
  NULL
);

--  43. Виктор Сарджев -радослава Милева  (+359 882 472 048)
select pg_temp.upsert_client(
  'Виктор Сарджев -радослава Милева',
  '+359882472048',
  NULL::text[],
  NULL
);

--  44. Вили Пехливанова  (+359 888 332 926)
select pg_temp.upsert_client(
  'Вили Пехливанова',
  '+359888332926',
  NULL::text[],
  'Елстрой'
);

--  45. Владимир Моллов  (+359 878 248 682)
select pg_temp.upsert_client(
  'Владимир Моллов',
  '+359878248682',
  NULL::text[],
  NULL
);

--  46. Владислав Кьоровски  (+359 886 860 361)
select pg_temp.upsert_client(
  'Владислав Кьоровски',
  '+359886860361',
  NULL::text[],
  NULL
);

--  47. Владо  (+359 893 089 185)
select pg_temp.upsert_client(
  'Владо',
  '+359893089185',
  NULL::text[],
  NULL
);

--  48. Владо Петров  (+359 898 722 419)
select pg_temp.upsert_client(
  'Владо Петров',
  '+359898722419',
  NULL::text[],
  NULL
);

--  49. Владо ТАБАКОВ  (+359 876 855 810)
select pg_temp.upsert_client(
  'Владо ТАБАКОВ',
  '+359876855810',
  NULL::text[],
  NULL
);

--  50. Галина Николова  (+359 886 053 425)
select pg_temp.upsert_client(
  'Галина Николова',
  '+359886053425',
  NULL::text[],
  NULL
);

--  51. Галина Руколска  (+359 886 442 616)
select pg_temp.upsert_client(
  'Галина Руколска',
  '+359886442616',
  NULL::text[],
  NULL
);

--  52. Гергана Стойчева  (+359 894 252 073)
select pg_temp.upsert_client(
  'Гергана Стойчева',
  '+359894252073',
  NULL::text[],
  NULL
);

--  53. Д-р Фотев  (+359 888 639 252)
select pg_temp.upsert_client(
  'Д-р Фотев',
  '+359888639252',
  NULL::text[],
  NULL
);

--  54. Д-р Ябруди  (+359 889 548 849)
select pg_temp.upsert_client(
  'Д-р Ябруди',
  '+359889548849',
  NULL::text[],
  NULL
);

--  55. Даян Чолаков Могилица  (+359 877 885 563)
select pg_temp.upsert_client(
  'Даян Чолаков Могилица',
  '+359877885563',
  NULL::text[],
  NULL
);

--  56. Денис Салиев  (+359 887 075 177)
select pg_temp.upsert_client(
  'Денис Салиев',
  '+359887075177',
  NULL::text[],
  'ЧАЛА'
);

--  57. Денислав Гадженаков  (+359 879 568 692)
select pg_temp.upsert_client(
  'Денислав Гадженаков',
  '+359879568692',
  NULL::text[],
  NULL
);

--  58. Десислава Гаджалова  (+359 895 723 724)
select pg_temp.upsert_client(
  'Десислава Гаджалова',
  '+359895723724',
  NULL::text[],
  NULL
);

--  59. Деян Димитров  (+359 895 652 161)
select pg_temp.upsert_client(
  'Деян Димитров',
  '+359895652161',
  NULL::text[],
  NULL
);

--  60. Джан  (+359 883 970 708)
select pg_temp.upsert_client(
  'Джан',
  '+359883970708',
  NULL::text[],
  NULL
);

--  61. Дидо  (+359 877 501 573)
select pg_temp.upsert_client(
  'Дидо',
  '+359877501573',
  NULL::text[],
  NULL
);

--  62. Димитър Дерменджиев  (+359 898 300 156)
select pg_temp.upsert_client(
  'Димитър Дерменджиев',
  '+359898300156',
  NULL::text[],
  NULL
);

--  63. Димитър Рудозем Училището  (+359 879 366 290)
select pg_temp.upsert_client(
  'Димитър Рудозем Училището',
  '+359879366290',
  NULL::text[],
  NULL
);

--  64. Димитър Хаджиев  (+359 898 585 647)
select pg_temp.upsert_client(
  'Димитър Хаджиев',
  '+359898585647',
  NULL::text[],
  NULL
);

--  65. Димо Мадан  (+359 895 808 888)
select pg_temp.upsert_client(
  'Димо Мадан',
  '+359895808888',
  NULL::text[],
  NULL
);

--  66. Доби  (+359 884 535 388)
select pg_temp.upsert_client(
  'Доби',
  '+359884535388',
  NULL::text[],
  NULL
);

--  67. Добринка Делиева  (+359 887 109 600)
select pg_temp.upsert_client(
  'Добринка Делиева',
  '+359887109600',
  NULL::text[],
  NULL
);

--  68. Екатерина Костова  (+359 894 350 492)
select pg_temp.upsert_client(
  'Екатерина Костова',
  '+359894350492',
  NULL::text[],
  NULL
);

--  69. Екатерина Чернева  (+359 876 970 980)
select pg_temp.upsert_client(
  'Екатерина Чернева',
  '+359876970980',
  NULL::text[],
  NULL
);

--  70. Емил Димов Вини Стил  (+359 888 326 016)
select pg_temp.upsert_client(
  'Емил Димов Вини Стил',
  '+359888326016',
  NULL::text[],
  NULL
);

--  71. Емил Йорданов  (+359 877 999 949)
select pg_temp.upsert_client(
  'Емил Йорданов',
  '+359877999949',
  NULL::text[],
  NULL
);

--  72. Емил Маджиров  (+359 893 328 398)
select pg_temp.upsert_client(
  'Емил Маджиров',
  '+359893328398',
  NULL::text[],
  NULL
);

--  73. Емилия Бачочева  (+359 899 303 100)
select pg_temp.upsert_client(
  'Емилия Бачочева',
  '+359899303100',
  NULL::text[],
  NULL
);

--  74. Емилия Лисова  (+359 878 636 566)
select pg_temp.upsert_client(
  'Емилия Лисова',
  '+359878636566',
  NULL::text[],
  NULL
);

--  75. Жоро Зеленчука  (+359 879 848 473)
select pg_temp.upsert_client(
  'Жоро Зеленчука',
  '+359879848473',
  NULL::text[],
  NULL
);

--  76. Жулия Младенова  (+359 896 667 835)
select pg_temp.upsert_client(
  'Жулия Младенова',
  '+359896667835',
  NULL::text[],
  NULL
);

--  77. Зарко Игнатов  (+359 893 633 804)
select pg_temp.upsert_client(
  'Зарко Игнатов',
  '+359893633804',
  NULL::text[],
  NULL
);

--  78. Захри Размански Бяла Река  (+359 899 602 780)
select pg_temp.upsert_client(
  'Захри Размански Бяла Река',
  '+359899602780',
  NULL::text[],
  NULL
);

--  79. Здравко Асенов  (+359 877 685 246)
select pg_temp.upsert_client(
  'Здравко Асенов',
  '+359877685246',
  NULL::text[],
  NULL
);

--  80. Здравко Мирчев БАНИТЕ  (+359 878 143 221)
select pg_temp.upsert_client(
  'Здравко Мирчев БАНИТЕ',
  '+359878143221',
  NULL::text[],
  NULL
);

--  81. Златка Или Румен  (+359 889 995 099)
select pg_temp.upsert_client(
  'Златка Или Румен',
  '+359889995099',
  NULL::text[],
  NULL
);

--  82. Зюлкив Чукаров  (+359 898 994 265)
select pg_temp.upsert_client(
  'Зюлкив Чукаров',
  '+359898994265',
  NULL::text[],
  NULL
);

--  83. Иван Бучаков  (+359 889 856 782)
select pg_temp.upsert_client(
  'Иван Бучаков',
  '+359889856782',
  NULL::text[],
  NULL
);

--  84. Иван Илиев  (+359 882 780 545)
select pg_temp.upsert_client(
  'Иван Илиев',
  '+359882780545',
  NULL::text[],
  NULL
);

--  85. Иван Куков  (+359 878 995 431)
select pg_temp.upsert_client(
  'Иван Куков',
  '+359878995431',
  NULL::text[],
  NULL
);

--  86. Иван Лазов  (+359 879 555 080)
select pg_temp.upsert_client(
  'Иван Лазов',
  '+359879555080',
  NULL::text[],
  NULL
);

--  87. Иван Христов  (+359 888 153 377)
select pg_temp.upsert_client(
  'Иван Христов',
  '+359888153377',
  NULL::text[],
  NULL
);

--  88. Иво Козарев  (+359 893 667 379)
select pg_temp.upsert_client(
  'Иво Козарев',
  '+359893667379',
  NULL::text[],
  NULL
);

--  89. Илко Велинов  (+359 889 209 464)
select pg_temp.upsert_client(
  'Илко Велинов',
  '+359889209464',
  NULL::text[],
  NULL
);

--  90. Йордан Дудински  (+359 877 828 205)
select pg_temp.upsert_client(
  'Йордан Дудински',
  '+359877828205',
  NULL::text[],
  NULL
);

--  91. Йорданка Марушкова  (+359 895 834 828)
select pg_temp.upsert_client(
  'Йорданка Марушкова',
  '+359895834828',
  NULL::text[],
  'Чепеларе'
);

--  92. Кадефина  (+359 895 833 636)
select pg_temp.upsert_client(
  'Кадефина',
  '+359895833636',
  NULL::text[],
  NULL
);

--  93. Калин Оджаков  (+359 887 889 433)
select pg_temp.upsert_client(
  'Калин Оджаков',
  '+359887889433',
  NULL::text[],
  NULL
);

--  94. Катя Чочева  (+359 897 041 403)
select pg_temp.upsert_client(
  'Катя Чочева',
  '+359897041403',
  NULL::text[],
  NULL
);

--  95. Кос Смолян Поли  (+359 879 575 663)
select pg_temp.upsert_client(
  'Кос Смолян Поли',
  '+359879575663',
  NULL::text[],
  NULL
);

--  96. Костадин Камбарев  (+359 887 568 786)
select pg_temp.upsert_client(
  'Костадин Камбарев',
  '+359887568786',
  NULL::text[],
  NULL
);

--  97. Красимира Балчева  (+359 895 749 894)
select pg_temp.upsert_client(
  'Красимира Балчева',
  '+359895749894',
  NULL::text[],
  NULL
);

--  98. Лазар Найденов  (+359 887 954 888)
select pg_temp.upsert_client(
  'Лазар Найденов',
  '+359887954888',
  NULL::text[],
  NULL
);

--  99. Ленко Петков  (+359 895 557 281)
select pg_temp.upsert_client(
  'Ленко Петков',
  '+359895557281',
  NULL::text[],
  NULL
);

-- 100. Лиляна Йовкова  (+359 883 749 559)
select pg_temp.upsert_client(
  'Лиляна Йовкова',
  '+359883749559',
  NULL::text[],
  NULL
);

-- 101. Лиляна, Пловдив  (+359 899 925 846)
select pg_temp.upsert_client(
  'Лиляна, Пловдив',
  '+359899925846',
  NULL::text[],
  'ул. Богомил 58'
);

-- 102. Лъчезар Борназов Леска  (+359 893 327 411)
select pg_temp.upsert_client(
  'Лъчезар Борназов Леска',
  '+359893327411',
  NULL::text[],
  NULL
);

-- 103. Любен Калеканов  (+359 887 488 392)
select pg_temp.upsert_client(
  'Любен Калеканов',
  '+359887488392',
  NULL::text[],
  NULL
);

-- 104. Любозар Матев  (+359 878 515 300)
select pg_temp.upsert_client(
  'Любозар Матев',
  '+359878515300',
  NULL::text[],
  NULL
);

-- 105. Мария Димитрова  (+359 897 293 811)
select pg_temp.upsert_client(
  'Мария Димитрова',
  '+359897293811',
  NULL::text[],
  NULL
);

-- 106. Мария Разумова  (+359 883 354 877)
select pg_temp.upsert_client(
  'Мария Разумова',
  '+359883354877',
  NULL::text[],
  NULL
);

-- 107. Марта Савова  (+359 896 864 968)
select pg_temp.upsert_client(
  'Марта Савова',
  '+359896864968',
  NULL::text[],
  NULL
);

-- 108. Мартин  (+359 898 997 747)
select pg_temp.upsert_client(
  'Мартин',
  '+359898997747',
  NULL::text[],
  'ВЪРБИНА'
);

-- 109. Милен Баните  (+31643437063)
select pg_temp.upsert_client(
  'Милен Баните',
  '+31643437063',
  NULL::text[],
  NULL
);

-- 110. Минка Смоладска  (+359 896 744 991)
select pg_temp.upsert_client(
  'Минка Смоладска',
  '+359896744991',
  NULL::text[],
  NULL
);

-- 111. Миро Вишнево  (+31611752282)
select pg_temp.upsert_client(
  'Миро Вишнево',
  '+31611752282',
  NULL::text[],
  NULL
);

-- 112. Мирослав Караасенов  (+359 878 788 397)
select pg_temp.upsert_client(
  'Мирослав Караасенов',
  '+359878788397',
  NULL::text[],
  NULL
);

-- 113. Мирослав Караасенов  (+359 878 788 398)
select pg_temp.upsert_client(
  'Мирослав Караасенов',
  '+359878788398',
  NULL::text[],
  NULL
);

-- 114. Мирослав Караасенов  (+359 878 788 399)
select pg_temp.upsert_client(
  'Мирослав Караасенов',
  '+359878788399',
  NULL::text[],
  NULL
);

-- 115. Мирослав Прахов  (+359 899 766 611)
select pg_temp.upsert_client(
  'Мирослав Прахов',
  '+359899766611',
  NULL::text[],
  NULL
);

-- 116. Митака  (+359 878 700 589)
select pg_temp.upsert_client(
  'Митака',
  '+359878700589',
  NULL::text[],
  NULL
);

-- 117. Митко Абаджиев  (+359 899 028 030)
select pg_temp.upsert_client(
  'Митко Абаджиев',
  '+359899028030',
  NULL::text[],
  NULL
);

-- 118. Митко Гаджалов  (+359 892 483 738)
select pg_temp.upsert_client(
  'Митко Гаджалов',
  '+359892483738',
  NULL::text[],
  NULL
);

-- 119. Митко Настанлиев  (+359 879 275 187)
select pg_temp.upsert_client(
  'Митко Настанлиев',
  '+359879275187',
  NULL::text[],
  NULL
);

-- 120. Митко Севриев  (+359 878 655 974)
select pg_temp.upsert_client(
  'Митко Севриев',
  '+359878655974',
  NULL::text[],
  NULL
);

-- 121. Михаил Марковски  (+359 888 261 233)
select pg_temp.upsert_client(
  'Михаил Марковски',
  '+359888261233',
  NULL::text[],
  NULL
);

-- 122. Михайл Василев  (+359 878 721 874)
select pg_temp.upsert_client(
  'Михайл Василев',
  '+359878721874',
  NULL::text[],
  NULL
);

-- 123. Назми Афузов  (+359 898 546 338)
select pg_temp.upsert_client(
  'Назми Афузов',
  '+359898546338',
  NULL::text[],
  NULL
);

-- 124. Недко Добриков Гърция  (+359 888 549 974)
select pg_temp.upsert_client(
  'Недко Добриков Гърция',
  '+359888549974',
  NULL::text[],
  NULL
);

-- 125. Недялка Пейчева  (+4915145421180)
select pg_temp.upsert_client(
  'Недялка Пейчева',
  '+4915145421180',
  NULL::text[],
  NULL
);

-- 126. Никола Димчевски  (+359 888 565 489)
select pg_temp.upsert_client(
  'Никола Димчевски',
  '+359888565489',
  ARRAY['+359885339224']::text[],
  NULL
);

-- 127. Никола Кисьов  (+359 878 969 834)
select pg_temp.upsert_client(
  'Никола Кисьов',
  '+359878969834',
  NULL::text[],
  NULL
);

-- 128. Николай Николов  (+359 888 615 460)
select pg_temp.upsert_client(
  'Николай Николов',
  '+359888615460',
  NULL::text[],
  'ЧЕПЕЛАРЕ'
);

-- 129. Николай Перпериев  (+359 878 360 155)
select pg_temp.upsert_client(
  'Николай Перпериев',
  '+359878360155',
  NULL::text[],
  NULL
);

-- 130. Николай Семерджиев  (+359 888 776 977)
select pg_temp.upsert_client(
  'Николай Семерджиев',
  '+359888776977',
  NULL::text[],
  NULL
);

-- 131. Нури Карамфилов  (+359 896 718 131)
select pg_temp.upsert_client(
  'Нури Карамфилов',
  '+359896718131',
  NULL::text[],
  NULL
);

-- 132. Отец Димитър  (+359 876 707 092)
select pg_temp.upsert_client(
  'Отец Димитър',
  '+359876707092',
  NULL::text[],
  NULL
);

-- 133. Павлин  (+359 898 609 290)
select pg_temp.upsert_client(
  'Павлин',
  '+359898609290',
  NULL::text[],
  'ПАМПОРОВО'
);

-- 134. ПАМПОРОВО АД Иван  (+359 882 886 408)
select pg_temp.upsert_client(
  'ПАМПОРОВО АД Иван',
  '+359882886408',
  NULL::text[],
  'ПАМПОРОВО'
);

-- 135. Пейчо Пейчев  (+359 895 490 628)
select pg_temp.upsert_client(
  'Пейчо Пейчев',
  '+359895490628',
  NULL::text[],
  NULL
);

-- 136. Петко Петков  (+359 888 923 356)
select pg_temp.upsert_client(
  'Петко Петков',
  '+359888923356',
  NULL::text[],
  NULL
);

-- 137. Петър Керанков  (+359 888 656 141)
select pg_temp.upsert_client(
  'Петър Керанков',
  '+359888656141',
  NULL::text[],
  NULL
);

-- 138. Петьо  (+359 878 937 878)
select pg_temp.upsert_client(
  'Петьо',
  '+359878937878',
  NULL::text[],
  NULL
);

-- 139. Пламен Ташев  (+359 883 514 171)
select pg_temp.upsert_client(
  'Пламен Ташев',
  '+359883514171',
  NULL::text[],
  NULL
);

-- 140. Пламен Фидански  (+359 894 619 812)
select pg_temp.upsert_client(
  'Пламен Фидански',
  '+359894619812',
  NULL::text[],
  NULL
);

-- 141. Радослав Маджаров  (+359 877 261 914)
select pg_temp.upsert_client(
  'Радослав Маджаров',
  '+359877261914',
  NULL::text[],
  NULL
);

-- 142. Радослав Пехливанов  (+359 878 539 880)
select pg_temp.upsert_client(
  'Радослав Пехливанов',
  '+359878539880',
  NULL::text[],
  NULL
);

-- 143. Радослава Милева Настан  (+359 879 208 545)
select pg_temp.upsert_client(
  'Радослава Милева Настан',
  '+359879208545',
  NULL::text[],
  NULL
);

-- 144. Райчо Пепеланов  (+359 888 473 474)
select pg_temp.upsert_client(
  'Райчо Пепеланов',
  '+359888473474',
  NULL::text[],
  NULL
);

-- 145. Рени  (+359 896 948 487)
select pg_temp.upsert_client(
  'Рени',
  '+359896948487',
  NULL::text[],
  NULL
);

-- 146. Росен Бодуров  (+359 889 861 692)
select pg_temp.upsert_client(
  'Росен Бодуров',
  '+359889861692',
  NULL::text[],
  NULL
);

-- 147. Росица Антонова  (+359 988 842 530)
select pg_temp.upsert_client(
  'Росица Антонова',
  '+359988842530',
  NULL::text[],
  NULL
);

-- 148. Росица Данайлова Девин  (+359 899 173 839)
select pg_temp.upsert_client(
  'Росица Данайлова Девин',
  '+359899173839',
  NULL::text[],
  NULL
);

-- 149. Рудозем Училището Николай  (+359 894 493 334)
select pg_temp.upsert_client(
  'Рудозем Училището Николай',
  '+359894493334',
  NULL::text[],
  'РУДОЗЕМ УЧИЛИЩЕТО'
);

-- 150. Румен Младенов  (+359 878 752 535)
select pg_temp.upsert_client(
  'Румен Младенов',
  '+359878752535',
  NULL::text[],
  NULL
);

-- 151. Румяна Чакалова  (+359 878 523 132)
select pg_temp.upsert_client(
  'Румяна Чакалова',
  '+359878523132',
  NULL::text[],
  NULL
);

-- 152. Руска Атанасова  (+359 888 821 324)
select pg_temp.upsert_client(
  'Руска Атанасова',
  '+359888821324',
  NULL::text[],
  NULL
);

-- 153. Руска Узунска  (+359 878 421 574)
select pg_temp.upsert_client(
  'Руска Узунска',
  '+359878421574',
  NULL::text[],
  NULL
);

-- 154. Савко Бояров  (+359 877 444 099)
select pg_temp.upsert_client(
  'Савко Бояров',
  '+359877444099',
  NULL::text[],
  NULL
);

-- 155. Сали Мехмед Сюлейманов  (+359 878 441 511)
select pg_temp.upsert_client(
  'Сали Мехмед Сюлейманов',
  '+359878441511',
  NULL::text[],
  NULL
);

-- 156. Светла Бачочева  (+359 887 809 169)
select pg_temp.upsert_client(
  'Светла Бачочева',
  '+359887809169',
  NULL::text[],
  NULL
);

-- 157. Светлин Деянов  (+359 896 503 193)
select pg_temp.upsert_client(
  'Светлин Деянов',
  '+359896503193',
  NULL::text[],
  NULL
);

-- 158. Светлозар Топчиев  (+359 878 677 996)
select pg_temp.upsert_client(
  'Светлозар Топчиев',
  '+359878677996',
  NULL::text[],
  NULL
);

-- 159. Светозар Панайотов  (+359 889 889 080)
select pg_temp.upsert_client(
  'Светозар Панайотов',
  '+359889889080',
  NULL::text[],
  NULL
);

-- 160. Севдалин Бодуров  (+359 878 822 829)
select pg_temp.upsert_client(
  'Севдалин Бодуров',
  '+359878822829',
  NULL::text[],
  NULL
);

-- 161. Севди  (+359 894 564 342)
select pg_temp.upsert_client(
  'Севди',
  '+359894564342',
  NULL::text[],
  NULL
);

-- 162. Севдин  (+359 893 656 106)
select pg_temp.upsert_client(
  'Севдин',
  '+359893656106',
  NULL::text[],
  'ВЪРБИНА'
);

-- 163. Сийка  (+359 876 455 808)
select pg_temp.upsert_client(
  'Сийка',
  '+359876455808',
  NULL::text[],
  NULL
);

-- 164. Симона Костадинова  (+359 888 023 121)
select pg_temp.upsert_client(
  'Симона Костадинова',
  '+359888023121',
  NULL::text[],
  'РУБЕЛА'
);

-- 165. Славчо Кондилов  (+359 879 439 898)
select pg_temp.upsert_client(
  'Славчо Кондилов',
  '+359879439898',
  NULL::text[],
  NULL
);

-- 166. Софка Русева  (+359 877 611 221)
select pg_temp.upsert_client(
  'Софка Русева',
  '+359877611221',
  NULL::text[],
  NULL
);

-- 167. Станимир Иванов  (+359 879 655 667)
select pg_temp.upsert_client(
  'Станимир Иванов',
  '+359879655667',
  NULL::text[],
  NULL
);

-- 168. Станислав Черакчиев  (+359 895 535 939)
select pg_temp.upsert_client(
  'Станислав Черакчиев',
  '+359895535939',
  NULL::text[],
  'РУДОЗЕМ'
);

-- 169. Станислава Сурова  (+4915779118302)
select pg_temp.upsert_client(
  'Станислава Сурова',
  '+4915779118302',
  NULL::text[],
  'Баните'
);

-- 170. Станой  (+359 879 992 722)
select pg_temp.upsert_client(
  'Станой',
  '+359879992722',
  NULL::text[],
  NULL
);

-- 171. Стела Горялова  (+359 899 386 314)
select pg_temp.upsert_client(
  'Стела Горялова',
  '+359899386314',
  NULL::text[],
  NULL
);

-- 172. Стоян Пепеланов  (+359 888 524 876)
select pg_temp.upsert_client(
  'Стоян Пепеланов',
  '+359888524876',
  NULL::text[],
  NULL
);

-- 173. Тасо Стружката  (+359 878 304 307)
select pg_temp.upsert_client(
  'Тасо Стружката',
  '+359878304307',
  NULL::text[],
  NULL
);

-- 174. Теодора Атанасова Пампорово  (+359 882 222 304)
select pg_temp.upsert_client(
  'Теодора Атанасова Пампорово',
  '+359882222304',
  NULL::text[],
  NULL
);

-- 175. Тодор Карамихалев  (+359 887 769 568)
select pg_temp.upsert_client(
  'Тодор Карамихалев',
  '+359887769568',
  NULL::text[],
  NULL
);

-- 176. Тодор Тузлуков Момчиловци  (+359 888 825 742)
select pg_temp.upsert_client(
  'Тодор Тузлуков Момчиловци',
  '+359888825742',
  NULL::text[],
  NULL
);

-- 177. Тони Абаджиев  (+359 876 179 997)
select pg_temp.upsert_client(
  'Тони Абаджиев',
  '+359876179997',
  NULL::text[],
  NULL
);

-- 178. Тошо  (+359 882 497 387)
select pg_temp.upsert_client(
  'Тошо',
  '+359882497387',
  NULL::text[],
  NULL
);

-- 179. Тошо Павелско  (+359 878 788 118)
select pg_temp.upsert_client(
  'Тошо Павелско',
  '+359878788118',
  NULL::text[],
  NULL
);

-- 180. Филип Зарев  (+359 876 011 633)
select pg_temp.upsert_client(
  'Филип Зарев',
  '+359876011633',
  NULL::text[],
  NULL
);

-- 181. Х  (+359 879 863 738)
select pg_temp.upsert_client(
  'Х',
  '+359879863738',
  NULL::text[],
  'Л ПЕРСЕНК ВЕСКО ДЕВИН'
);

-- 182. Хаиридин Караисенов  (+359 895 652 163)
select pg_temp.upsert_client(
  'Хаиридин Караисенов',
  '+359895652163',
  NULL::text[],
  NULL
);

-- 183. Хайри Мустафов  (+359 899 224 805)
select pg_temp.upsert_client(
  'Хайри Мустафов',
  '+359899224805',
  NULL::text[],
  NULL
);

-- 184. Хараламби Хаджихристев  (+359 887 806 332)
select pg_temp.upsert_client(
  'Хараламби Хаджихристев',
  '+359887806332',
  NULL::text[],
  NULL
);

-- 185. Хасан  (+359 877 330 499)
select pg_temp.upsert_client(
  'Хасан',
  '+359877330499',
  NULL::text[],
  NULL
);

-- 186. Христо  (+359 882 886 400)
select pg_temp.upsert_client(
  'Христо',
  '+359882886400',
  NULL::text[],
  'ПАМПОРОВО'
);

-- 187. Христо Илиев Бостина  (+359 889 262 442)
select pg_temp.upsert_client(
  'Христо Илиев Бостина',
  '+359889262442',
  NULL::text[],
  NULL
);

-- 188. Христо Коев  (+359 897 837 683)
select pg_temp.upsert_client(
  'Христо Коев',
  '+359897837683',
  NULL::text[],
  NULL
);

-- 189. Христо Ратайски  (+359 889 463 210)
select pg_temp.upsert_client(
  'Христо Ратайски',
  '+359889463210',
  NULL::text[],
  NULL
);

-- 190. Цветанка Славчева  (+359 887 897 487)
select pg_temp.upsert_client(
  'Цветанка Славчева',
  '+359887897487',
  NULL::text[],
  NULL
);

-- 191. Чавдар Власов  (+359 878 140 422)
select pg_temp.upsert_client(
  'Чавдар Власов',
  '+359878140422',
  NULL::text[],
  NULL
);

-- 192. Шабан Касабов  (+359 886 279 752)
select pg_temp.upsert_client(
  'Шабан Касабов',
  '+359886279752',
  NULL::text[],
  NULL
);

-- 193. Юлиян Димитров  (+359 887 823 486)
select pg_temp.upsert_client(
  'Юлиян Димитров',
  '+359887823486',
  NULL::text[],
  NULL
);

-- 194. Юлиян Хаджиев  (+359 878 536 593)
select pg_temp.upsert_client(
  'Юлиян Хаджиев',
  '+359878536593',
  NULL::text[],
  NULL
);

-- 195. Koko  (без телефон)
select pg_temp.upsert_client(
  'Koko',
  NULL,
  NULL::text[],
  NULL
);

-- 196. Асен Асенов  (без телефон)
select pg_temp.upsert_client(
  'Асен Асенов',
  NULL,
  NULL::text[],
  NULL
);

-- 197. Атанас Медов 089811252  (без телефон)
select pg_temp.upsert_client(
  'Атанас Медов 089811252',
  NULL,
  NULL::text[],
  NULL
);

-- 198. Давидково  (без телефон)
select pg_temp.upsert_client(
  'Давидково',
  NULL,
  NULL::text[],
  NULL
);

-- 199. Десислава Чернева  (без телефон)
select pg_temp.upsert_client(
  'Десислава Чернева',
  NULL,
  NULL::text[],
  NULL
);

-- 200. Еском Устово  (без телефон)
select pg_temp.upsert_client(
  'Еском Устово',
  NULL,
  NULL::text[],
  NULL
);

-- 201. Живка Христева 00898675177  (без телефон)
select pg_temp.upsert_client(
  'Живка Христева 00898675177',
  NULL,
  NULL::text[],
  NULL
);

-- 202. Исмена  (без телефон)
select pg_temp.upsert_client(
  'Исмена',
  NULL,
  NULL::text[],
  NULL
);

-- 203. Краси Трифонов  (без телефон)
select pg_temp.upsert_client(
  'Краси Трифонов',
  NULL,
  NULL::text[],
  'СОФИЯ'
);

-- 204. Мартин Гунчев  (без телефон)
select pg_temp.upsert_client(
  'Мартин Гунчев',
  NULL,
  NULL::text[],
  NULL
);

-- 205. Мони Иванов  (без телефон)
select pg_temp.upsert_client(
  'Мони Иванов',
  NULL,
  NULL::text[],
  NULL
);

-- 206. Наско Национал  (без телефон)
select pg_temp.upsert_client(
  'Наско Национал',
  NULL,
  NULL::text[],
  NULL
);

-- 207. Ники Бечев  (без телефон)
select pg_temp.upsert_client(
  'Ники Бечев',
  NULL,
  NULL::text[],
  NULL
);

-- 208. Петър Диков Пловдив  (без телефон)
select pg_temp.upsert_client(
  'Петър Диков Пловдив',
  NULL,
  NULL::text[],
  NULL
);

-- 209. Рубела  (без телефон)
select pg_temp.upsert_client(
  'Рубела',
  NULL,
  NULL::text[],
  NULL
);

-- 210. Сина На Митко Чернев София  (без телефон)
select pg_temp.upsert_client(
  'Сина На Митко Чернев София',
  NULL,
  NULL::text[],
  NULL
);

-- 211. Стоичката София  (без телефон)
select pg_temp.upsert_client(
  'Стоичката София',
  NULL,
  NULL::text[],
  NULL
);

-- 212. Тодор Радев Шваба  (без телефон)
select pg_temp.upsert_client(
  'Тодор Радев Шваба',
  NULL,
  NULL::text[],
  NULL
);

commit;
