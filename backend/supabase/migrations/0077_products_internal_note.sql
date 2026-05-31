-- 0077_products_internal_note.sql
-- Вътрешна бележка за продукт — само админ панел, не в публичния каталог.

alter table public.products
  add column if not exists internal_note text;

comment on column public.products.internal_note is
  'Вътрешна бележка — видима само в админ панела, не в публичния каталог.';
