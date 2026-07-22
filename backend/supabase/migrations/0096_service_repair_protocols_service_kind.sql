-- 0096_service_repair_protocols_service_kind.sql
-- Два типа сервизни протоколи:
--   client  — сервиз при клиент (име от контакти, адрес, сериен №)
--   recycle — рециклиране / втора употреба за магазина (без клиент и сериен №)

ALTER TABLE public.service_repair_protocols
  ADD COLUMN IF NOT EXISTS service_kind TEXT NOT NULL DEFAULT 'client';

ALTER TABLE public.service_repair_protocols
  DROP CONSTRAINT IF EXISTS service_repair_protocols_service_kind_check;

ALTER TABLE public.service_repair_protocols
  ADD CONSTRAINT service_repair_protocols_service_kind_check
  CHECK (service_kind IN ('client', 'recycle'));

CREATE INDEX IF NOT EXISTS idx_service_repair_protocols_service_kind
  ON public.service_repair_protocols (service_kind);

COMMENT ON COLUMN public.service_repair_protocols.service_kind IS
  'client = сервиз за клиент; recycle = рециклиране / втора употреба за магазина';
