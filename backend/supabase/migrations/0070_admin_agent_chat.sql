-- 0070_admin_agent_chat.sql
-- Persistent AI Agent conversations for master_admin.

create table if not exists public.admin_agent_conversations (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users (id) on delete cascade,
  title text not null default 'Нов разговор',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_admin_agent_conversations_user_updated
  on public.admin_agent_conversations (admin_user_id, updated_at desc)
  where deleted_at is null;

drop trigger if exists trg_admin_agent_conversations_updated_at on public.admin_agent_conversations;
create trigger trg_admin_agent_conversations_updated_at
before update on public.admin_agent_conversations
for each row execute function public.set_updated_at();

create table if not exists public.admin_agent_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.admin_agent_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content jsonb not null default '{}'::jsonb,
  token_usage jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_agent_messages_conversation_created
  on public.admin_agent_messages (conversation_id, created_at);
