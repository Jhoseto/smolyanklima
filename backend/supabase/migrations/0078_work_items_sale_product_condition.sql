-- Ръчни продажби без product_id: категория нови / втора употреба за панела „Продажби“.
alter table work_items
  add column if not exists sale_product_condition text
  check (sale_product_condition is null or sale_product_condition in ('new', 'used'));

comment on column work_items.sale_product_condition is
  'При ръчна продажба без product_id — new/used за филтъра в панела на продажбите.';
