-- Add Bittel sync tracking columns to product_catalog_settings
alter table public.product_catalog_settings
  add column if not exists bittel_last_sync_at timestamptz,
  add column if not exists bittel_last_sync_status text,
  add column if not exists bittel_last_sync_summary jsonb;

comment on column public.product_catalog_settings.bittel_last_sync_status is
  'idle | running | ok | error';
