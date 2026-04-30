-- 0019_contacts_module.sql
-- CRM contacts and relation to operational events.

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create index if not exists idx_contacts_name on public.contacts (full_name);
create index if not exists idx_contacts_phone on public.contacts (phone);
create index if not exists idx_contacts_email on public.contacts (email);

alter table public.work_items
add column if not exists contact_id uuid references public.contacts(id) on delete set null;

create index if not exists idx_work_items_contact_id on public.work_items (contact_id);
