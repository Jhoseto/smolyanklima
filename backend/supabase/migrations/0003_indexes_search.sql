-- 0003_indexes_search.sql
-- Performance indexes + search indexes (FTS + trigram).

-- products
create index if not exists idx_products_active_featured_price
  on public.products(is_active, is_featured, price);

create index if not exists idx_products_active_brand_price
  on public.products(is_active, brand_id, price);

create index if not exists idx_products_active_category_price
  on public.products(is_active, category_id, price);

-- admin_users
create index if not exists idx_admin_users_active
  on public.admin_users(is_active);

-- inquiries
create index if not exists idx_inquiries_status_created
  on public.inquiries(status, created_at desc);

-- articles
create index if not exists idx_articles_published_date
  on public.articles(is_published, published_at desc);

-- email_outbox
create index if not exists idx_email_outbox_pending
  on public.email_outbox(status, send_after asc);

-- FTS indexes
create index if not exists idx_products_fts
  on public.products
  using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')));

create index if not exists idx_articles_fts
  on public.articles
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,'')));

-- Trigram indexes (fuzzy / partial matching)
create index if not exists idx_products_name_trgm
  on public.products
  using gin (name gin_trgm_ops);

create index if not exists idx_articles_title_trgm
  on public.articles
  using gin (title gin_trgm_ops);

