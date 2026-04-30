-- Admin CRUD: product_specs + product_images (RLS had only public SELECT before)

drop policy if exists product_specs_admin_write on public.product_specs;
create policy product_specs_admin_write
on public.product_specs for all
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists product_images_admin_write on public.product_images;
create policy product_images_admin_write
on public.product_images for all
using (public.is_active_admin())
with check (public.is_active_admin());
