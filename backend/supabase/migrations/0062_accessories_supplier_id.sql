-- Add supplier_id to accessories table (mirrors products.supplier_id).
alter table public.accessories
  add column if not exists supplier_id uuid references public.contacts (id) on delete set null;

create index if not exists idx_accessories_supplier_id
  on public.accessories (supplier_id);
