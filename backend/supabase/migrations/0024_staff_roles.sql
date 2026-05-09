-- 0024_staff_roles.sql
-- Proper role system: master_admin / office_staff / service_staff
-- Existing 'editor' rows are promoted to master_admin.

-- 1. Promote legacy 'editor' rows to master_admin
UPDATE public.admin_users
SET role = 'master_admin'
WHERE role = 'editor';

-- 2. Drop old unconstrained default, set new valid values
ALTER TABLE public.admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('master_admin', 'office_staff', 'service_staff'));

-- New staff are office_staff by default
ALTER TABLE public.admin_users
  ALTER COLUMN role SET DEFAULT 'office_staff';

-- 3. Index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_admin_users_role
  ON public.admin_users (role);

-- 4. assigned_to already exists on work_items (0015).
-- Add index if missing.
CREATE INDEX IF NOT EXISTS idx_work_items_assigned_to
  ON public.work_items (assigned_to)
  WHERE assigned_to IS NOT NULL;
