-- 0030_products_supply_serials_contacts_kind.sql
-- Contacts: split clients vs suppliers (admin "Контакти").
-- Products: serials, supplier purchase metadata, optional slug, drop old_price.
-- Public catalog: price = без монтаж, price_with_mount = с монтаж (без нови колони).

-- ── contacts.contact_kind ───────────────────────────────────
alter table public.contacts
  add column if not exists contact_kind text not null default 'client';

update public.contacts
set contact_kind = 'client'
where contact_kind is null;

alter table public.contacts
  drop constraint if exists chk_contacts_contact_kind;

alter table public.contacts
  add constraint chk_contacts_contact_kind
  check (contact_kind in ('client', 'supplier'));

create index if not exists idx_contacts_contact_kind
  on public.contacts (contact_kind);

-- ── products: inventory / supply fields ─────────────────────
alter table public.products
  add column if not exists indoor_unit_serial text,
  add column if not exists outdoor_unit_serial text,
  add column if not exists supplier_id uuid references public.contacts (id) on delete set null,
  add column if not exists purchased_at date,
  add column if not exists supplier_invoice_number text,
  add column if not exists purchase_price numeric(10, 2);

alter table public.products
  drop constraint if exists chk_products_purchase_price_nonneg;

alter table public.products
  add constraint chk_products_purchase_price_nonneg
  check (purchase_price is null or purchase_price >= 0);

create index if not exists idx_products_supplier_id
  on public.products (supplier_id);

-- ── products: drop old_price ────────────────────────────────
alter table public.products
  drop constraint if exists chk_products_old_price;

alter table public.products
  drop column if exists old_price;

-- ── products: slug optional, unique only when set ────────────
alter table public.products
  alter column slug drop not null;

alter table public.products
  drop constraint if exists products_slug_key;

create unique index if not exists products_slug_unique
  on public.products (slug)
  where slug is not null;
