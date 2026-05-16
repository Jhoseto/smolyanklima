-- Публична видимост на продукт (независимо от stock_status) + статус на Bulclima sync.

alter table public.products
  add column if not exists show_in_public_catalog boolean not null default false;

comment on column public.products.show_in_public_catalog is
  'Ако true — продуктът се показва в публичния каталог (освен out_of_stock).';

create index if not exists idx_products_show_in_public_catalog
  on public.products (show_in_public_catalog)
  where show_in_public_catalog = true;

alter table public.product_catalog_settings
  add column if not exists bulclima_last_sync_at timestamptz,
  add column if not exists bulclima_last_sync_status text,
  add column if not exists bulclima_last_sync_summary jsonb;

comment on column public.product_catalog_settings.bulclima_last_sync_status is
  'idle | running | ok | error';

-- Търсене: само публикувани в каталога, без изчерпани.
create or replace function public.search_product_ids(search_query text, result_limit int default 2000)
returns table(id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.products p
  where p.show_in_public_catalog = true
    and p.stock_status <> 'out_of_stock'
    and trim(coalesce(search_query, '')) <> ''
    and (
      to_tsvector('simple', coalesce(p.name, '') || ' ' || coalesce(p.description, ''))
        @@ plainto_tsquery('simple', trim(search_query))
      or p.name ilike '%' || trim(search_query) || '%'
      or p.description ilike '%' || trim(search_query) || '%'
    )
  order by p.is_featured desc nulls last, p.price asc
  limit greatest(1, least(coalesce(result_limit, 2000), 5000));
$$;
