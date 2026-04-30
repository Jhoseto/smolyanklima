-- 0015_work_items.sql
-- Unified operational items for sales, services, inventory, and tasks.

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('sale', 'service', 'stock_in', 'stock_out', 'task')),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  title text not null,
  notes text,
  due_date date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  product_id uuid references public.products(id) on delete set null,
  inquiry_id uuid references public.inquiries(id) on delete set null,
  customer_name text,
  customer_phone text,
  assigned_to uuid references public.admin_users(id) on delete set null,
  completed_at timestamptz,
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_work_items_updated_at on public.work_items;
create trigger trg_work_items_updated_at
before update on public.work_items
for each row execute function public.set_updated_at();

create index if not exists idx_work_items_due_date on public.work_items (due_date);
create index if not exists idx_work_items_status on public.work_items (status);
create index if not exists idx_work_items_type on public.work_items (type);
