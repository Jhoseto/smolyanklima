-- Отделни серийни номера за вътрешно и външно тяло (приемо-предавателен протокол).

ALTER TABLE public.service_protocols
  ADD COLUMN IF NOT EXISTS indoor_unit_serial  TEXT,
  ADD COLUMN IF NOT EXISTS outdoor_unit_serial TEXT;

COMMENT ON COLUMN public.service_protocols.indoor_unit_serial  IS 'Сериен номер на вътрешно тяло';
COMMENT ON COLUMN public.service_protocols.outdoor_unit_serial IS 'Сериен номер на външно тяло';

-- Старо единично поле → вътрешно тяло (ако новите колони са празни)
UPDATE public.service_protocols
SET indoor_unit_serial = serial_number
WHERE (indoor_unit_serial IS NULL OR indoor_unit_serial = '')
  AND serial_number IS NOT NULL
  AND serial_number <> '';
