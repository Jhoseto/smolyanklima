-- Статус на синхронизация с climacom.com (КЛИМАКОМ).

alter table public.product_catalog_settings
  add column if not exists climacom_last_sync_at timestamptz,
  add column if not exists climacom_last_sync_status text,
  add column if not exists climacom_last_sync_summary jsonb;

comment on column public.product_catalog_settings.climacom_last_sync_status is
  'idle | running | ok | error';
