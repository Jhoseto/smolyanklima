-- Номинална мощност в хиляди BTU (7 = 7000 BTU, 12 = 12000 BTU) за филтри в админ каталога.
alter table public.product_specs
  add column if not exists btu int;

comment on column public.product_specs.btu is 'Номинална мощност (хиляди BTU): 7, 9, 12, 14, 18, 24…';

alter table public.product_specs
  drop constraint if exists chk_specs_btu_positive;

alter table public.product_specs
  add constraint chk_specs_btu_positive check (btu is null or btu > 0);
