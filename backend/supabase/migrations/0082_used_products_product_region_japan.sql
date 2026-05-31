-- Втора употреба → регион JAPAN (бизнес правило за каталога).
update public.products
set product_region = 'japan'
where product_condition = 'used'
  and product_region is distinct from 'japan';

comment on column public.products.product_region is
  'europe | japan. Втора употреба (used) винаги е japan.';

create or replace function public.enforce_used_product_region_japan()
returns trigger
language plpgsql
as $$
begin
  if new.product_condition = 'used' then
    new.product_region := 'japan';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_used_region_japan on public.products;

create trigger trg_products_used_region_japan
before insert or update of product_condition, product_region on public.products
for each row
execute function public.enforce_used_product_region_japan();
