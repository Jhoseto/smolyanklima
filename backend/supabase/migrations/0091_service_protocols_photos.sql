-- 0091_service_protocols_photos.sql
-- Добавя масив от URL-и на снимки (Cloudinary) към приемно-предавателния протокол.
-- До 5 снимки, съхранявани в smolyanklima/protokoli/{protocol_id}/

ALTER TABLE public.service_protocols
  ADD COLUMN IF NOT EXISTS photo_urls TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.service_protocols.photo_urls IS
  'Cloudinary URL-и на снимки от монтажа (до 5). Папка: smolyanklima/protokoli/{id}/';
