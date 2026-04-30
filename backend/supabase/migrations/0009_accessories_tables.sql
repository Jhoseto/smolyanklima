-- 0009_accessories_tables.sql
-- Separate accessories/parts from HVAC products (climatics).

create table if not exists public.accessories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  brand_id uuid references public.brands(id),
  kind text not null default 'accessory', -- accessory | spare_part | consumable
  description text,
  price numeric(10,2) not null,
  old_price numeric(10,2),
  is_active boolean not null default true,
  stock_status text not null default 'in_stock',
  stock_quantity int not null default 0,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_accessories_price_nonneg check (price >= 0),
  constraint chk_accessories_stock_nonneg check (stock_quantity >= 0),
  constraint chk_accessories_old_price check (old_price is null or old_price >= price)
);

drop trigger if exists trg_accessories_updated_at on public.accessories;
create trigger trg_accessories_updated_at
before update on public.accessories
for each row execute function public.set_updated_at();

create table if not exists public.accessory_images (
  id uuid primary key default gen_random_uuid(),
  accessory_id uuid not null references public.accessories(id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  is_main boolean not null default false,
  created_at timestamptz not null default now()
);

-- RLS
alter table public.accessories enable row level security;
alter table public.accessory_images enable row level security;

drop policy if exists accessories_public_read on public.accessories;
create policy accessories_public_read
on public.accessories for select
using (is_active = true);

drop policy if exists accessory_images_public_read on public.accessory_images;
create policy accessory_images_public_read
on public.accessory_images for select
using (true);

-- Admin write (reuse is_active_admin helper)
drop policy if exists accessories_admin_write on public.accessories;
create policy accessories_admin_write
on public.accessories for all
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists accessory_images_admin_write on public.accessory_images;
create policy accessory_images_admin_write
on public.accessory_images for all
using (public.is_active_admin())
with check (public.is_active_admin());

-- Grants (for PostgREST reads)
grant select on table public.accessories, public.accessory_images to anon, authenticated;

