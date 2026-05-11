# Supabase seeds

Скриптове за първоначално зареждане на справочни / референтни данни.
**Не са част от migrations** — изпълняват се **еднократно** ръчно
от Supabase SQL Editor или с `psql`.

Всички скриптове са **идемпотентни** — могат да се изпълнят повторно
без да създадат дубликати или да презапишат ръчно редактирани данни.

> ⚠️ **Изискване:** преди да пуснете seed-овете, миграциите трябва да
> са приложени. По-конкретно `0033_contact_phones.sql` създава таблицата
> `contact_phones`, която този seed използва.

## 0001_supplier_contacts.sql

Създава **9 доставчика** като контакти (`contact_kind = 'supplier'`).
За всеки един записва **всички намерени телефонни номера** в новата
таблица `contact_phones` — с подходящ етикет (Офис, Сервиз, Клон Варна
и т.н.). Това дава възможност на UI-а да показва списък с „call"
бутони за всеки номер.

Данните са:

- Имена + брой поръчки — от `h:\Apps\SmolyanKlima\Doc\aerf.xls`
  (листове EUROPA + JAPAN, колона „ДОСТАВЧИК").
- Адреси / телефони / имейли / уебсайтове — от официалните сайтове и
  публични регистри (BCC, BUSINESS.bg). Проверка: **2026-05-11**.

Списък:

| Доставчик | Поръчки | Марки / специалност |
|---|---:|---|
| БУЛКЛИМА ЕООД | 193 | GENERAL, Kaisai, Samsung, Olimpia Splendid |
| БИТТЕЛ ЕООД | 145 | Daikin, Toshiba, Nippon |
| КОНДЕКС ООД | 69 | Mitsubishi Heavy Industries, STULZ |
| ДИМЕЛИ ЕООД | 16 | японски климатици (нови и втора употреба), Yonan |
| НТТ-3 ООД | 11 | директен внос от Япония (Toshiba, Panasonic, Daikin…) |
| КЛИМАКОМ ЕООД | 4 | Mitsubishi Electric |
| МАГНУМ-Д ЕООД | 2 | MIDEA, AUX, LG, Arielli, DSM |
| ТЕРМО-КЛИМА ЕООД | 1 | Fujitsu, Mitsubishi, Daikin, Gree |
| ПРОКСИМУС ИНЖЕНЕРИНГ ЕООД | 1 | SANYO, Hisense VRF |

> „БУЛКИМА" (5 поръчки) — правописна грешка, обединена с БУЛКЛИМА.

### Изпълнение

**Supabase Studio (SQL Editor):**
```text
1. Отвори https://supabase.com/dashboard/project/<id>/sql/new
2. Копирай съдържанието на 0001_supplier_contacts.sql
3. Натисни Run
```

**Локално с psql:**
```bash
psql "$SUPABASE_DB_URL" -f backend/supabase/seeds/0001_supplier_contacts.sql
```

### Проверка
```sql
-- Брой телефони на доставчик
select c.full_name, c.phone as primary_phone, c.email,
       (select count(*) from public.contact_phones p
          where p.contact_id = c.id) as phones_count
from public.contacts c
where c.contact_kind = 'supplier'
order by c.full_name;

-- Всички телефони на конкретен доставчик
select c.full_name, p.phone, p.label, p.is_primary, p.sort_order
from public.contacts c
join public.contact_phones p on p.contact_id = c.id
where c.full_name = 'БИТТЕЛ ЕООД'
order by p.sort_order;
```
