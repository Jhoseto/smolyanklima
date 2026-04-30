-- 0006_fix_admin_users_bootstrap.sql
-- Fix circular RLS dependency for admin_users / is_active_admin.
-- Without this, nobody can pass the admin check because admin_users select requires is_active_admin(),
-- and is_active_admin() itself selects from admin_users under RLS.

-- Make helper SECURITY DEFINER so it can read admin_users regardless of caller RLS.
create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users au
    where au.id = auth.uid()
      and au.is_active = true
  );
$$;

-- Allow an authenticated user to read their own admin_users row (bootstrap / login guard).
drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read
on public.admin_users for select
using (auth.uid() = id);

