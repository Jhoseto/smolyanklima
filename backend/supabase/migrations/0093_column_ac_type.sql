-- Колонен климатик: product_types + UI facet column (между floor и ceiling).

INSERT INTO public.product_types (name)
SELECT 'Колонен климатик'
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_types WHERE name = 'Колонен климатик'
);

INSERT INTO public.categories (slug, name, icon, accent_color, sort_order, is_active)
VALUES ('column', 'Колонни климатици', 'Columns', '#6366F1', 45, true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.category_types (category_id, product_type)
SELECT c.id, 'Колонен климатик'
FROM public.categories c
WHERE c.slug = 'column'
ON CONFLICT (category_id, product_type) DO NOTHING;
