-- Категория (нови / втора употреба) за ръчни поръчки без шаблонен product_id.

alter table public.work_items
  add column if not exists order_product_condition text
  check (order_product_condition is null or order_product_condition in ('new', 'used'));

comment on column public.work_items.order_product_condition is
  'Категория на поръчка от доставчик — за филтри и ръчен запис без product_id.';

update public.work_items wi
set order_product_condition = p.product_condition
from public.products p
where wi.product_id = p.id
  and wi.event_code = 'supplier_order'
  and wi.order_product_condition is null
  and p.product_condition in ('new', 'used');
