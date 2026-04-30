-- 0017_activity_logs_indexes.sql
-- Speed up admin history queries and filtering.

create index if not exists idx_activity_logs_created_at_desc
on public.activity_logs (created_at desc);

create index if not exists idx_activity_logs_action
on public.activity_logs (action);

create index if not exists idx_activity_logs_entity
on public.activity_logs (entity_type, entity_id);

create index if not exists idx_activity_logs_user
on public.activity_logs (user_id);
