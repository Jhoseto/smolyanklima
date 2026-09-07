-- 0108_performance_indexes_recent_features.sql
-- Индекси за hot path-ове от 0105+ (product_id върху service_repair_protocols),
-- проверка на дублирани серийни номера и админ списък продукти (~1000+ реда).

-- 1) Сервизни протоколи ↔ продукт: batch lookup + „най-нов по дата“.
--    Заменя единичния idx от 0105 — композитният покрива и eq(product_id).
drop index if exists public.idx_service_repair_protocols_product_id;

create index if not exists idx_service_repair_protocols_product_id_date
  on public.service_repair_protocols (product_id, date desc, created_at desc)
  where product_id is not null;

comment on index public.idx_service_repair_protocols_product_id_date is
  'findRepairProtocolsForProductIds / findRepairProtocolForSale — lookup по product_id + latest date.';

-- 2) Протокол по монтаж (work_item_id) + най-нов.
create index if not exists idx_service_repair_protocols_work_item_date
  on public.service_repair_protocols (work_item_id, date desc)
  where work_item_id is not null;

comment on index public.idx_service_repair_protocols_work_item_date is
  'findRepairProtocolForSale — протокол към work_item след монтаж.';

-- 3) Точно съвпадение на серийни номера (check-serial, matchRepairProtocolProduct).
--    ilike без wildcard → lower(trim(...)) btree.
create index if not exists idx_products_indoor_serial_lower
  on public.products (lower(trim(indoor_unit_serial)))
  where indoor_unit_serial is not null and trim(indoor_unit_serial) <> '';

create index if not exists idx_products_outdoor_serial_lower
  on public.products (lower(trim(outdoor_unit_serial)))
  where outdoor_unit_serial is not null and trim(outdoor_unit_serial) <> '';

comment on index public.idx_products_indoor_serial_lower is
  'Duplicate serial check + protocol match по вътрешно тяло.';
comment on index public.idx_products_outdoor_serial_lower is
  'Duplicate serial check + protocol match по външно тяло.';

-- 4) Админ списък: default sortBy=name; purchased_at filter/sort.
create index if not exists idx_products_name_sort
  on public.products (name);

create index if not exists idx_products_purchased_at_desc
  on public.products (purchased_at desc nulls last)
  where purchased_at is not null;

comment on index public.idx_products_name_sort is
  'Admin products list — ORDER BY name (1088+ реда).';
comment on index public.idx_products_purchased_at_desc is
  'Admin products — филтър/сортиране по дата на закупуване.';

-- 5) Legacy fallback: ilike %serial% в service_repair_protocols.serial_number.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    execute $sql$
      create index if not exists idx_service_repair_protocols_serial_trgm
        on public.service_repair_protocols using gin (serial_number gin_trgm_ops)
        where serial_number is not null and trim(serial_number) <> ''
    $sql$;
  end if;
end $$;
