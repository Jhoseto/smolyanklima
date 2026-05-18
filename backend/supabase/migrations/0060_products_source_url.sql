-- URL на продукта при доставчика (за наблюдение и проследяване на импорта).

alter table public.products
  add column if not exists source_url text;

comment on column public.products.source_url is
  'Оригинален URL на страницата на продукта при доставчика (bulclima, climacom и др.).';

alter table public.accessories
  add column if not exists source_url text;

comment on column public.accessories.source_url is
  'Оригинален URL на страницата на аксесоара при доставчика.';
