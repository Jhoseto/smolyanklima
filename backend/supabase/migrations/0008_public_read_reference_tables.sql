-- 0008_public_read_reference_tables.sql
-- Public read policies for catalog reference tables.
-- Needed when RLS is enabled (common in Supabase) so anon can embed/read related data.

-- Brands
alter table public.brands enable row level security;
drop policy if exists brands_public_read on public.brands;
create policy brands_public_read
on public.brands for select
using (true);

-- Product types
alter table public.product_types enable row level security;
drop policy if exists product_types_public_read on public.product_types;
create policy product_types_public_read
on public.product_types for select
using (true);

-- Categories + mapping
alter table public.categories enable row level security;
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read
on public.categories for select
using (true);

alter table public.category_types enable row level security;
drop policy if exists category_types_public_read on public.category_types;
create policy category_types_public_read
on public.category_types for select
using (true);

-- Product specs / images / features
alter table public.product_specs enable row level security;
drop policy if exists product_specs_public_read on public.product_specs;
create policy product_specs_public_read
on public.product_specs for select
using (true);

alter table public.product_images enable row level security;
drop policy if exists product_images_public_read on public.product_images;
create policy product_images_public_read
on public.product_images for select
using (true);

alter table public.features enable row level security;
drop policy if exists features_public_read on public.features;
create policy features_public_read
on public.features for select
using (true);

alter table public.product_features enable row level security;
drop policy if exists product_features_public_read on public.product_features;
create policy product_features_public_read
on public.product_features for select
using (true);

