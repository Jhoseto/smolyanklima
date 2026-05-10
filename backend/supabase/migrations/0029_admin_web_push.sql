-- Push subscriptions за админ PWA (Web Push / service worker).

create table if not exists public.admin_web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists idx_admin_push_subs_user on public.admin_web_push_subscriptions (admin_user_id);

alter table public.admin_web_push_subscriptions enable row level security;

drop policy if exists admin_web_push_subscriptions_service on public.admin_web_push_subscriptions;
create policy admin_web_push_subscriptions_service on public.admin_web_push_subscriptions
  for all using (false) with check (false);

comment on table public.admin_web_push_subscriptions is 'Web Push абонаменти за известия към админ PWA; записи само през Next API със service role.';
