-- Бързо броене на уникални модели по марка за публичния каталог (sidebar филтър).

create or replace function public.catalog_brand_option_counts(p_cond text default null)
returns table (brand_id uuid, product_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with visible as (
    select
      p.id,
      p.brand_id,
      case
        when p.brand_id is not null and btrim(coalesce(p.model_code, '')) <> ''
          then p.brand_id::text || ':' || lower(btrim(p.model_code))
        else '__instance:' || p.id::text
      end as dedup_key
    from public.products p
    where p.show_in_public_catalog = true
      and p.stock_status is distinct from 'out_of_stock'
      and (p_cond is null or p_cond = '' or p.product_condition::text = p_cond)
  ),
  deduped as (
    select distinct dedup_key, brand_id
    from visible
  )
  select d.brand_id, count(*)::bigint as product_count
  from deduped d
  where d.brand_id is not null
  group by d.brand_id;
$$;

comment on function public.catalog_brand_option_counts(text) is
  'Брой уникални модели (dedup по brand_id + model_code) на марка в публичния каталог.';

grant execute on function public.catalog_brand_option_counts(text) to anon, authenticated, service_role;
