-- 0016_products_sold_quantity.sql
-- Track sold units per product for admin operations.

alter table public.products
add column if not exists sold_quantity int;

update public.products
set sold_quantity = 0
where sold_quantity is null;

alter table public.products
alter column sold_quantity set default 0;

alter table public.products
alter column sold_quantity set not null;
