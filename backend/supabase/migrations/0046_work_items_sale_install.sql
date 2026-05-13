-- Връзка продажба ↔ монтаж и бизнес-статус „чака монтаж“ / „завършен“ за панела Продажби.

alter table public.work_items
  add column if not exists sale_install_state text;

alter table public.work_items
  drop constraint if exists chk_work_items_sale_install_state;

alter table public.work_items
  add constraint chk_work_items_sale_install_state check (
    sale_install_state is null or sale_install_state in ('pending_mount', 'completed')
  );

alter table public.work_items
  add column if not exists installation_work_item_id uuid references public.work_items(id) on delete set null;

alter table public.work_items
  add column if not exists sale_work_item_id uuid references public.work_items(id) on delete set null;

create index if not exists idx_work_items_sale_install_state
  on public.work_items (sale_install_state)
  where sale_install_state is not null;

create index if not exists idx_work_items_installation_work_item_id
  on public.work_items (installation_work_item_id)
  where installation_work_item_id is not null;

create index if not exists idx_work_items_sale_work_item_id
  on public.work_items (sale_work_item_id)
  where sale_work_item_id is not null;

-- Досегашни продажби в календара като „завършени“ (вече изпълнени).
update public.work_items
set sale_install_state = 'completed'
where event_code = 'sale'
  and status = 'done'
  and sale_install_state is null;

comment on column public.work_items.sale_install_state is
  'За event_code=sale: pending_mount | completed (панел Продажби).';
comment on column public.work_items.installation_work_item_id is
  'За продажба: id на свързания work_item за монтаж (service_installation).';
comment on column public.work_items.sale_work_item_id is
  'За монтаж от продуктова продажба: id на свързаната продажба (sale).';
