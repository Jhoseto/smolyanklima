-- Admin UI / API: управление на връзки продукт ↔ feature (не само service role import)

drop policy if exists product_features_admin_write on public.product_features;
create policy product_features_admin_write
on public.product_features for all
using (public.is_active_admin())
with check (public.is_active_admin());
