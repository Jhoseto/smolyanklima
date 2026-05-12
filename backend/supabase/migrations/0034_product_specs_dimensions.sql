-- 0034_product_specs_dimensions.sql
-- Допълнителни характеристики за климатиците: тегло и размери
-- на вътрешния и външния блок.
--
-- Колоните са nullable — по-старите продукти, които нямат
-- въведени стойности, продължават да работят без промяна.
-- Размерите се пазят в милиметри (int), теглото — в килограми
-- (numeric с 2 знака след десетичната запетая).

alter table public.product_specs
  add column if not exists weight_indoor_kg     numeric(7,2),
  add column if not exists weight_outdoor_kg    numeric(7,2),
  add column if not exists dim_indoor_length_mm  int,
  add column if not exists dim_indoor_width_mm   int,
  add column if not exists dim_indoor_height_mm  int,
  add column if not exists dim_outdoor_length_mm int,
  add column if not exists dim_outdoor_width_mm  int,
  add column if not exists dim_outdoor_height_mm int;

-- Премахваме стария check, за да добавим разширената версия с
-- проверки за неотрицателност и за новите полета.
alter table public.product_specs
  drop constraint if exists chk_specs_nonneg;

alter table public.product_specs
  add constraint chk_specs_nonneg check (
    (coverage_m2 is null or coverage_m2 >= 0) and
    (noise_db is null or noise_db >= 0) and
    (cooling_power_kw is null or cooling_power_kw >= 0) and
    (heating_power_kw is null or heating_power_kw >= 0) and
    (seer is null or seer >= 0) and
    (scop is null or scop >= 0) and
    (warranty_months is null or warranty_months >= 0) and
    (weight_indoor_kg is null or weight_indoor_kg >= 0) and
    (weight_outdoor_kg is null or weight_outdoor_kg >= 0) and
    (dim_indoor_length_mm is null or dim_indoor_length_mm >= 0) and
    (dim_indoor_width_mm is null or dim_indoor_width_mm >= 0) and
    (dim_indoor_height_mm is null or dim_indoor_height_mm >= 0) and
    (dim_outdoor_length_mm is null or dim_outdoor_length_mm >= 0) and
    (dim_outdoor_width_mm is null or dim_outdoor_width_mm >= 0) and
    (dim_outdoor_height_mm is null or dim_outdoor_height_mm >= 0)
  );
