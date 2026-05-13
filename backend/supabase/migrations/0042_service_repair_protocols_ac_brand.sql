-- Отделна колона за марка на климатика (моделът остава в ac_model).

ALTER TABLE public.service_repair_protocols
  ADD COLUMN IF NOT EXISTS ac_brand TEXT;

COMMENT ON COLUMN public.service_repair_protocols.ac_brand IS 'Марка на климатика; моделът е в ac_model.';
