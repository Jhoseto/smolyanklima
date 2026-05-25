-- Supabase не позволява set_config('session_replication_role') извън superuser.
-- Restore работи без нея (FK ред + двupass upsert в приложението).

drop function if exists public.admin_backup_set_replication_role(boolean);

notify pgrst, 'reload schema';
