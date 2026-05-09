-- 0027_staff_phone.sql
-- Добавя phone колона към admin_users за служители без корпоративен имейл.
-- Вътрешно Supabase Auth продължава да използва auto-генериран email,
-- но интерфейсът работи с телефонен номер.

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS phone text;

CREATE INDEX IF NOT EXISTS idx_admin_users_phone
  ON public.admin_users (phone)
  WHERE phone IS NOT NULL;
