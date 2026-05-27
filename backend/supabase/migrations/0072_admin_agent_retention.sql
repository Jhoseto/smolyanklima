-- 0072_admin_agent_retention.sql
-- Optional scheduled cleanup reference (API: POST /api/admin/ai-agent/retention/cleanup)
-- Hard-deletes only soft-deleted conversations (deleted_at) older than AI_AGENT_RETENTION_DAYS.

comment on table public.admin_agent_conversations is
  'AI Agent chats. Soft delete via deleted_at; hard purge of soft-deleted rows after AI_AGENT_RETENTION_DAYS (default 90) via retention cleanup API.';
