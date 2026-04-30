-- 0012_products_condition.sql
-- Add primary condition split for AC catalog: new vs used.

alter table public.products
add column if not exists product_condition text not null default 'new';

update public.products
set product_condition = 'new'
where product_condition is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chk_products_condition'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
    add constraint chk_products_condition
    check (product_condition in ('new', 'used'));
  end if;
end $$;

create index if not exists idx_products_condition_active
  on public.products (product_condition, is_active);
