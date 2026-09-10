-- 0111: други разходи по МПС (глоби, такси, паркинг и др.)

create table if not exists public.fleet_misc_expenses (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  category text not null default 'other'
    check (category in ('fine', 'toll', 'parking', 'other')),
  title text not null,
  expense_date date not null,
  cost_eur numeric(12, 2) not null check (cost_eur >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fleet_misc_expenses_vehicle_date
  on public.fleet_misc_expenses (vehicle_id, expense_date desc);

drop trigger if exists set_fleet_misc_expenses_updated_at on public.fleet_misc_expenses;
create trigger set_fleet_misc_expenses_updated_at
before update on public.fleet_misc_expenses
for each row execute function public.set_updated_at();

alter table public.fleet_misc_expenses enable row level security;

drop policy if exists fleet_misc_expenses_admin_all on public.fleet_misc_expenses;
create policy fleet_misc_expenses_admin_all on public.fleet_misc_expenses
  for all using (public.is_active_admin()) with check (public.is_active_admin());

comment on table public.fleet_misc_expenses is 'Други разходи по МПС: глоби, пътни такси, паркинг и др.';
