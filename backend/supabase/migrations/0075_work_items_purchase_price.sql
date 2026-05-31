-- 0075_work_items_purchase_price.sql
-- Закупна/доставна цена на продажба (отделно от продажната unit_price/total_amount).

alter table public.work_items
  add column if not exists purchase_price numeric(10, 2);

alter table public.work_items
  drop constraint if exists chk_work_items_purchase_price_nonneg;

alter table public.work_items
  add constraint chk_work_items_purchase_price_nonneg
  check (purchase_price is null or purchase_price >= 0);

comment on column public.work_items.purchase_price is
  'Закупна/доставна цена при продажбата (€). Продажната е unit_price/total_amount.';
