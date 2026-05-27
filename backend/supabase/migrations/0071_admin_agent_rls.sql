-- 0071_admin_agent_rls.sql
-- Defense-in-depth: block direct client access; API uses service role.

alter table public.admin_agent_conversations enable row level security;
alter table public.admin_agent_messages enable row level security;
