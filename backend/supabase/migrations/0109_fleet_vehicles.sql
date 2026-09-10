-- 0109_fleet_vehicles.sql
-- Автопарк: превозни средства, срокове (винетка/GO/преглед) и поддръжки/ремонти.

create table if not exists public.fleet_vehicles (
  id uuid primary key default gen_random_uuid(),
  registration_number text not null,
  make text not null,
  model text not null,
  year int,
  vin text,
  fuel_type text not null default 'diesel'
    check (fuel_type in ('petrol', 'diesel', 'lpg', 'electric', 'hybrid')),
  odometer_km int not null default 0 check (odometer_km >= 0),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'sold')),
  assigned_admin_user_id uuid references public.admin_users (id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_fleet_vehicles_registration unique (registration_number)
);

create table if not exists public.fleet_compliance_records (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  kind text not null
    check (kind in ('vignette', 'civil_liability', 'technical_inspection', 'kasko')),
  valid_from date,
  expires_on date not null,
  provider text,
  reference_number text,
  cost_eur numeric(12, 2) check (cost_eur is null or cost_eur >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fleet_maintenance_events (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references public.fleet_vehicles (id) on delete cascade,
  kind text not null default 'scheduled_service'
    check (kind in ('scheduled_service', 'repair', 'tires', 'oil', 'other')),
  title text not null,
  performed_on date not null,
  odometer_km int check (odometer_km is null or odometer_km >= 0),
  cost_eur numeric(12, 2) check (cost_eur is null or cost_eur >= 0),
  vendor text,
  next_due_date date,
  next_due_km int check (next_due_km is null or next_due_km >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_fleet_vehicles_status on public.fleet_vehicles (status);
create index if not exists idx_fleet_vehicles_registration on public.fleet_vehicles (registration_number);
create index if not exists idx_fleet_vehicles_assigned_admin on public.fleet_vehicles (assigned_admin_user_id)
  where assigned_admin_user_id is not null;

create index if not exists idx_fleet_compliance_vehicle_kind_expires
  on public.fleet_compliance_records (vehicle_id, kind, expires_on desc);

create index if not exists idx_fleet_maintenance_vehicle_date
  on public.fleet_maintenance_events (vehicle_id, performed_on desc);

drop trigger if exists set_fleet_vehicles_updated_at on public.fleet_vehicles;
create trigger set_fleet_vehicles_updated_at
before update on public.fleet_vehicles
for each row execute function public.set_updated_at();

drop trigger if exists set_fleet_compliance_updated_at on public.fleet_compliance_records;
create trigger set_fleet_compliance_updated_at
before update on public.fleet_compliance_records
for each row execute function public.set_updated_at();

drop trigger if exists set_fleet_maintenance_updated_at on public.fleet_maintenance_events;
create trigger set_fleet_maintenance_updated_at
before update on public.fleet_maintenance_events
for each row execute function public.set_updated_at();

alter table public.fleet_vehicles enable row level security;
alter table public.fleet_compliance_records enable row level security;
alter table public.fleet_maintenance_events enable row level security;

drop policy if exists fleet_vehicles_admin_all on public.fleet_vehicles;
create policy fleet_vehicles_admin_all on public.fleet_vehicles
  for all using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists fleet_compliance_admin_all on public.fleet_compliance_records;
create policy fleet_compliance_admin_all on public.fleet_compliance_records
  for all using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists fleet_maintenance_admin_all on public.fleet_maintenance_events;
create policy fleet_maintenance_admin_all on public.fleet_maintenance_events
  for all using (public.is_active_admin()) with check (public.is_active_admin());

comment on table public.fleet_vehicles is 'Автопарк — превозни средства на фирмата.';
comment on table public.fleet_compliance_records is 'Срокове: винетка, GO, технически преглед, каско.';
comment on table public.fleet_maintenance_events is 'Поддръжки и ремонти по МПС.';
