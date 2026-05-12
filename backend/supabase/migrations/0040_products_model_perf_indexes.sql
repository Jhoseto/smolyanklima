-- =====================================================================
-- Migration 0040: Performance индекси за per-model queries
-- ---------------------------------------------------------------------
-- В Migration 0038 добавихме `products.model_code` и създадохме базов
-- functional индекс `idx_products_model_code_lower` (lower(model_code)).
-- Това покрива общи lookup-и, но НЕ е достатъчно за hot path-овете:
--
--   1. DB trigger (0039) — при всеки insert/update/delete на продукт се
--      изпълнява recompute_model_stock_quantity(), който прави:
--         SELECT count(*) FROM products
--          WHERE brand_id = X AND lower(model_code) = Y
--            AND stock_status = 'in_stock';
--         UPDATE products SET stock_quantity = N
--          WHERE brand_id = X AND lower(model_code) = Y;
--      Без подходящ индекс това би довело до seq scan при всяка операция.
--
--   2. /api/admin/products/photos-for-model — извлича reusable снимки
--      от друг продукт със същия (brand, model_code):
--         SELECT id, name FROM products
--          WHERE brand_id = X AND lower(model_code) = lower(Y)
--          ORDER BY created_at ASC LIMIT 20;
--
--   3. /api/admin/products/model-stock-count — live preview на бройките.
--      Същата филтрация (brand_id, lower(model_code), stock_status).
--
--   4. /api/products (публичен каталог) — deduplicate по (brand_id,
--      lower(model_code)) преди page slice.
--
-- Един КОМПОЗИТЕН partial functional индекс покрива и четирите:
-- =====================================================================

-- 1) Главен композитен индекс за hot path-овете.
--    PG може да ползва left prefix (brand_id, lower(model_code))
--    за queries без stock_status филтър — нужен е САМО ТОЗИ индекс
--    за всички per-model операции.
create index if not exists idx_products_brand_model_stock
  on public.products (brand_id, lower(model_code), stock_status)
  where model_code is not null and brand_id is not null;

comment on index public.idx_products_brand_model_stock is
  'Hot path: recompute trigger (0039), photos-for-model, model-stock-count, '
  'катало deduplication. Покрива (brand_id, lower(model_code), stock_status).';

-- 2) Отделен индекс за brand_id (без условие за активност), за случаите
--    когато заявката не филтрира по `is_active`. Сегашният
--    idx_products_active_brand_price включва is_active като първи ключ,
--    което прави PG понякога да го избягва при админ-страничните заявки.
--    Малък индекс, но премахва най-честия „seq scan на brand FK lookup“.
create index if not exists idx_products_brand_id
  on public.products (brand_id)
  where brand_id is not null;

-- 3) sort_order asc indeks for product_images (вече има от 0025), но
--    добавяме малък partial индекс за „главна снимка“ lookup-а.
--    Идеално за UI извличане „коя е main за продукт X“.
create index if not exists idx_product_images_main_per_product
  on public.product_images (product_id)
  where is_main = true;

comment on index public.idx_product_images_main_per_product is
  'Бърз lookup на главната снимка на продукт (за hero image в каталога).';

-- 4) Trigram индекс ВЕЧЕ съществува (0038) — поmagaъ за similarity / fuzzy
--    поиск по model_code (например „FTXA50" → намира „FTXA50AW“ и
--    „FTXA50A2W“). Това е полезно за auto-complete в UI.
--    Не правим duplicate тук.

-- =====================================================================
-- Verification:
--   SELECT indexname, indexdef
--     FROM pg_indexes
--    WHERE tablename = 'products'
--      AND schemaname = 'public'
--    ORDER BY indexname;
--
-- Очаквани нови индекси след тази миграция:
--   - idx_products_brand_model_stock
--   - idx_products_brand_id
--   - idx_product_images_main_per_product
-- =====================================================================
