-- 0036_service_protocols_status_workflow.sql
-- Преработка на жизнения цикъл на приемно-предавателния протокол.
--
-- Стари статуси (твърде неинформативни за реалния workflow):
--   draft   → чернова
--   signed  → подписан
--   sent    → изпратен
--
-- Нови статуси, отразяващи реалния процес „офис → екип на място“:
--   prepared    → офисът е въвел клиентските данни и оборудването;
--                 чака сервизният екип да отиде на място.
--   in_progress → сервизният екип е започнал да попълва протокола на
--                 място (материали, начин на монтаж, забележки), но
--                 още не е финализиран и подписан.
--   signed      → протоколът е завършен и подписан от двете страни
--                 (екип за монтаж + клиент).
--
-- Backfill (стари → нови):
--   draft  → prepared  (повечето чернови са започнати от офис)
--   sent   → signed    (изпратеният протокол вече е бил подписан)
--   signed → signed    (без промяна)

-- 1) Премахваме старото ограничение.
alter table public.service_protocols
  drop constraint if exists service_protocols_status_check;

-- 2) Преобразуваме съществуващите записи. Идемпотентно — повторно
--    изпълнение не променя нищо.
update public.service_protocols
   set status = 'prepared'
 where status = 'draft';

update public.service_protocols
   set status = 'signed'
 where status = 'sent';

-- 3) Налагаме новия enum като CHECK constraint.
alter table public.service_protocols
  add constraint service_protocols_status_check
  check (status in ('prepared', 'in_progress', 'signed'));

-- 4) Сменяме default-а — нови протоколи се създават от офиса и затова
--    започват като „Подготвен“.
alter table public.service_protocols
  alter column status set default 'prepared';
