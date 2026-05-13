-- Сервизният протокол няма клиентска страна — само подпис на сервизен техник.

ALTER TABLE public.service_repair_protocols
  DROP COLUMN IF EXISTS signature_client;
