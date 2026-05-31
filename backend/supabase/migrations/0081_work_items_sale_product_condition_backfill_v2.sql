-- Попълване на sale_product_condition за филтъра „Нови / Втора употреба“ (повторяемо).
update work_items wi
set sale_product_condition = p.product_condition
from products p
where wi.product_id = p.id
  and wi.event_code = 'sale'
  and wi.sale_product_condition is null
  and p.product_condition in ('new', 'used');

-- Ръчни продажби без product_id — по подразбиране „нови“, ако липсва стойност.
update work_items
set sale_product_condition = 'new'
where event_code = 'sale'
  and sale_product_condition is null
  and product_id is null;
