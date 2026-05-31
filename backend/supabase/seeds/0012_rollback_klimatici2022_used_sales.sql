-- =====================================================================
-- Rollback: изтриване на импорт Klimatici2022 VTORA (втора употреба)
-- =====================================================================
-- Пусни ПРЕДИ повторен import на 0011_klimatici2022_used_historical_sales.sql
-- НЕ пипа контактите — само продукти + sale work_items от този импорт.
-- =====================================================================

BEGIN;

DELETE FROM public.work_items wi
WHERE wi.event_code = 'sale'
  AND wi.notes LIKE 'Импорт Klimatici2022 VTORA, лист %';

DELETE FROM public.products p
WHERE p.slug LIKE 'klimatici2022-used-%';

COMMIT;
