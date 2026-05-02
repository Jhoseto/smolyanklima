-- 0021_live_chat.sql
-- Real-time live chat: visitors can escalate from AI to a human agent.
-- All visitor access is handled by the backend API (service role).
-- Admin access uses the existing is_active_admin() helper.

-- ── Tables ─────────────────────────────────────────────────────────────────

create table if not exists public.live_chats (
  id              uuid        primary key default gen_random_uuid(),
  session_token   uuid        not null    default gen_random_uuid(),  -- visitor bearer token
  visitor_name    text        not null    check (length(visitor_name) between 1 and 120),
  visitor_email   text                    check (visitor_email is null or length(visitor_email) <= 254),
  visitor_phone   text                    check (visitor_phone is null or length(visitor_phone) <= 30),
  status          text        not null    default 'waiting'
                              check (status in ('waiting', 'active', 'closed')),
  ai_context      jsonb,                 -- last AI messages passed at handoff (read-only context for agent)
  admin_notes     text,
  created_at      timestamptz not null    default now(),
  updated_at      timestamptz not null    default now(),
  closed_at       timestamptz,
  last_message_at timestamptz
);

create table if not exists public.live_chat_messages (
  id          uuid        primary key default gen_random_uuid(),
  chat_id     uuid        not null    references public.live_chats(id) on delete cascade,
  sender_role text        not null    check (sender_role in ('user', 'admin', 'system')),
  content     text        not null    check (length(content) between 1 and 4000),
  created_at  timestamptz not null    default now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────

create index if not exists idx_live_chats_status        on public.live_chats (status);
create index if not exists idx_live_chats_created_at    on public.live_chats (created_at desc);
create index if not exists idx_live_chats_updated_at    on public.live_chats (updated_at desc);
create index if not exists idx_live_chat_msgs_chat_id   on public.live_chat_messages (chat_id, created_at);

-- ── updated_at trigger ──────────────────────────────────────────────────────

create or replace function public.set_live_chat_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_live_chats_updated_at on public.live_chats;
create trigger trg_live_chats_updated_at
  before update on public.live_chats
  for each row execute function public.set_live_chat_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────

alter table public.live_chats         enable row level security;
alter table public.live_chat_messages enable row level security;

-- Visitors have NO direct Supabase access; all operations go through the API (service role).
-- Only admins (via is_active_admin()) get direct access for real-time / admin queries.

drop policy if exists live_chats_admin_all          on public.live_chats;
drop policy if exists live_chat_messages_admin_all  on public.live_chat_messages;

create policy live_chats_admin_all on public.live_chats
  for all
  using (public.is_active_admin())
  with check (public.is_active_admin());

create policy live_chat_messages_admin_all on public.live_chat_messages
  for all
  using (public.is_active_admin())
  with check (public.is_active_admin());
