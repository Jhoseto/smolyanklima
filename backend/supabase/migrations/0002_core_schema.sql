-- 0002_core_schema.sql
-- Core schema for catalog, blog, leads, admin, settings, audit.

-- ─────────────────────────────────────────────────────────────
-- Admin
-- ─────────────────────────────────────────────────────────────

create table if not exists public.admin_users (
  id uuid primary key, -- must match auth.users.id
  email citext unique not null,
  name text not null,
  role text not null default 'editor',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_admin_users_updated_at on public.admin_users;
create trigger trg_admin_users_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

create table if not exists public.settings (
  key text primary key,
  value text,
  description text,
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.admin_users(id),
  action text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Catalog
-- ─────────────────────────────────────────────────────────────

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  color text,
  logo_url text,
  website text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_brands_updated_at on public.brands;
create trigger trg_brands_updated_at
before update on public.brands
for each row execute function public.set_updated_at();

create table if not exists public.product_types (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_product_types_updated_at on public.product_types;
create trigger trg_product_types_updated_at
before update on public.product_types
for each row execute function public.set_updated_at();

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  description text,
  icon text,
  accent_color text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create table if not exists public.category_types (
  category_id uuid not null references public.categories(id) on delete cascade,
  product_type text not null,
  primary key (category_id, product_type)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  brand_id uuid not null references public.brands(id),
  type_id uuid not null references public.product_types(id),
  category_id uuid references public.categories(id),
  description text,
  price numeric(10,2) not null,
  price_with_mount numeric(10,2),
  old_price numeric(10,2),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  stock_status text not null default 'in_stock',
  stock_quantity int not null default 0,
  rating numeric(2,1) not null default 0,
  reviews_count int not null default 0,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_products_price_nonneg check (price >= 0),
  constraint chk_products_stock_nonneg check (stock_quantity >= 0),
  constraint chk_products_old_price check (old_price is null or old_price >= price)
);

drop trigger if exists trg_products_updated_at on public.products;
create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create table if not exists public.product_specs (
  product_id uuid primary key references public.products(id) on delete cascade,
  coverage_m2 numeric(6,2),
  noise_db numeric(5,2),
  cooling_power_kw numeric(6,2),
  heating_power_kw numeric(6,2),
  refrigerant text,
  wifi boolean,
  energy_class_cool text,
  energy_class_heat text,
  seer numeric(6,2),
  scop numeric(6,2),
  warranty_months int,
  constraint chk_specs_nonneg check (
    (coverage_m2 is null or coverage_m2 >= 0) and
    (noise_db is null or noise_db >= 0) and
    (cooling_power_kw is null or cooling_power_kw >= 0) and
    (heating_power_kw is null or heating_power_kw >= 0) and
    (seer is null or seer >= 0) and
    (scop is null or scop >= 0) and
    (warranty_months is null or warranty_months >= 0)
  )
);

create table if not exists public.features (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_features_updated_at on public.features;
create trigger trg_features_updated_at
before update on public.features
for each row execute function public.set_updated_at();

create table if not exists public.product_features (
  product_id uuid not null references public.products(id) on delete cascade,
  feature_id uuid not null references public.features(id) on delete cascade,
  primary key (product_id, feature_id)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  is_main boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Blog (MVP, denormalized)
-- ─────────────────────────────────────────────────────────────

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  excerpt text,
  content text not null,
  category_slug text not null,
  tags text[] not null default '{}',
  author_slug text not null,
  featured_image text not null,
  images text[],
  seo jsonb not null,
  schema jsonb not null,
  is_published boolean not null default false,
  published_at timestamptz,
  modified_at timestamptz,
  reading_time int,
  view_count int not null default 0,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_articles_updated_at on public.articles;
create trigger trg_articles_updated_at
before update on public.articles
for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Leads
-- ─────────────────────────────────────────────────────────────

create table if not exists public.inquiries (
  id uuid primary key default gen_random_uuid(),
  source text not null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  message text,
  product_id uuid references public.products(id),
  service_type text,
  status text not null default 'new',
  priority text not null default 'medium',
  assigned_to uuid references public.admin_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_inquiries_updated_at on public.inquiries;
create trigger trg_inquiries_updated_at
before update on public.inquiries
for each row execute function public.set_updated_at();

create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  source text not null default 'blog_newsletter',
  status text not null default 'pending',
  confirm_token_hash text,
  confirm_sent_at timestamptz,
  confirmed_at timestamptz,
  subscribed_at timestamptz not null default now(),
  unsubscribed_at timestamptz
);

create table if not exists public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null,
  to_email citext not null,
  from_email citext,
  subject text not null,
  html text not null,
  text text,
  status text not null default 'pending',
  attempts int not null default 0,
  last_error text,
  send_after timestamptz not null default now(),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

