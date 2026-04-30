-- 0007_grants_public_read_catalog.sql
-- Ensure anon/authenticated roles can read catalog reference tables.
-- Without these grants, PostgREST embeds (brands, product_types, specs, images, features)
-- will come back as null/empty even if the data exists.

grant usage on schema public to anon, authenticated;

grant select on table
  public.brands,
  public.product_types,
  public.categories,
  public.category_types,
  public.features
to anon, authenticated;

grant select on table
  public.product_specs,
  public.product_images,
  public.product_features
to anon, authenticated;

