-- Бързо броене на продукти по BTU за публичния каталог (филтър sidebar).

create or replace function public.catalog_btu_option_counts(p_cond text default null)
returns table (nominal_btu int, product_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    ps.btu::int as nominal_btu,
    count(distinct p.id)::bigint as product_count
  from public.products p
  inner join public.product_specs ps on ps.product_id = p.id
  where p.show_in_public_catalog = true
    and p.stock_status is distinct from 'out_of_stock'
    and ps.btu is not null
    and (p_cond is null or p_cond = '' or p.product_condition::text = p_cond)
  group by ps.btu;
$$;

comment on function public.catalog_btu_option_counts(text) is
  'Брой публични продукти по номинал BTU (product_specs.btu).';

grant execute on function public.catalog_btu_option_counts(text) to anon, authenticated, service_role;
