-- =====================================================================
-- Rollback: изтриване на импорт AERF VTORA (нови климатици)
-- =====================================================================
-- Пусни ПРЕДИ повторен import на 0016_aerf_historical_sales.sql
-- =====================================================================

BEGIN;

DELETE FROM public.work_items wi
WHERE wi.event_code = 'sale'
  AND wi.notes LIKE 'Импорт AERF VTORA, лист %';

DELETE FROM public.products p
WHERE p.slug ~ '^aerf-(europa|japan)-[0-9]+$';

COMMIT;
