-- 0110: разширени типове поддръжка + полета за ремонт (части, труд)

alter table public.fleet_maintenance_events
  add column if not exists parts_description text,
  add column if not exists parts_cost_eur numeric(12, 2) check (parts_cost_eur is null or parts_cost_eur >= 0),
  add column if not exists labor_cost_eur numeric(12, 2) check (labor_cost_eur is null or labor_cost_eur >= 0);

update public.fleet_maintenance_events set kind = 'tires_change' where kind = 'tires';
update public.fleet_maintenance_events set kind = 'consumables' where kind = 'other';

alter table public.fleet_maintenance_events drop constraint if exists fleet_maintenance_events_kind_check;
alter table public.fleet_maintenance_events add constraint fleet_maintenance_events_kind_check
  check (kind in (
    'scheduled_service',
    'oil',
    'filters',
    'tires_change',
    'tires_purchase',
    'consumables',
    'repair'
  ));

comment on column public.fleet_maintenance_events.parts_description is 'Ремонт: закупени части и материали.';
comment on column public.fleet_maintenance_events.parts_cost_eur is 'Ремонт: стойност на части.';
comment on column public.fleet_maintenance_events.labor_cost_eur is 'Ремонт: стойност на труд.';
