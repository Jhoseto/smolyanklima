-- =====================================================================
-- Migration 0038: products.model_code
-- =====================================================================
--
-- Разделя „Модел“ от „Име в клиентския каталог“:
--
--   * model_code — точният модел на уреда (напр. „FTXA50AW“). Кратко,
--     техническо обозначение, ползва се за бързо разпознаване и поиск.
--   * name       — публичното име, което вижда клиентът в каталога
--     (напр. „Daikin Stylish FTXA50AW 5kW“). Остава както досега.
--
-- Полето е по избор — не блокира съществуващи продукти. Когато се
-- попълни, се правят бързи lookup-и по model_code (case-insensitive)
-- и по trigram (similarity search).
-- =====================================================================

alter table public.products
  add column if not exists model_code text;

create index if not exists idx_products_model_code_lower
  on public.products (lower(model_code))
  where model_code is not null;

-- Trigram индекс за similarity търсене (изисква pg_trgm).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    execute 'create index if not exists idx_products_model_code_trgm
             on public.products using gin (model_code gin_trgm_ops)
             where model_code is not null';
  end if;
end
$$;
