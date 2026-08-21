-- 0103_products_stock_location_service.sql
-- Добавя трети статус на местоположение: "в сервиз" (продукт е предаден за ремонт/диагностика).
-- Остава отделно от stock_status — виж 0031_products_stock_location.sql.

alter table public.products
  drop constraint if exists chk_products_stock_location;

alter table public.products
  add constraint chk_products_stock_location
  check (stock_location in ('showroom', 'warehouse', 'service'));
