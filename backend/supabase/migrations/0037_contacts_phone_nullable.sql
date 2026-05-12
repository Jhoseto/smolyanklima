-- 0037_contacts_phone_nullable.sql
-- Прави `contacts.phone` опционален, защото при импорт от стари записи
-- (напр. excel-ски архив на продажби) има клиенти без записан телефон,
-- а губенето на име/история би било по-лошо от липсващия номер.
--
-- API-то (`/api/admin/contacts`) продължава да изисква телефон при ръчно
-- въвеждане през UI (zod schema min(3)). Това е чисто DB-level разхлабване
-- за seed-ове и legacy данни.

alter table public.contacts
  alter column phone drop not null;

-- Полезен индекс за по-бързи lookups при дедупликация (NULL-ови телефони
-- не пречат, защото partial index ги пропуска).
create unique index if not exists uq_contacts_phone_when_set
  on public.contacts (phone)
  where phone is not null;
