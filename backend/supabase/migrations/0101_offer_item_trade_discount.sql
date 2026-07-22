-- 0101_offer_item_trade_discount.sql
-- Търговска отстъпка (ТО) върху единичната цена на ред в оферта.

alter table public.service_offer_items
  add column if not exists trade_discount_percent numeric(5, 2) not null default 0;

alter table public.service_offer_items
  drop constraint if exists chk_service_offer_items_trade_discount;

alter table public.service_offer_items
  add constraint chk_service_offer_items_trade_discount
  check (trade_discount_percent >= 0 and trade_discount_percent <= 100);

comment on column public.service_offer_items.trade_discount_percent is
  'Търговска отстъпка (ТО) върху единичната цена на климатика, %.';
