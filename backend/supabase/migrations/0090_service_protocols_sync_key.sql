-- 0090_service_protocols_sync_key.sql
-- Добавя колона sync_key за idempotency при offline sync.
--
-- При offline POST, клиентът генерира localId ("local-<uuid>") и го изпраща
-- като Idempotency-Key хедър. Сървърът го записва тук. При повторен POST
-- (мрежова грешка след записа, но преди отговора) сървърът открива съществуващия
-- ред и го връща вместо да прави нов INSERT — предотвратява дублирани протоколи.

ALTER TABLE public.service_protocols
  ADD COLUMN IF NOT EXISTS sync_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_service_protocols_sync_key
  ON public.service_protocols (sync_key)
  WHERE sync_key IS NOT NULL;

COMMENT ON COLUMN public.service_protocols.sync_key IS
  'Клиентски idempotency key (offline localId) — предотвратява дублирани POST при retry.';
