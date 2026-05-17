-- Замяна на фасет/тип „Офис системи“ с „Таванни климатици“ (таванен климатик, не касетъчен).

UPDATE public.categories
SET
  slug = 'ceiling',
  name = 'Таванни климатици',
  icon = 'ArrowUpFromLine',
  accent_color = '#0891B2',
  sort_order = 50
WHERE slug = 'office';

UPDATE public.product_types
SET name = 'Таванен климатик'
WHERE name IN ('Офис климатик', 'Офис системи', 'Офис системи/климатик');

UPDATE public.category_types
SET product_type = 'Таванен климатик'
WHERE product_type IN ('Офис климатик', 'Офис системи', 'Офис системи/климатик');

INSERT INTO public.product_types (name)
SELECT 'Таванен климатик'
WHERE NOT EXISTS (
  SELECT 1 FROM public.product_types WHERE name = 'Таванен климатик'
);

INSERT INTO public.category_types (category_id, product_type)
SELECT c.id, 'Таванен климатик'
FROM public.categories c
WHERE c.slug = 'ceiling'
ON CONFLICT (category_id, product_type) DO NOTHING;
