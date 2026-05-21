-- Индекси за по-бърз публичен каталог (филтри sidebar + dedup list).

create index if not exists idx_products_public_catalog_list
  on public.products (type_id, brand_id, product_condition, stock_status)
  where show_in_public_catalog = true
    and stock_status is distinct from 'out_of_stock';

comment on index public.idx_products_public_catalog_list is
  'Публичен каталог: филтър по тип/марка и meta броячи.';
