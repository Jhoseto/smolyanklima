-- Профилна снимка на админ / персонал (Cloudinary secure_url).

ALTER TABLE public.admin_users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

COMMENT ON COLUMN public.admin_users.avatar_url IS
  'Публичен URL към снимката (напр. Cloudinary secure_url).';
