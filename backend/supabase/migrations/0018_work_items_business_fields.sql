-- 0018_work_items_business_fields.sql
-- Business event fields for history/calendar and sales statistics.

alter table public.work_items
add column if not exists event_code text;

alter table public.work_items
drop constraint if exists chk_work_items_event_code;

alter table public.work_items
add constraint chk_work_items_event_code check (
  event_code is null or event_code in (
    'item_added',
    'item_removed',
    'sale',
    'service_installation',
    'service_inspection',
    'service_repair',
    'service_maintenance'
  )
);

update public.work_items
set event_code = case
  when type = 'sale' then 'sale'
  when type = 'stock_in' then 'item_added'
  when type = 'stock_out' then 'item_removed'
  when type = 'service' then 'service_repair'
  else null
end
where event_code is null;

alter table public.work_items
add column if not exists customer_address text;

alter table public.work_items
add column if not exists quantity int;

update public.work_items
set quantity = 1
where quantity is null;

alter table public.work_items
alter column quantity set default 1;

alter table public.work_items
alter column quantity set not null;

alter table public.work_items
add column if not exists unit_price numeric(10,2);

alter table public.work_items
add column if not exists total_amount numeric(10,2);

create index if not exists idx_work_items_event_code on public.work_items (event_code);
