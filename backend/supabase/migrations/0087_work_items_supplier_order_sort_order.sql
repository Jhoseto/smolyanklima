-- Ръчен ред на активни поръчки от доставчик (drag-and-drop, master_admin).

alter table public.work_items
  add column if not exists supplier_order_sort_order int;

comment on column public.work_items.supplier_order_sort_order is
  'Ръчен ред в панела „Поръчки“ (само активни supplier_order). NULL = след записаните с позиция, по due_date.';

create index if not exists idx_work_items_supplier_order_sort
  on public.work_items (supplier_order_sort_order)
  where event_code = 'supplier_order'
    and status in ('planned', 'in_progress');

-- Начален ред по due_date / created_at за съществуващи активни поръчки.
with ranked as (
  select
    id,
    row_number() over (
      order by due_date asc nulls last, created_at desc, id asc
    ) as rn
  from public.work_items
  where event_code = 'supplier_order'
    and status in ('planned', 'in_progress')
    and supplier_order_sort_order is null
)
update public.work_items wi
set supplier_order_sort_order = ranked.rn
from ranked
where wi.id = ranked.id;
