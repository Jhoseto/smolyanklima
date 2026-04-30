# Supabase schema (migrations)

## How to apply
1) Open Supabase project → **SQL editor**
2) Apply migrations in order:
   - `migrations/0001_extensions_and_helpers.sql`
   - `migrations/0002_core_schema.sql`
   - `migrations/0003_indexes_search.sql`
   - `migrations/0004_rls_policies.sql`
   - `migrations/0005_seed_minimal.sql` (optional)

## Notes
- This project uses **RLS**. Admin access is controlled via `public.admin_users` + `public.is_active_admin()`.
- For safety, **public inserts** are allowed only where explicitly needed (`inquiries` and optionally `newsletter_subscribers` via backend).

