-- FTS + ILIKE fallback for catalog search (used by GET /api/products?q=).
create or replace function public.search_product_ids(search_query text, result_limit int default 2000)
returns table(id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.products p
  where p.is_active = true
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

revoke all on function public.search_product_ids(text, int) from public;
grant execute on function public.search_product_ids(text, int) to service_role;
