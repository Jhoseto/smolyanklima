-- =====================================================================
-- Rollback: изтриване на импорт KlimaticiVtora VTORA (втора употреба)
-- =====================================================================
-- Пусни ПРЕДИ повторен import на 0014_klimatici_vtora_used_historical_sales.sql
-- НЕ пипа контактите — само продукти + sale work_items от този импорт.
-- =====================================================================

BEGIN;

DELETE FROM public.work_items wi
WHERE wi.event_code = 'sale'
  AND wi.notes LIKE 'Импорт KlimaticiVtora VTORA, лист %';

DELETE FROM public.products p
WHERE p.slug LIKE 'klimatici-vtora-used-%';

COMMIT;
