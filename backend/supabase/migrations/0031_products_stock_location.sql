-- 0031_products_stock_location.sql
-- Физическо местоположение: витрина (магазин) или склад. Отделно от stock_status.
-- След прилагане: API автоматично ще чете/записва колоната (първи опит с нея; при липса — без нея).

alter table public.products
  add column if not exists stock_location text;

update public.products
set stock_location = 'warehouse'
where stock_location is null
   or trim(stock_location) = ''
   or trim(stock_location) not in ('showroom', 'warehouse');

alter table public.products
  alter column stock_location set default 'warehouse';

alter table public.products
  alter column stock_location set not null;

alter table public.products
  drop constraint if exists chk_products_stock_location;

alter table public.products
  add constraint chk_products_stock_location
  check (stock_location in ('showroom', 'warehouse'));

create index if not exists idx_products_stock_location
  on public.products (stock_location);
