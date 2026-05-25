-- Помощни RPC за възстановяване на JSON backup.
-- FK редът се спазва в приложението (без session_replication_role — забранено на Supabase).

create or replace function public.admin_backup_truncate_tables(table_names text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  t text;
  qualified text[] := '{}';
begin
  if table_names is null or array_length(table_names, 1) is null then
    return;
  end if;

  foreach t in array table_names loop
    if t !~ '^[a-z][a-z0-9_]*$' then
      raise exception 'Invalid table name: %', t;
    end if;
    qualified := array_append(qualified, format('public.%I', t));
  end loop;

  execute 'truncate table ' || array_to_string(qualified, ', ') || ' restart identity cascade';
end;
$$;

revoke all on function public.admin_backup_truncate_tables(text[]) from public;
grant execute on function public.admin_backup_truncate_tables(text[]) to service_role;

comment on function public.admin_backup_truncate_tables(text[]) is
  'Изчиства избрани public таблици преди пълен restore (само service_role).';

-- Синхронизира sequences след restore (номера на протоколи и др.).
create or replace function public.admin_backup_reset_sequences()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select
      format('%I.%I', n.nspname, c.relname) as seq_name,
      format('%I.%I', nt.nspname, t.relname) as table_name,
      a.attname as column_name
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_depend d on d.objid = c.oid and d.deptype = 'a'
    join pg_class t on t.oid = d.refobjid
    join pg_namespace nt on nt.oid = t.relnamespace
    join pg_attribute a on a.attrelid = t.oid and a.attnum = d.refobjsubid and a.attnum > 0
    where c.relkind = 'S'
      and n.nspname = 'public'
      and nt.nspname = 'public'
  loop
    execute format(
      'SELECT setval(%L, GREATEST(COALESCE((SELECT MAX(%I) FROM %s), 0), 1), true)',
      r.seq_name,
      r.column_name,
      r.table_name
    );
  end loop;
end;
$$;

revoke all on function public.admin_backup_reset_sequences() from public;
grant execute on function public.admin_backup_reset_sequences() to service_role;

comment on function public.admin_backup_reset_sequences() is
  'Синхронизира public sequences след JSON restore (само service_role).';
