-- 0026_product_ratings_rls_and_indexes.sql
-- Пропуски открити при одит след 0025:
-- 1. product_ratings — липсва RLS изцяло (всеки може да изтрие оценки)
-- 2. products — липсва индекс по (is_active, type_id) за категорийния филтър
-- 3. products — липсва composite index за препоръчаното сортиране в каталога
-- ────────────────────────────────────────────────────────────────────────────

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. RLS за product_ratings
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.product_ratings enable row level security;

-- Публично четене (за показване на звезди/брой отзиви)
create policy product_ratings_public_read
  on public.product_ratings for select
  using (true);

-- Публично добавяне (посетителите могат да оценяват)
create policy product_ratings_public_insert
  on public.product_ratings for insert
  with check (true);

-- Само admin може да изтрива / редактира оценки
create policy product_ratings_admin_all
  on public.product_ratings for all
  using (public.is_active_admin())
  with check (public.is_active_admin());


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. Индекс за категориен филтър (is_active + type_id)
--    Заявка: .eq("is_active", true).in("type_id", typeIds)
-- ══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_products_active_type_id
  on public.products (is_active, type_id)
  where is_active = true;


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Composite index за препоръчаното сортиране в публичния каталог
--    .order("reviews_count", desc).order("rating", desc).order("is_featured", desc)
-- ══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_products_recommended_sort
  on public.products (is_active, reviews_count desc, rating desc, is_featured desc)
  where is_active = true;
