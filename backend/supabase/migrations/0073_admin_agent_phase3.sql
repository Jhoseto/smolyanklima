-- 0073_admin_agent_phase3.sql
-- Phase 3: saved query templates + scheduled reports.

create table if not exists public.admin_agent_query_templates (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users (id) on delete cascade,
  title text not null,
  prompt text not null,
  description text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_admin_agent_query_templates_user_sort
  on public.admin_agent_query_templates (admin_user_id, sort_order)
  where deleted_at is null;

drop trigger if exists trg_admin_agent_query_templates_updated_at on public.admin_agent_query_templates;
create trigger trg_admin_agent_query_templates_updated_at
before update on public.admin_agent_query_templates
for each row execute function public.set_updated_at();

create table if not exists public.admin_agent_scheduled_reports (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users (id) on delete cascade,
  template_id uuid references public.admin_agent_query_templates (id) on delete set null,
  title text not null,
  prompt text not null,
  frequency text not null check (frequency in ('daily', 'weekly', 'monthly')),
  day_of_week smallint check (day_of_week is null or (day_of_week >= 0 and day_of_week <= 6)),
  day_of_month smallint check (day_of_month is null or (day_of_month >= 1 and day_of_month <= 28)),
  hour_local smallint not null default 8 check (hour_local >= 0 and hour_local <= 23),
  enabled boolean not null default true,
  last_run_at timestamptz,
  next_run_at timestamptz not null,
  last_conversation_id uuid references public.admin_agent_conversations (id) on delete set null,
  last_status text check (last_status is null or last_status in ('success', 'failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_admin_agent_scheduled_reports_due
  on public.admin_agent_scheduled_reports (next_run_at)
  where deleted_at is null and enabled = true;

create index if not exists idx_admin_agent_scheduled_reports_user
  on public.admin_agent_scheduled_reports (admin_user_id, updated_at desc)
  where deleted_at is null;

drop trigger if exists trg_admin_agent_scheduled_reports_updated_at on public.admin_agent_scheduled_reports;
create trigger trg_admin_agent_scheduled_reports_updated_at
before update on public.admin_agent_scheduled_reports
for each row execute function public.set_updated_at();

alter table public.admin_agent_query_templates enable row level security;
alter table public.admin_agent_scheduled_reports enable row level security;
