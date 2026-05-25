-- Осигурява RPC за списък public таблици при backup export.
-- (Оригинал: 0045 / 0055 — често липсва, а 0067 е само за restore.)

create or replace function public.admin_export_list_public_tables()
returns table(table_name text)
language sql
stable
security definer
set search_path = public
as $$
  select c.relname::text as table_name
  from pg_catalog.pg_class c
  join pg_catalog.pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
  order by c.relname;
$$;

revoke all on function public.admin_export_list_public_tables() from public;
grant execute on function public.admin_export_list_public_tables() to service_role;

comment on function public.admin_export_list_public_tables() is
  'Списък public таблици за пълен JSON backup от админ API (service role).';

-- PostgREST schema reload (Supabase)
notify pgrst, 'reload schema';
