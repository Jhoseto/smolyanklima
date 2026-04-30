-- 0004_rls_policies.sql
-- RLS policies: public read / public insert / admin-only write.

-- Enable RLS
alter table public.products enable row level security;
alter table public.articles enable row level security;
alter table public.inquiries enable row level security;
alter table public.admin_users enable row level security;
alter table public.settings enable row level security;
alter table public.activity_logs enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.email_outbox enable row level security;

-- Public read
drop policy if exists products_public_read on public.products;
create policy products_public_read
on public.products for select
using (is_active = true);

drop policy if exists articles_public_read on public.articles;
create policy articles_public_read
on public.articles for select
using (is_published = true);

-- Public insert inquiries (backend is preferred, but keep table future-proof)
drop policy if exists inquiries_public_insert on public.inquiries;
create policy inquiries_public_insert
on public.inquiries for insert
with check (true);

-- Admin helper
create or replace function public.is_active_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.admin_users au
    where au.id = auth.uid()
      and au.is_active = true
  );
$$;

-- Admin-only: products
drop policy if exists products_admin_write on public.products;
create policy products_admin_write
on public.products for all
using (public.is_active_admin())
with check (public.is_active_admin());

-- Admin-only: articles
drop policy if exists articles_admin_write on public.articles;
create policy articles_admin_write
on public.articles for all
using (public.is_active_admin())
with check (public.is_active_admin());

-- Admin-only: inquiries read/update
drop policy if exists inquiries_admin_read on public.inquiries;
create policy inquiries_admin_read
on public.inquiries for select
using (public.is_active_admin());

drop policy if exists inquiries_admin_update on public.inquiries;
create policy inquiries_admin_update
on public.inquiries for update
using (public.is_active_admin())
with check (public.is_active_admin());

-- Admin-only: admin_users
drop policy if exists admin_users_admin_read on public.admin_users;
create policy admin_users_admin_read
on public.admin_users for select
using (public.is_active_admin());

drop policy if exists admin_users_admin_write on public.admin_users;
create policy admin_users_admin_write
on public.admin_users for all
using (public.is_active_admin())
with check (public.is_active_admin());

-- Admin-only: settings
drop policy if exists settings_admin_rw on public.settings;
create policy settings_admin_rw
on public.settings for all
using (public.is_active_admin())
with check (public.is_active_admin());

-- Admin-only: activity logs
drop policy if exists activity_logs_admin_read on public.activity_logs;
create policy activity_logs_admin_read
on public.activity_logs for select
using (public.is_active_admin());

-- Admin-only: email_outbox + newsletter_subscribers
drop policy if exists email_outbox_admin_rw on public.email_outbox;
create policy email_outbox_admin_rw
on public.email_outbox for all
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists newsletter_admin_rw on public.newsletter_subscribers;
create policy newsletter_admin_rw
on public.newsletter_subscribers for all
using (public.is_active_admin())
with check (public.is_active_admin());

