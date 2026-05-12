-- 0003_normalize_products_visibility.sql
-- Привежда ВСИЧКИ продукти в каталога в публично видимо състояние:
--   stock_status = 'in_stock'  (вместо 'out_of_stock' / null / друго)
--   is_active    = true
--
-- Изпълнява се идемпотентно: не пипа продуктите, които вече са „в наличност“.
-- Безопасно за повторно пускане.
--
-- ВАЖНО: всеки климатик в магазина се води като уникален артикул, който има
-- собствен сериен номер. Затова бизнес логиката е „или един брой в наличност,
-- или продаден“. След „Маркирай като продаден“ продуктът автоматично става
-- out_of_stock — този скрипт нулира това, ако имаш нужда да върнеш всички
-- обратно (напр. след първоначално зареждане на БД или след масов импорт).

update public.products
set stock_status = 'in_stock',
    is_active = true
where stock_status is distinct from 'in_stock'
   or is_active is distinct from true;

-- Кратък репорт колко са били обновени (виж го в Notice лога на Supabase).
do $$
declare
  total int;
begin
  select count(*) into total from public.products where is_active = true and stock_status = 'in_stock';
  raise notice 'Нормализирани продукти (публично видими): %', total;
end $$;
