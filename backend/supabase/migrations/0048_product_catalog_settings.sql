-- Настройки на продуктовия каталог (singleton) + масово прилагане на цена с монтаж.
-- UI: панел Продукти → зъбно колело; стандартни суми за монтаж (нов / втора употреба).

create table if not exists public.product_catalog_settings (
  id smallint primary key default 1 constraint product_catalog_settings_singleton check (id = 1),
  default_mount_new_eur numeric(10,2),
  default_mount_used_eur numeric(10,2),
  updated_at timestamptz not null default now()
);

insert into public.product_catalog_settings (id) values (1)
on conflict (id) do nothing;

drop trigger if exists trg_product_catalog_settings_updated on public.product_catalog_settings;
create trigger trg_product_catalog_settings_updated
  before update on public.product_catalog_settings
  for each row execute function public.set_updated_at();

alter table public.product_catalog_settings enable row level security;

-- Масово: price_with_mount = round(price + надценка_според_състояние, 2)
create or replace function public.apply_catalog_default_mount_prices(
  p_mount_new numeric,
  p_mount_used numeric
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if p_mount_new is null or p_mount_used is null then
    raise exception 'mount amounts required';
  end if;
  if p_mount_new < 0 or p_mount_used < 0 then
    raise exception 'mount amounts must be non-negative';
  end if;

  update public.products
  set price_with_mount = round(
    price::numeric + case when product_condition = 'used' then p_mount_used else p_mount_new end,
    2
  )
  where price is not null;

  get diagnostics n = row_count;
  return n;
end;
$$;

comment on table public.product_catalog_settings is 'Singleton (id=1): UI настройки за каталога (напр. стандартен монтаж).';
comment on function public.apply_catalog_default_mount_prices(numeric, numeric) is
  'Задава price_with_mount = price + mount за всички продукти с price not null.';

grant execute on function public.apply_catalog_default_mount_prices(numeric, numeric) to service_role;
