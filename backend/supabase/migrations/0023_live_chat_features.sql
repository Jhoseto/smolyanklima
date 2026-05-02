-- 0023_live_chat_features.sql
-- Typing indicators, CSAT ratings, product card metadata, visitor page context,
-- canned responses.

-- ── Typing + CSAT + visitor context on live_chats ────────────────────────────

alter table public.live_chats
  add column if not exists admin_typing_at  timestamptz,
  add column if not exists user_typing_at   timestamptz,
  add column if not exists visitor_page_url text,
  add column if not exists csat_rating      smallint check (csat_rating between 1 and 5),
  add column if not exists csat_comment     text      check (csat_comment is null or length(csat_comment) <= 500);

-- ── Structured message metadata (product cards, etc.) ────────────────────────

alter table public.live_chat_messages
  add column if not exists metadata jsonb;

-- ── Canned responses ─────────────────────────────────────────────────────────

create table if not exists public.chat_canned_responses (
  id         uuid        primary key default gen_random_uuid(),
  shortcut   text        not null    check (length(shortcut) between 1 and 50),
  content    text        not null    check (length(content) between 1 and 1000),
  sort_order int         not null    default 0,
  created_at timestamptz not null    default now()
);

alter table public.chat_canned_responses enable row level security;

drop policy if exists canned_responses_admin_all on public.chat_canned_responses;
create policy canned_responses_admin_all on public.chat_canned_responses
  for all
  using (public.is_active_admin())
  with check (public.is_active_admin());

-- Seed common responses
insert into public.chat_canned_responses (shortcut, content, sort_order)
values
  ('hello',   'Здравейте! Как мога да Ви помогна днес?', 1),
  ('wait',    'Моля, изчакайте момент. Ще проверя информацията за Вас.', 2),
  ('offer',   'Ще Ви подготвя индивидуална оферта. Можете ли да споделите размера на помещението (кв.м)?', 3),
  ('install', 'Монтажът включва инсталация, пълнеж с фреон и пуск в действие. Свържете се на 0888 58 58 16 за насрочване.', 4),
  ('thanks',  'Благодаря, че се обърнахте към нас! Ако имате още въпроси, не се колебайте да пишете.', 5),
  ('price',   'Цените зависят от мощността и марката. Изпратете ни площта на помещението и ще Ви дадем точна цена.', 6)
on conflict do nothing;
