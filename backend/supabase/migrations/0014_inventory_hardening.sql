-- 0014_inventory_hardening.sql
-- Ensure inventory columns always exist and are normalized.

alter table public.products
add column if not exists stock_quantity int;

update public.products
set stock_quantity = 0
where stock_quantity is null;

alter table public.products
alter column stock_quantity set default 0;

alter table public.products
alter column stock_quantity set not null;

alter table public.products
add column if not exists stock_status text;

update public.products
set stock_status = 'in_stock'
where stock_status is null;

alter table public.products
alter column stock_status set default 'in_stock';

alter table public.products
alter column stock_status set not null;
