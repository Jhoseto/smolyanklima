-- 0100_service_offers.sql
-- Оферти към клиенти: заглавка + редове (климатици от публичния каталог /
-- монтаж / свободни редове). Публичен достъп само през backend API по
-- public_token (service role) — RLS е admin-only.

create table if not exists public.service_offers (
  id uuid primary key default gen_random_uuid(),
  offer_number text unique not null,
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected')),
  contact_id uuid references public.contacts (id) on delete set null,

  client_name text,
  client_phone text,
  client_email text,
  client_address text,

  title text,
  object_note text,
  intro_note text,
  terms_note text,
  valid_until date,

  vat_rate numeric(5, 2) not null default 20,
  prices_include_vat boolean not null default true,
  discount_total numeric(12, 2) not null default 0,
  currency text not null default 'EUR',

  subtotal numeric(12, 2) not null default 0,
  base_excl_vat numeric(12, 2) not null default 0,
  vat_amount numeric(12, 2) not null default 0,
  total_incl_vat numeric(12, 2) not null default 0,

  public_token text unique not null default encode(gen_random_bytes(18), 'hex'),
  public_enabled boolean not null default true,

  created_by uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  accepted_at timestamptz,

  constraint chk_service_offers_vat_rate check (vat_rate >= 0 and vat_rate <= 100),
  constraint chk_service_offers_discount_nonneg check (discount_total >= 0)
);

create index if not exists idx_service_offers_status on public.service_offers (status);
create index if not exists idx_service_offers_created_at on public.service_offers (created_at desc);
create index if not exists idx_service_offers_contact_id on public.service_offers (contact_id);
create index if not exists idx_service_offers_public_token on public.service_offers (public_token);

create table if not exists public.service_offer_items (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.service_offers (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  kind text not null default 'product'
    check (kind in ('product', 'installation', 'custom')),

  name text not null,
  brand_name text,
  type_name text,
  model_code text,
  image_url text,
  description text,
  specs jsonb not null default '[]'::jsonb,
  group_label text,

  quantity numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  install_price numeric(12, 2),
  line_note text,
  sort_order int not null default 0,

  created_at timestamptz not null default now(),

  constraint chk_service_offer_items_qty check (quantity > 0),
  constraint chk_service_offer_items_unit_price_nonneg check (unit_price >= 0),
  constraint chk_service_offer_items_install_price_nonneg
    check (install_price is null or install_price >= 0)
);

create index if not exists idx_service_offer_items_offer_id
  on public.service_offer_items (offer_id, sort_order);

drop trigger if exists set_service_offers_updated_at on public.service_offers;
create trigger set_service_offers_updated_at
before update on public.service_offers
for each row
execute function public.set_updated_at();

create sequence if not exists public.service_offer_seq start 1;

create or replace function public.next_offer_number()
returns text
language plpgsql
as $$
declare
  seq_val bigint;
begin
  seq_val := nextval('public.service_offer_seq');
  return 'ОФ-' || to_char(current_date, 'YYYY') || lpad(seq_val::text, 3, '0');
end;
$$;

alter table public.service_offers enable row level security;
alter table public.service_offer_items enable row level security;

drop policy if exists service_offers_admin_all on public.service_offers;
create policy service_offers_admin_all on public.service_offers
  for all
  using (public.is_active_admin())
  with check (public.is_active_admin());

drop policy if exists service_offer_items_admin_all on public.service_offer_items;
create policy service_offer_items_admin_all on public.service_offer_items
  for all
  using (public.is_active_admin())
  with check (public.is_active_admin());

comment on table public.service_offers is
  'Оферти към клиенти (Документи → Оферти). Публичен линк по public_token.';
comment on column public.service_offers.object_note is
  'Обект/адрес на обекта — отделно от адреса на клиента.';
comment on column public.service_offer_items.specs is
  'Подреден списък [{label, value}] — редактируеми спецификации със свободни стойности.';
comment on column public.service_offer_items.group_label is
  'Групиране за мулти-сплит (едно външно + N вътрешни под общо подзаглавие).';
