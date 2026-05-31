-- Rollback: Klimatici втора употреба — склад (0019_klimatici_used_stock_inventory.sql)
-- Изтрива само продукти, създадени от seed 0019 (по описание).

DELETE FROM public.products
WHERE description LIKE 'Импорт % VTORA склад, лист % ред %';
