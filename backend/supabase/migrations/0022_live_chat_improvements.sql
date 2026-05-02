-- 0022_live_chat_improvements.sql
-- Inactivity auto-close tracking + previous chat chain for email-based continuation.

alter table public.live_chats
  add column if not exists last_warned_at  timestamptz,
  add column if not exists previous_chat_id uuid references public.live_chats(id) on delete set null;

create index if not exists idx_live_chats_email on public.live_chats (visitor_email)
  where visitor_email is not null;

create index if not exists idx_live_chats_prev on public.live_chats (previous_chat_id)
  where previous_chat_id is not null;
