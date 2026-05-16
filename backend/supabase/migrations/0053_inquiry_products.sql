-- Продукти, свързани с едно клиентско запитване (един телефон → едно активно запитване, много модели).
create table if not exists public.inquiry_products (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.inquiries(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_slug text,
  product_name text not null,
  created_at timestamptz not null default now(),
  constraint uq_inquiry_products_inquiry_product unique (inquiry_id, product_id)
);

create index if not exists idx_inquiry_products_inquiry_id
  on public.inquiry_products (inquiry_id);

comment on table public.inquiry_products is 'Климатици, за които клиентът е пуснал запитване в рамките на едно inquiry.';

alter table public.inquiry_products enable row level security;

drop policy if exists inquiry_products_admin_all on public.inquiry_products;
create policy inquiry_products_admin_all
on public.inquiry_products for all
using (public.is_active_admin())
with check (public.is_active_admin());
