-- Admin agent search: FTS + ILIKE (better than raw ilike in agent tools).

create or replace function public.search_admin_product_ids(search_query text, result_limit int default 200)
returns table(id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.products p
  where trim(coalesce(search_query, '')) <> ''
    and (
      to_tsvector(
        'simple',
        coalesce(p.name, '') || ' ' || coalesce(p.description, '') || ' ' || coalesce(p.model_code, '')
          || ' ' || coalesce(p.indoor_unit_serial, '') || ' ' || coalesce(p.outdoor_unit_serial, '')
      ) @@ plainto_tsquery('simple', trim(search_query))
      or p.name ilike '%' || trim(search_query) || '%'
      or p.description ilike '%' || trim(search_query) || '%'
      or p.model_code ilike '%' || trim(search_query) || '%'
      or p.indoor_unit_serial ilike '%' || trim(search_query) || '%'
      or p.outdoor_unit_serial ilike '%' || trim(search_query) || '%'
    )
  order by p.updated_at desc nulls last
  limit greatest(1, least(coalesce(result_limit, 200), 500));
$$;

create or replace function public.search_admin_contact_ids(search_query text, result_limit int default 100)
returns table(id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select c.id
  from public.contacts c
  where trim(coalesce(search_query, '')) <> ''
    and (
      to_tsvector(
        'simple',
        coalesce(c.full_name, '') || ' ' || coalesce(c.phone, '') || ' ' || coalesce(c.email, '')
          || ' ' || coalesce(c.address, '') || ' ' || coalesce(c.notes, '')
      ) @@ plainto_tsquery('simple', trim(search_query))
      or c.full_name ilike '%' || trim(search_query) || '%'
      or c.phone ilike '%' || trim(search_query) || '%'
      or c.email ilike '%' || trim(search_query) || '%'
      or c.notes ilike '%' || trim(search_query) || '%'
    )
  order by c.updated_at desc nulls last
  limit greatest(1, least(coalesce(result_limit, 100), 300));
$$;

create or replace function public.search_admin_inquiry_ids(search_query text, result_limit int default 100)
returns table(id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select i.id
  from public.inquiries i
  where trim(coalesce(search_query, '')) <> ''
    and (
      to_tsvector(
        'simple',
        coalesce(i.customer_name, '') || ' ' || coalesce(i.customer_phone, '') || ' ' || coalesce(i.message, '')
      ) @@ plainto_tsquery('simple', trim(search_query))
      or i.customer_name ilike '%' || trim(search_query) || '%'
      or i.customer_phone ilike '%' || trim(search_query) || '%'
      or i.message ilike '%' || trim(search_query) || '%'
    )
  order by i.created_at desc nulls last
  limit greatest(1, least(coalesce(result_limit, 100), 300));
$$;

revoke all on function public.search_admin_product_ids(text, int) from public;
revoke all on function public.search_admin_contact_ids(text, int) from public;
revoke all on function public.search_admin_inquiry_ids(text, int) from public;
grant execute on function public.search_admin_product_ids(text, int) to service_role;
grant execute on function public.search_admin_contact_ids(text, int) to service_role;
grant execute on function public.search_admin_inquiry_ids(text, int) to service_role;
