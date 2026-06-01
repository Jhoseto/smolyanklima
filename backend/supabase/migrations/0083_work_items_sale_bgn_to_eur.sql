-- 0083_work_items_sale_bgn_to_eur.sql
-- Исторически продажби (до 31.01.2026 включително) са импортирани/въведени в BGN — конвертиране в EUR.

alter table public.work_items
  add column if not exists amounts_converted_from_bgn_at timestamptz;

comment on column public.work_items.amounts_converted_from_bgn_at is
  'Кога unit_price/total_amount/purchase_price са конвертирани от BGN в EUR (курс 1.95583).';

alter table public.products
  add column if not exists amounts_converted_from_bgn_at timestamptz;

comment on column public.products.amounts_converted_from_bgn_at is
  'Кога price/purchase_price са конвертирани от BGN в EUR за продукт, свързан с историческа продажба.';

create temp table _bgn_eur_converted_products (product_id uuid primary key) on commit drop;

with sale_targets as (
  select
    wi.id,
    wi.product_id,
    wi.unit_price,
    wi.total_amount,
    wi.purchase_price
  from public.work_items wi
  where wi.event_code = 'sale'
    and wi.amounts_converted_from_bgn_at is null
    and coalesce(
      wi.due_date,
      (wi.completed_at at time zone 'Europe/Sofia')::date,
      (wi.created_at at time zone 'Europe/Sofia')::date
    ) < date '2026-02-01'
),
updated_wi as (
  update public.work_items wi
  set
    unit_price = case
      when t.unit_price is not null then round((t.unit_price / 1.95583)::numeric, 2)
      else wi.unit_price
    end,
    total_amount = case
      when t.total_amount is not null then round((t.total_amount / 1.95583)::numeric, 2)
      else wi.total_amount
    end,
    purchase_price = case
      when t.purchase_price is not null then round((t.purchase_price / 1.95583)::numeric, 2)
      else wi.purchase_price
    end,
    amounts_converted_from_bgn_at = now()
  from sale_targets t
  where wi.id = t.id
  returning wi.product_id
)
insert into _bgn_eur_converted_products (product_id)
select distinct product_id
from updated_wi
where product_id is not null;

update public.products p
set
  price = case
    when p.price is not null and p.price > 0 then round((p.price / 1.95583)::numeric, 2)
    else p.price
  end,
  purchase_price = case
    when p.purchase_price is not null and p.purchase_price > 0
      then round((p.purchase_price / 1.95583)::numeric, 2)
    else p.purchase_price
  end,
  amounts_converted_from_bgn_at = now()
from _bgn_eur_converted_products t
where p.id = t.product_id
  and p.amounts_converted_from_bgn_at is null
  and not (p.is_active = true and p.show_in_public_catalog = true);
