-- 0099_containers_cost_fields.sql
-- Разходи по контейнер (втора употреба от Япония): дата на отпътуване,
-- мито, ДДС, цена на контейнера от Япония и транспортни разходи (до
-- България и до Смолян). Всички суми са в EUR, по избор (nullable).

alter table public.containers
  add column if not exists departure_date date,
  add column if not exists customs_duty numeric(10, 2),
  add column if not exists vat_amount numeric(10, 2),
  add column if not exists japan_price numeric(10, 2),
  add column if not exists transport_to_bulgaria numeric(10, 2),
  add column if not exists transport_to_smolyan numeric(10, 2);

alter table public.containers
  drop constraint if exists chk_containers_customs_duty_nonneg;
alter table public.containers
  add constraint chk_containers_customs_duty_nonneg check (customs_duty is null or customs_duty >= 0);

alter table public.containers
  drop constraint if exists chk_containers_vat_amount_nonneg;
alter table public.containers
  add constraint chk_containers_vat_amount_nonneg check (vat_amount is null or vat_amount >= 0);

alter table public.containers
  drop constraint if exists chk_containers_japan_price_nonneg;
alter table public.containers
  add constraint chk_containers_japan_price_nonneg check (japan_price is null or japan_price >= 0);

alter table public.containers
  drop constraint if exists chk_containers_transport_to_bulgaria_nonneg;
alter table public.containers
  add constraint chk_containers_transport_to_bulgaria_nonneg
  check (transport_to_bulgaria is null or transport_to_bulgaria >= 0);

alter table public.containers
  drop constraint if exists chk_containers_transport_to_smolyan_nonneg;
alter table public.containers
  add constraint chk_containers_transport_to_smolyan_nonneg
  check (transport_to_smolyan is null or transport_to_smolyan >= 0);

comment on column public.containers.departure_date is 'Дата на отпътуване от Япония.';
comment on column public.containers.customs_duty is 'Мито (€).';
comment on column public.containers.vat_amount is 'ДДС (€).';
comment on column public.containers.japan_price is 'Цена на контейнера от Япония (€).';
comment on column public.containers.transport_to_bulgaria is 'Транспортни разходи до България (€).';
comment on column public.containers.transport_to_smolyan is 'Транспортни разходи до Смолян (€).';
