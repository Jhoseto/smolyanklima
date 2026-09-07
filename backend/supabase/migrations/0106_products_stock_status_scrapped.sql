-- 0106_products_stock_status_scrapped.sql
-- Нов складов статус `scrapped` (бракуван) — уред изваден от оборот
-- (не се брои в stock_quantity; не се показва в публичен каталог).
-- Колоната stock_status е TEXT без CHECK — стойността се валидира в API.

COMMENT ON COLUMN public.products.stock_status IS
  'in_stock | out_of_stock (продаден/изчерпан) | on_order | reserved | scrapped (бракуван)';
