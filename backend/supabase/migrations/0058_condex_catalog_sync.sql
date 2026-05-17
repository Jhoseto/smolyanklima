-- Статус на синхронизация с condex.bg (Кондекс).

alter table public.product_catalog_settings
  add column if not exists condex_last_sync_at timestamptz,
  add column if not exists condex_last_sync_status text,
  add column if not exists condex_last_sync_summary jsonb;

comment on column public.product_catalog_settings.condex_last_sync_status is
  'idle | running | ok | error';
