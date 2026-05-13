-- RPC за списък на всички public таблици (тип „таблица“), използван от админ експорт.
-- Изпълнимо само от service_role (PostgREST с service key).

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

insert into public.settings (key, value, description)
values
  (
    'backup.preferred_folder_path',
    null,
    'Препоръчан локален път за архивни файлове (напр. D:/Backup/SmolyanKlima). Браузърът не записва автоматично там — преместете ръчно сваления JSON.'
  ),
  (
    'backup.reminder_interval_days',
    '7',
    'След колко дни без изтегляне на пълен архив да се показва напомняне (брои се локално в браузъра).'
  )
on conflict (key) do nothing;
