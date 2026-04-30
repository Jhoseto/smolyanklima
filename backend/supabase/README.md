# Supabase schema (migrations)

## How to apply
1) Open Supabase project → **SQL editor**
2) Apply migrations in order:
   - `migrations/0001_extensions_and_helpers.sql`
   - `migrations/0002_core_schema.sql`
   - `migrations/0003_indexes_search.sql`
   - `migrations/0004_rls_policies.sql`
   - `migrations/0005_seed_minimal.sql` (optional)
   - `migrations/0006_fix_admin_users_bootstrap.sql` (if needed)
   - `migrations/0007_grants_public_read_catalog.sql`
   - `migrations/0008_public_read_reference_tables.sql`
   - `migrations/0009_accessories_tables.sql` (accessories)
   - `migrations/0010_inquiries_admin_notes.sql`
   - `migrations/0011_search_product_ids.sql` (RPC за търсене в каталога)
   - `migrations/0012_admin_write_product_specs_images.sql` (RLS: admin write за specs/images)
   - `migrations/0013_product_features_admin_write.sql` (RLS: admin write за `product_features`)

## Notes
- This project uses **RLS**. Admin access is controlled via `public.admin_users` + `public.is_active_admin()`.
- For safety, **public inserts** are allowed only where explicitly needed (`inquiries` and optionally `newsletter_subscribers` via backend).

