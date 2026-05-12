-- 0035_featured_top_products.sql
-- „Топ продукти“ за главната страница: до 6 позиции (3 горе, 3 долу),
-- всяка може да има визуален „badge“ (Bestseller, Топ оферта и т.н.).
--
-- featured_position:
--   • NULL  → продуктът НЕ е в Топ продукти.
--   • 1..6  → конкретна позиция в 3×2 грида.
-- featured_badge:
--   • NULL                  → без badge.
--   • bestseller | top_offer | promo | top_searched | premium | best_value
--     (на български: Bestseller, Топ оферта, Промоция, Най-търсен,
--      Премиум, Най-изгоден).
--
-- Запазваме обратна съвместимост с по-стария флаг `is_featured`: всеки
-- продукт с присвоена позиция автоматично се счита и за „featured“.

alter table public.products
  add column if not exists featured_position smallint,
  add column if not exists featured_badge    text;

-- Само един продукт може да заема дадена позиция в Топ продукти.
create unique index if not exists uq_products_featured_position
  on public.products (featured_position)
  where featured_position is not null;

-- Помощен индекс за бързо извличане на „Топ продукти“ подредени по позиция.
create index if not exists idx_products_featured_position_active
  on public.products (featured_position)
  where featured_position is not null and is_active = true;

-- Гард: позиция в 1..6.
alter table public.products
  drop constraint if exists chk_products_featured_position;
alter table public.products
  add constraint chk_products_featured_position check (
    featured_position is null
    or (featured_position >= 1 and featured_position <= 6)
  );

-- Гард: badge е от затворения списък по-горе или NULL.
alter table public.products
  drop constraint if exists chk_products_featured_badge;
alter table public.products
  add constraint chk_products_featured_badge check (
    featured_badge is null
    or featured_badge in (
      'bestseller', 'top_offer', 'promo',
      'top_searched', 'premium', 'best_value'
    )
  );

-- Sync на is_featured за всички продукти с присвоена позиция (еднократно,
-- бъдещият sync се прави от backend-а).
update public.products
set is_featured = true
where featured_position is not null and is_featured is distinct from true;
