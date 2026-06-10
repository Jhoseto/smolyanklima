-- Резервация на наличен продукт за клиент (work_items.event_code = reservation).

alter table public.work_items
  drop constraint if exists chk_work_items_event_code;

alter table public.work_items
  add constraint chk_work_items_event_code check (
    event_code is null or event_code in (
      'item_added',
      'item_removed',
      'sale',
      'service_installation',
      'service_maintenance',
      'service_on_site',
      'service_in_shop',
      'consultation',
      'supplier_order',
      'reservation'
    )
  );

comment on column public.work_items.event_code is
  'Тип събитие: reservation = резервация на наличен продукт за клиент; supplier_order = поръчка от доставчик.';

-- Една активна резервация на продукт.
create unique index if not exists idx_work_items_active_reservation_per_product
  on public.work_items (product_id)
  where event_code = 'reservation'
    and status in ('planned', 'in_progress')
    and product_id is not null;
