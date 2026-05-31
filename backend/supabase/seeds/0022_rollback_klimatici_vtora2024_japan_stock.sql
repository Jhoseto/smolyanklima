-- Rollback: Klimatici vtora2024 JAPAN склад (0021_klimatici_vtora2024_japan_stock.sql)

DELETE FROM public.products
WHERE description LIKE 'Импорт Klimatici vtora2024 JAPAN склад, лист % ред %';
