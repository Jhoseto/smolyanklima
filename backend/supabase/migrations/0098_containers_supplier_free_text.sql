-- 0098_containers_supplier_free_text.sql
-- Доставчиците на контейнерите (втора употреба от Япония) не са част от
-- стандартния списък с контакти/доставчици, затова полето става свободен текст.

alter table public.containers
  add column if not exists supplier_name text;

drop index if exists public.idx_containers_supplier_id;

alter table public.containers
  drop column if exists supplier_id;
