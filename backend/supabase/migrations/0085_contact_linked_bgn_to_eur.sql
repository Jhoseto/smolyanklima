-- 0085_contact_linked_bgn_to_eur.sql
-- BGN→EUR за всички операции и обвързани продукти/аксесоари в CRM контакти (не само sale).

alter table public.accessories
  add column if not exists purchase_price numeric(10, 2),
  add column if not exists amounts_converted_from_bgn_at timestamptz;

create temp table _contact_bgn_product_ids (product_id uuid primary key) on commit drop;
create temp table _contact_bgn_accessory_ids (accessory_id uuid primary key) on commit drop;

with wi_targets as (
  select
    wi.id,
    wi.product_id,
    wi.unit_price,
    wi.total_amount,
    wi.purchase_price
  from public.work_items wi
  where wi.amounts_converted_from_bgn_at is null
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
  from wi_targets t
  where wi.id = t.id
  returning wi.product_id
)
insert into _contact_bgn_product_ids (product_id)
select distinct product_id
from updated_wi
where product_id is not null;

-- Продукти на доставчици (supplier_id), закупени преди еврото.
insert into _contact_bgn_product_ids (product_id)
select p.id
from public.products p
where p.amounts_converted_from_bgn_at is null
  and p.supplier_id is not null
  and coalesce(p.purchased_at, (p.created_at at time zone 'Europe/Sofia')::date) < date '2026-02-01'
on conflict (product_id) do nothing;

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
from _contact_bgn_product_ids t
where p.id = t.product_id
  and p.amounts_converted_from_bgn_at is null;

-- Аксесоари на доставчици.
insert into _contact_bgn_accessory_ids (accessory_id)
select a.id
from public.accessories a
where a.amounts_converted_from_bgn_at is null
  and a.supplier_id is not null
  and (a.created_at at time zone 'Europe/Sofia')::date < date '2026-02-01';

update public.accessories a
set
  price = case
    when a.price is not null and a.price > 0 then round((a.price / 1.95583)::numeric, 2)
    else a.price
  end,
  purchase_price = case
    when a.purchase_price is not null and a.purchase_price > 0
      then round((a.purchase_price / 1.95583)::numeric, 2)
    else a.purchase_price
  end,
  amounts_converted_from_bgn_at = now()
from _contact_bgn_accessory_ids t
where a.id = t.accessory_id
  and a.amounts_converted_from_bgn_at is null;
