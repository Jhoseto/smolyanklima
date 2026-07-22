-- 0097_containers.sql
-- Контейнери (доставки втора употреба от Япония): групиране на климатици
-- по конкретна пратка. Имената се генерират автоматично: "Контейнер 2026",
-- а при повече от един за годината — "Контейнер 2026-2", "Контейнер 2026-3"...

create table if not exists public.containers (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  year int not null,
  sequence_in_year int not null default 1,
  arrival_date date,
  supplier_id uuid references public.contacts (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_containers_year check (year between 2000 and 2100),
  constraint chk_containers_sequence check (sequence_in_year >= 1),
  constraint uq_containers_year_seq unique (year, sequence_in_year)
);

create index if not exists idx_containers_year on public.containers (year);
create index if not exists idx_containers_supplier_id on public.containers (supplier_id);

drop trigger if exists set_containers_updated_at on public.containers;
create trigger set_containers_updated_at
before update on public.containers
for each row
execute function public.set_updated_at();

alter table public.products
  add column if not exists container_id uuid references public.containers (id) on delete set null;

create index if not exists idx_products_container_id on public.products (container_id);

alter table public.containers enable row level security;

drop policy if exists containers_admin_all on public.containers;
create policy containers_admin_all on public.containers
  for all
  using  (public.is_active_admin())
  with check (public.is_active_admin());
