-- 0063_supplier_order_flow.sql
-- Supplier order flow: "по поръчка" sales that wait for delivery before installation.
-- 1. Adds 'supplier_order' event_code to work_items.
-- 2. Adds products.supplier_order_work_item_id FK so the delivered product instance
--    tracks back to the originating order work item.

-- ── work_items: add supplier_order event_code ────────────────────
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
      'supplier_order'
    )
  );

comment on column public.work_items.event_code is
  'Тип събитие: supplier_order = поръчка от доставчик (по поръчка продажба, чака доставка и монтаж).';

-- ── products: link delivered product instance to its supplier order ──
alter table public.products
  add column if not exists supplier_order_work_item_id uuid
    references public.work_items (id) on delete set null;

create index if not exists idx_products_supplier_order_work_item_id
  on public.products (supplier_order_work_item_id)
  where supplier_order_work_item_id is not null;
