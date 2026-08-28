-- 0104_service_repair_protocols_refrigerant.sql
-- Добавя тип на хладилния агент и количеството добавено (в грамове) към
-- сервизния протокол — стъпка „Фреон & почистване“ (виж 0041_service_repair_protocols.sql).
-- Стойността на refrigerant_type е свободен текст (datalist на UI), огледало на
-- product_specs.refrigerant — не е строг enum, защото производителите добавят нови агенти.

alter table public.service_repair_protocols
  add column if not exists refrigerant_type text,
  add column if not exists refrigerant_amount_g numeric(7,1) check (refrigerant_amount_g is null or refrigerant_amount_g >= 0);
