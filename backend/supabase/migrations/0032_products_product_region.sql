-- 0032_products_product_region.sql
-- Произход на модела: EUROPE / JAPAN (стойности в БД: europe, japan).

alter table public.products
  add column if not exists product_region text;

update public.products
set product_region = 'europe'
where product_region is null
   or trim(product_region) = ''
   or trim(product_region) not in ('europe', 'japan');

alter table public.products
  alter column product_region set default 'europe';

alter table public.products
  alter column product_region set not null;

alter table public.products
  drop constraint if exists chk_products_product_region;

alter table public.products
  add constraint chk_products_product_region
  check (product_region in ('europe', 'japan'));

create index if not exists idx_products_product_region
  on public.products (product_region);
