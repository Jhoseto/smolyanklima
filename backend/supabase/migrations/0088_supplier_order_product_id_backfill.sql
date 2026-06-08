-- След доставка поръчката трябва да сочи към складовата инстанция, не към каталогния шаблон.
update public.work_items wi
set product_id = p.id
from public.products p
where wi.event_code = 'supplier_order'
  and wi.status = 'done'
  and p.supplier_order_work_item_id = wi.id
  and wi.product_id is distinct from p.id;
