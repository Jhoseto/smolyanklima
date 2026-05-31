-- Попълване на sale_product_condition от каталога за съществуващи продажби.
update work_items wi
set sale_product_condition = p.product_condition
from products p
where wi.product_id = p.id
  and wi.event_code = 'sale'
  and wi.sale_product_condition is null
  and p.product_condition in ('new', 'used');

comment on column work_items.sale_product_condition is
  'Категория на продажбата (new/used) — за филтъра в панела на продажбите; копира се от продукта или се задава ръчно.';
