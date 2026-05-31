-- =====================================================================
-- Rollback: AERF sklad inventory (0018_aerf_stock_inventory.sql)
-- =====================================================================
-- Deletes only unreferenced stock products created by seed 0018.
-- =====================================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.products p
    JOIN public.work_items wi ON wi.product_id = p.id
    WHERE p.slug ~ '^aerf-stock-(europa|japan)-[0-9]+$'
      AND p.description LIKE 'Импорт AERF склад, лист %'
  ) THEN
    RAISE EXCEPTION 'AERF stock rollback blocked: at least one imported product is referenced by work_items.';
  END IF;
END
$$;

DELETE FROM public.products p
WHERE p.slug ~ '^aerf-stock-(europa|japan)-[0-9]+$'
  AND p.description LIKE 'Импорт AERF склад, лист %';

COMMIT;
