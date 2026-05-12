-- ============================================================
-- SmolyanKlima — пълна база данни (всички миграции наред)
-- Изпълни целия файл в SQL Editor на новия Supabase проект.
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0001 · Extensions + helper functions
-- ────────────────────────────────────────────────────────────

create extension if not exists pgcrypto;
create extension if not exists citext;
create extension if not exists pg_trgm;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ────────────────────────────────────────────────────────────
-- 0002 · Core schema
-- ────────────────────────────────────────────────────────────

-- Admin
create table if not exists public.admin_users (
  id uuid primary key,
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

-- Catalog
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

-- Blog
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

-- Leads / Inquiries
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


-- ────────────────────────────────────────────────────────────
-- 0003 · Indexes + search
-- ────────────────────────────────────────────────────────────

create index if not exists idx_products_active_featured_price
  on public.products(is_active, is_featured, price);
create index if not exists idx_products_active_brand_price
  on public.products(is_active, brand_id, price);
create index if not exists idx_products_active_category_price
  on public.products(is_active, category_id, price);
create index if not exists idx_admin_users_active
  on public.admin_users(is_active);
create index if not exists idx_inquiries_status_created
  on public.inquiries(status, created_at desc);
create index if not exists idx_articles_published_date
  on public.articles(is_published, published_at desc);
create index if not exists idx_email_outbox_pending
  on public.email_outbox(status, send_after asc);
create index if not exists idx_products_fts
  on public.products
  using gin (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(description,'')));
create index if not exists idx_articles_fts
  on public.articles
  using gin (to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(excerpt,'') || ' ' || coalesce(content,'')));
create index if not exists idx_products_name_trgm
  on public.products using gin (name gin_trgm_ops);
create index if not exists idx_articles_title_trgm
  on public.articles using gin (title gin_trgm_ops);


-- ────────────────────────────────────────────────────────────
-- 0004 · RLS policies
-- ────────────────────────────────────────────────────────────

alter table public.products enable row level security;
alter table public.articles enable row level security;
alter table public.inquiries enable row level security;
alter table public.admin_users enable row level security;
alter table public.settings enable row level security;
alter table public.activity_logs enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.email_outbox enable row level security;

drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (is_active = true);

drop policy if exists articles_public_read on public.articles;
create policy articles_public_read on public.articles for select using (is_published = true);

drop policy if exists inquiries_public_insert on public.inquiries;
create policy inquiries_public_insert on public.inquiries for insert with check (true);

create or replace function public.is_active_admin()
returns boolean language sql stable as $$
  select exists (
    select 1 from public.admin_users au
    where au.id = auth.uid() and au.is_active = true
  );
$$;

drop policy if exists products_admin_write on public.products;
create policy products_admin_write on public.products for all
  using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists articles_admin_write on public.articles;
create policy articles_admin_write on public.articles for all
  using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists inquiries_admin_read on public.inquiries;
create policy inquiries_admin_read on public.inquiries for select using (public.is_active_admin());

drop policy if exists inquiries_admin_update on public.inquiries;
create policy inquiries_admin_update on public.inquiries for update
  using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists admin_users_admin_read on public.admin_users;
create policy admin_users_admin_read on public.admin_users for select using (public.is_active_admin());

drop policy if exists admin_users_admin_write on public.admin_users;
create policy admin_users_admin_write on public.admin_users for all
  using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists settings_admin_rw on public.settings;
create policy settings_admin_rw on public.settings for all
  using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists activity_logs_admin_read on public.activity_logs;
create policy activity_logs_admin_read on public.activity_logs for select using (public.is_active_admin());

drop policy if exists email_outbox_admin_rw on public.email_outbox;
create policy email_outbox_admin_rw on public.email_outbox for all
  using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists newsletter_admin_rw on public.newsletter_subscribers;
create policy newsletter_admin_rw on public.newsletter_subscribers for all
  using (public.is_active_admin()) with check (public.is_active_admin());


-- ────────────────────────────────────────────────────────────
-- 0005 · Seed (категории, feature tags, настройки)
-- ────────────────────────────────────────────────────────────

insert into public.categories (slug, name, icon, accent_color, sort_order, is_active) values
  ('all',      'Всички',            'LayoutGrid', '#6B7280', 0,  true),
  ('wall',     'Стенни климатици',  'Home',       '#FF4D00', 10, true),
  ('multi',    'Мулти-сплит системи','Layers',    '#00B4D8', 20, true),
  ('cassette', 'Касетни климатици', 'Building2',  '#7C3AED', 30, true),
  ('floor',    'Подови климатици',  'ArrowDown',  '#0D9488', 40, true),
  ('office',   'Офис системи',      'Briefcase',  '#2563EB', 50, true)
on conflict (slug) do nothing;

insert into public.features (slug, name) values
  ('wifi',          'WiFi управление'),
  ('inverter',      'Инвертор'),
  ('night_mode',    'Нощен режим'),
  ('self_cleaning', 'Самопочистване'),
  ('ionizer',       'Йонизатор'),
  ('nanoe',         'nanoe™'),
  ('turbo',         'Турбо режим')
on conflict (slug) do nothing;

insert into public.settings (key, value, description) values
  ('company_phone',   '0888 58 58 16',                          'Primary phone number'),
  ('company_email',   'office@smolyanklima.bg',                 'Primary email'),
  ('company_address', 'ул. Наталия 19, Смолян',                 'Office address'),
  ('working_hours',   'Пон-Пет: 09:00-18:00; Съб: 10:00-14:00','Working hours')
on conflict (key) do nothing;


-- ────────────────────────────────────────────────────────────
-- 0006 · Fix RLS bootstrap (circular dependency)
-- ────────────────────────────────────────────────────────────

create or replace function public.is_active_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_users au
    where au.id = auth.uid() and au.is_active = true
  );
$$;

drop policy if exists admin_users_self_read on public.admin_users;
create policy admin_users_self_read on public.admin_users for select using (auth.uid() = id);


-- ────────────────────────────────────────────────────────────
-- 0007 · Grants: public read on catalog
-- ────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;

grant select on table
  public.brands, public.product_types, public.categories,
  public.category_types, public.features
to anon, authenticated;

grant select on table
  public.product_specs, public.product_images, public.product_features
to anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 0008 · RLS public read: catalog reference tables
-- ────────────────────────────────────────────────────────────

alter table public.brands enable row level security;
drop policy if exists brands_public_read on public.brands;
create policy brands_public_read on public.brands for select using (true);

alter table public.product_types enable row level security;
drop policy if exists product_types_public_read on public.product_types;
create policy product_types_public_read on public.product_types for select using (true);

alter table public.categories enable row level security;
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select using (true);

alter table public.category_types enable row level security;
drop policy if exists category_types_public_read on public.category_types;
create policy category_types_public_read on public.category_types for select using (true);

alter table public.product_specs enable row level security;
drop policy if exists product_specs_public_read on public.product_specs;
create policy product_specs_public_read on public.product_specs for select using (true);

alter table public.product_images enable row level security;
drop policy if exists product_images_public_read on public.product_images;
create policy product_images_public_read on public.product_images for select using (true);

alter table public.features enable row level security;
drop policy if exists features_public_read on public.features;
create policy features_public_read on public.features for select using (true);

alter table public.product_features enable row level security;
drop policy if exists product_features_public_read on public.product_features;
create policy product_features_public_read on public.product_features for select using (true);


-- ────────────────────────────────────────────────────────────
-- 0009 · Accessories tables
-- ────────────────────────────────────────────────────────────

create table if not exists public.accessories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  brand_id uuid references public.brands(id),
  kind text not null default 'accessory',
  description text,
  price numeric(10,2) not null,
  old_price numeric(10,2),
  is_active boolean not null default true,
  stock_status text not null default 'in_stock',
  stock_quantity int not null default 0,
  meta_title text,
  meta_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_accessories_price_nonneg check (price >= 0),
  constraint chk_accessories_stock_nonneg check (stock_quantity >= 0),
  constraint chk_accessories_old_price check (old_price is null or old_price >= price)
);

drop trigger if exists trg_accessories_updated_at on public.accessories;
create trigger trg_accessories_updated_at
before update on public.accessories
for each row execute function public.set_updated_at();

create table if not exists public.accessory_images (
  id uuid primary key default gen_random_uuid(),
  accessory_id uuid not null references public.accessories(id) on delete cascade,
  url text not null,
  sort_order int not null default 0,
  is_main boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.accessories enable row level security;
alter table public.accessory_images enable row level security;

drop policy if exists accessories_public_read on public.accessories;
create policy accessories_public_read on public.accessories for select using (is_active = true);

drop policy if exists accessory_images_public_read on public.accessory_images;
create policy accessory_images_public_read on public.accessory_images for select using (true);

drop policy if exists accessories_admin_write on public.accessories;
create policy accessories_admin_write on public.accessories for all
  using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists accessory_images_admin_write on public.accessory_images;
create policy accessory_images_admin_write on public.accessory_images for all
  using (public.is_active_admin()) with check (public.is_active_admin());

grant select on table public.accessories, public.accessory_images to anon, authenticated;


-- ────────────────────────────────────────────────────────────
-- 0010 · Inquiries: admin notes
-- ────────────────────────────────────────────────────────────

alter table public.inquiries add column if not exists admin_notes text;


-- ────────────────────────────────────────────────────────────
-- 0011 · FTS function search_product_ids
-- ────────────────────────────────────────────────────────────

create or replace function public.search_product_ids(search_query text, result_limit int default 2000)
returns table(id uuid) language sql stable security definer set search_path = public as $$
  select p.id from public.products p
  where p.is_active = true
    and trim(coalesce(search_query, '')) <> ''
    and (
      to_tsvector('simple', coalesce(p.name,'') || ' ' || coalesce(p.description,''))
        @@ plainto_tsquery('simple', trim(search_query))
      or p.name ilike '%' || trim(search_query) || '%'
      or p.description ilike '%' || trim(search_query) || '%'
    )
  order by p.is_featured desc nulls last, p.price asc
  limit greatest(1, least(coalesce(result_limit, 2000), 5000));
$$;

revoke all on function public.search_product_ids(text, int) from public;
grant execute on function public.search_product_ids(text, int) to service_role;


-- ────────────────────────────────────────────────────────────
-- 0012a · Admin write: product_specs + product_images
-- ────────────────────────────────────────────────────────────

drop policy if exists product_specs_admin_write on public.product_specs;
create policy product_specs_admin_write on public.product_specs for all
  using (public.is_active_admin()) with check (public.is_active_admin());

drop policy if exists product_images_admin_write on public.product_images;
create policy product_images_admin_write on public.product_images for all
  using (public.is_active_admin()) with check (public.is_active_admin());


-- ────────────────────────────────────────────────────────────
-- 0012b · Products: condition (new / used)
-- ────────────────────────────────────────────────────────────

alter table public.products add column if not exists product_condition text not null default 'new';

update public.products set product_condition = 'new' where product_condition is null;

do $$ begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_products_condition' and conrelid = 'public.products'::regclass
  ) then
    alter table public.products add constraint chk_products_condition
      check (product_condition in ('new', 'used'));
  end if;
end $$;

create index if not exists idx_products_condition_active on public.products (product_condition, is_active);


-- ────────────────────────────────────────────────────────────
-- 0013a · Admin write: product_features
-- ────────────────────────────────────────────────────────────

drop policy if exists product_features_admin_write on public.product_features;
create policy product_features_admin_write on public.product_features for all
  using (public.is_active_admin()) with check (public.is_active_admin());


-- ────────────────────────────────────────────────────────────
-- 0013b · Product ratings
-- ────────────────────────────────────────────────────────────

create table if not exists public.product_ratings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  rater_key text not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (product_id, rater_key)
);

create index if not exists idx_product_ratings_product_created
  on public.product_ratings (product_id, created_at desc);

create or replace function public.refresh_product_rating(p_product_id uuid)
returns void language plpgsql as $$
declare
  v_reviews int;
  v_rating numeric(2,1);
begin
  select count(*)::int, coalesce(round(avg(stars)::numeric, 1), 0)
  into v_reviews, v_rating
  from public.product_ratings where product_id = p_product_id;
  update public.products
  set reviews_count = coalesce(v_reviews, 0), rating = coalesce(v_rating, 0)
  where id = p_product_id;
end;
$$;

create or replace function public.trg_refresh_product_rating()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_rating(old.product_id); return old;
  end if;
  perform public.refresh_product_rating(new.product_id);
  if tg_op = 'UPDATE' and old.product_id <> new.product_id then
    perform public.refresh_product_rating(old.product_id);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_product_ratings_refresh on public.product_ratings;
create trigger trg_product_ratings_refresh
after insert or update or delete on public.product_ratings
for each row execute function public.trg_refresh_product_rating();


-- ────────────────────────────────────────────────────────────
-- 0014 · Inventory hardening
-- ────────────────────────────────────────────────────────────

alter table public.products add column if not exists stock_quantity int;
update public.products set stock_quantity = 0 where stock_quantity is null;
alter table public.products alter column stock_quantity set default 0;
alter table public.products alter column stock_quantity set not null;

alter table public.products add column if not exists stock_status text;
update public.products set stock_status = 'in_stock' where stock_status is null;
alter table public.products alter column stock_status set default 'in_stock';
alter table public.products alter column stock_status set not null;


-- ────────────────────────────────────────────────────────────
-- 0015 · Work items (оперативни задачи)
-- ────────────────────────────────────────────────────────────

create table if not exists public.work_items (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('sale', 'service', 'stock_in', 'stock_out', 'task')),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'done', 'cancelled')),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  title text not null,
  notes text,
  due_date date,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  product_id uuid references public.products(id) on delete set null,
  inquiry_id uuid references public.inquiries(id) on delete set null,
  customer_name text,
  customer_phone text,
  assigned_to uuid references public.admin_users(id) on delete set null,
  completed_at timestamptz,
  created_by uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_work_items_updated_at on public.work_items;
create trigger trg_work_items_updated_at
before update on public.work_items
for each row execute function public.set_updated_at();

create index if not exists idx_work_items_due_date on public.work_items (due_date);
create index if not exists idx_work_items_status   on public.work_items (status);
create index if not exists idx_work_items_type     on public.work_items (type);


-- ────────────────────────────────────────────────────────────
-- 0016 · Products: sold_quantity
-- ────────────────────────────────────────────────────────────

alter table public.products add column if not exists sold_quantity int;
update public.products set sold_quantity = 0 where sold_quantity is null;
alter table public.products alter column sold_quantity set default 0;
alter table public.products alter column sold_quantity set not null;


-- ────────────────────────────────────────────────────────────
-- 0017 · Activity logs indexes
-- ────────────────────────────────────────────────────────────

create index if not exists idx_activity_logs_created_at_desc on public.activity_logs (created_at desc);
create index if not exists idx_activity_logs_action          on public.activity_logs (action);
create index if not exists idx_activity_logs_entity          on public.activity_logs (entity_type, entity_id);
create index if not exists idx_activity_logs_user            on public.activity_logs (user_id);


-- ────────────────────────────────────────────────────────────
-- 0018 · Work items: business fields
-- ────────────────────────────────────────────────────────────

alter table public.work_items add column if not exists event_code text;
alter table public.work_items drop constraint if exists chk_work_items_event_code;
alter table public.work_items add constraint chk_work_items_event_code check (
  event_code is null or event_code in (
    'item_added','item_removed','sale',
    'service_installation','service_inspection','service_repair','service_maintenance'
  )
);

update public.work_items set event_code = case
  when type = 'sale'     then 'sale'
  when type = 'stock_in' then 'item_added'
  when type = 'stock_out' then 'item_removed'
  when type = 'service'  then 'service_repair'
  else null
end where event_code is null;

alter table public.work_items add column if not exists customer_address text;
alter table public.work_items add column if not exists quantity int;
update public.work_items set quantity = 1 where quantity is null;
alter table public.work_items alter column quantity set default 1;
alter table public.work_items alter column quantity set not null;
alter table public.work_items add column if not exists unit_price   numeric(10,2);
alter table public.work_items add column if not exists total_amount numeric(10,2);

create index if not exists idx_work_items_event_code on public.work_items (event_code);


-- ────────────────────────────────────────────────────────────
-- 0019 · Contacts module (CRM)
-- ────────────────────────────────────────────────────────────

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  email text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

create index if not exists idx_contacts_name  on public.contacts (full_name);
create index if not exists idx_contacts_phone on public.contacts (phone);
create index if not exists idx_contacts_email on public.contacts (email);

alter table public.work_items add column if not exists contact_id uuid references public.contacts(id) on delete set null;
create index if not exists idx_work_items_contact_id on public.work_items (contact_id);


-- ────────────────────────────────────────────────────────────
-- 0020 · Contacts: follow-up CRM fields
-- ────────────────────────────────────────────────────────────

alter table public.contacts add column if not exists customer_status text not null default 'new';
alter table public.contacts drop constraint if exists chk_contacts_customer_status;
alter table public.contacts add constraint chk_contacts_customer_status
  check (customer_status in ('new', 'active', 'vip', 'lost'));

alter table public.contacts add column if not exists next_follow_up_at  date;
alter table public.contacts add column if not exists last_contacted_at  date;

create index if not exists idx_contacts_next_follow_up_at on public.contacts (next_follow_up_at);
create index if not exists idx_contacts_customer_status   on public.contacts (customer_status);


-- ────────────────────────────────────────────────────────────
-- 0021 · Live chat
-- ────────────────────────────────────────────────────────────

create table if not exists public.live_chats (
  id              uuid        primary key default gen_random_uuid(),
  session_token   uuid        not null    default gen_random_uuid(),
  visitor_name    text        not null    check (length(visitor_name) between 1 and 120),
  visitor_email   text                    check (visitor_email is null or length(visitor_email) <= 254),
  visitor_phone   text                    check (visitor_phone is null or length(visitor_phone) <= 30),
  status          text        not null    default 'waiting'
                              check (status in ('waiting', 'active', 'closed')),
  ai_context      jsonb,
  admin_notes     text,
  created_at      timestamptz not null    default now(),
  updated_at      timestamptz not null    default now(),
  closed_at       timestamptz,
  last_message_at timestamptz
);

create table if not exists public.live_chat_messages (
  id          uuid        primary key default gen_random_uuid(),
  chat_id     uuid        not null    references public.live_chats(id) on delete cascade,
  sender_role text        not null    check (sender_role in ('user', 'admin', 'system')),
  content     text        not null    check (length(content) between 1 and 4000),
  created_at  timestamptz not null    default now()
);

create index if not exists idx_live_chats_status      on public.live_chats (status);
create index if not exists idx_live_chats_created_at  on public.live_chats (created_at desc);
create index if not exists idx_live_chats_updated_at  on public.live_chats (updated_at desc);
create index if not exists idx_live_chat_msgs_chat_id on public.live_chat_messages (chat_id, created_at);

create or replace function public.set_live_chat_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists trg_live_chats_updated_at on public.live_chats;
create trigger trg_live_chats_updated_at
  before update on public.live_chats
  for each row execute function public.set_live_chat_updated_at();

alter table public.live_chats         enable row level security;
alter table public.live_chat_messages enable row level security;

drop policy if exists live_chats_admin_all         on public.live_chats;
drop policy if exists live_chat_messages_admin_all on public.live_chat_messages;

create policy live_chats_admin_all on public.live_chats for all
  using (public.is_active_admin()) with check (public.is_active_admin());
create policy live_chat_messages_admin_all on public.live_chat_messages for all
  using (public.is_active_admin()) with check (public.is_active_admin());


-- ────────────────────────────────────────────────────────────
-- 0022 · Live chat: inactivity + chain
-- ────────────────────────────────────────────────────────────

alter table public.live_chats
  add column if not exists last_warned_at   timestamptz,
  add column if not exists previous_chat_id uuid references public.live_chats(id) on delete set null;

create index if not exists idx_live_chats_email on public.live_chats (visitor_email) where visitor_email is not null;
create index if not exists idx_live_chats_prev  on public.live_chats (previous_chat_id) where previous_chat_id is not null;


-- ────────────────────────────────────────────────────────────
-- 0023 · Live chat: typing, CSAT, product cards, canned responses
-- ────────────────────────────────────────────────────────────

alter table public.live_chats
  add column if not exists admin_typing_at  timestamptz,
  add column if not exists user_typing_at   timestamptz,
  add column if not exists visitor_page_url text,
  add column if not exists csat_rating      smallint check (csat_rating between 1 and 5),
  add column if not exists csat_comment     text check (csat_comment is null or length(csat_comment) <= 500);

alter table public.live_chat_messages add column if not exists metadata jsonb;

create table if not exists public.chat_canned_responses (
  id         uuid        primary key default gen_random_uuid(),
  shortcut   text        not null    check (length(shortcut) between 1 and 50),
  content    text        not null    check (length(content) between 1 and 1000),
  sort_order int         not null    default 0,
  created_at timestamptz not null    default now()
);

alter table public.chat_canned_responses enable row level security;

drop policy if exists canned_responses_admin_all on public.chat_canned_responses;
create policy canned_responses_admin_all on public.chat_canned_responses for all
  using (public.is_active_admin()) with check (public.is_active_admin());

insert into public.chat_canned_responses (shortcut, content, sort_order) values
  ('hello',   'Здравейте! Как мога да Ви помогна днес?', 1),
  ('wait',    'Моля, изчакайте момент. Ще проверя информацията за Вас.', 2),
  ('offer',   'Ще Ви подготвя индивидуална оферта. Можете ли да споделите размера на помещението (кв.м)?', 3),
  ('install', 'Монтажът включва инсталация, пълнеж с фреон и пуск в действие. Свържете се на 0888 58 58 16 за насрочване.', 4),
  ('thanks',  'Благодаря, че се обърнахте към нас! Ако имате още въпроси, не се колебайте да пишете.', 5),
  ('price',   'Цените зависят от мощността и марката. Изпратете ни площта на помещението и ще Ви дадем точна цена.', 6)
on conflict do nothing;


-- ────────────────────────────────────────────────────────────
-- 0024 · Роли на персонала (master_admin / office_staff / service_staff)
-- ────────────────────────────────────────────────────────────

-- Промоция на legacy 'editor' акаунти
update public.admin_users set role = 'master_admin' where role = 'editor';

alter table public.admin_users drop constraint if exists admin_users_role_check;
alter table public.admin_users
  add constraint admin_users_role_check
  check (role in ('master_admin', 'office_staff', 'service_staff'));

alter table public.admin_users alter column role set default 'office_staff';

create index if not exists idx_admin_users_role        on public.admin_users (role);
create index if not exists idx_work_items_assigned_to  on public.work_items (assigned_to) where assigned_to is not null;


-- ────────────────────────────────────────────────────────────
-- 0025 · Performance + Security (критични липсващи оптимизации)
-- ────────────────────────────────────────────────────────────

-- RLS на contacts (липсваше — сигурностен пропуск)
alter table public.contacts enable row level security;
drop policy if exists contacts_admin_all on public.contacts;
create policy contacts_admin_all on public.contacts for all
  using (public.is_active_admin()) with check (public.is_active_admin());

-- RLS на work_items (липсваше)
alter table public.work_items enable row level security;
drop policy if exists work_items_admin_all on public.work_items;
create policy work_items_admin_all on public.work_items for all
  using (public.is_active_admin()) with check (public.is_active_admin());

-- Trigram ILIKE — contacts
create index if not exists idx_contacts_name_trgm     on public.contacts using gin (full_name gin_trgm_ops);
create index if not exists idx_contacts_phone_trgm    on public.contacts using gin (phone gin_trgm_ops);
create index if not exists idx_contacts_email_trgm    on public.contacts using gin (email gin_trgm_ops);
create index if not exists idx_contacts_address_trgm  on public.contacts using gin (address gin_trgm_ops);
create index if not exists idx_contacts_updated_at_desc on public.contacts (updated_at desc);

-- Trigram ILIKE — inquiries
create index if not exists idx_inquiries_customer_name_trgm  on public.inquiries using gin (customer_name gin_trgm_ops);
create index if not exists idx_inquiries_customer_phone_trgm on public.inquiries using gin (customer_phone gin_trgm_ops);
create index if not exists idx_inquiries_customer_email_trgm on public.inquiries using gin (customer_email gin_trgm_ops);
create index if not exists idx_inquiries_message_fts
  on public.inquiries using gin (to_tsvector('simple', coalesce(message, '')));
create index if not exists idx_inquiries_source on public.inquiries (source);

-- Trigram ILIKE — work_items
create index if not exists idx_work_items_title_trgm            on public.work_items using gin (title gin_trgm_ops);
create index if not exists idx_work_items_customer_name_trgm    on public.work_items using gin (customer_name gin_trgm_ops);
create index if not exists idx_work_items_customer_phone_trgm   on public.work_items using gin (customer_phone gin_trgm_ops);
create index if not exists idx_work_items_customer_address_trgm on public.work_items using gin (customer_address gin_trgm_ops);

-- Съставни — work_items (WorkItemsPlanner + service staff)
create index if not exists idx_work_items_due_date_status   on public.work_items (due_date, status) where due_date is not null;
create index if not exists idx_work_items_assigned_status_due on public.work_items (assigned_to, status, due_date) where assigned_to is not null;
create index if not exists idx_work_items_due_created        on public.work_items (due_date asc nulls last, created_at desc);

-- Live chats — sort by last_message_at
create index if not exists idx_live_chats_last_message_at on public.live_chats (last_message_at desc nulls last);
create index if not exists idx_live_chats_status_last_msg on public.live_chats (status, last_message_at desc nulls last);

-- Products — admin sort/filter
create index if not exists idx_products_active_created_desc on public.products (is_active, created_at desc);
create index if not exists idx_products_active_stock_status on public.products (is_active, stock_status);
create index if not exists idx_products_sold_quantity_desc  on public.products (sold_quantity desc) where is_active = true;
create index if not exists idx_products_slug_trgm           on public.products using gin (slug gin_trgm_ops);

-- Accessories — ILIKE search
create index if not exists idx_accessories_name_trgm        on public.accessories using gin (name gin_trgm_ops);
create index if not exists idx_accessories_description_trgm on public.accessories using gin (description gin_trgm_ops);

-- Activity logs — action ILIKE search
create index if not exists idx_activity_logs_action_trgm on public.activity_logs using gin (action gin_trgm_ops);

-- Email outbox — drain covering index
create index if not exists idx_email_outbox_pending_full
  on public.email_outbox (status, send_after asc, kind)
  where status in ('pending', 'failed');

-- Product images — sort
create index if not exists idx_product_images_product_sort on public.product_images (product_id, sort_order asc);

-- Live chat messages — asc streaming
create index if not exists idx_live_chat_msgs_chat_created_asc on public.live_chat_messages (chat_id, created_at asc);


-- ============================================================
-- 0026_product_ratings_rls_and_indexes.sql
-- Пропуски открити при одит след 0025:
-- 1. product_ratings — липсва RLS изцяло (всеки може да изтрие оценки)
-- 2. products — липсва индекс по (is_active, type_id) за категорийния филтър
-- 3. products — липсва composite index за препоръчаното сортиране в каталога
-- ============================================================

alter table public.product_ratings enable row level security;

create policy product_ratings_public_read
  on public.product_ratings for select
  using (true);

create policy product_ratings_public_insert
  on public.product_ratings for insert
  with check (true);

create policy product_ratings_admin_all
  on public.product_ratings for all
  using (public.is_active_admin())
  with check (public.is_active_admin());

create index if not exists idx_products_active_type_id
  on public.products (is_active, type_id)
  where is_active = true;

create index if not exists idx_products_recommended_sort
  on public.products (is_active, reviews_count desc, rating desc, is_featured desc)
  where is_active = true;


-- ============================================================
-- 0029_admin_web_push.sql
-- ============================================================

create table if not exists public.admin_web_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users (id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (endpoint)
);

create index if not exists idx_admin_push_subs_user on public.admin_web_push_subscriptions (admin_user_id);

alter table public.admin_web_push_subscriptions enable row level security;

drop policy if exists admin_web_push_subscriptions_service on public.admin_web_push_subscriptions;
create policy admin_web_push_subscriptions_service on public.admin_web_push_subscriptions
  for all using (false) with check (false);

comment on table public.admin_web_push_subscriptions is 'Web Push абонаменти за известия към админ PWA; записи само през Next API със service role.';


-- ────────────────────────────────────────────────────────────
-- 0034 · product_specs — тегло и размери на вътрешен/външен блок
-- ────────────────────────────────────────────────────────────

alter table public.product_specs
  add column if not exists weight_indoor_kg     numeric(7,2),
  add column if not exists weight_outdoor_kg    numeric(7,2),
  add column if not exists dim_indoor_length_mm  int,
  add column if not exists dim_indoor_width_mm   int,
  add column if not exists dim_indoor_height_mm  int,
  add column if not exists dim_outdoor_length_mm int,
  add column if not exists dim_outdoor_width_mm  int,
  add column if not exists dim_outdoor_height_mm int;

alter table public.product_specs
  drop constraint if exists chk_specs_nonneg;

alter table public.product_specs
  add constraint chk_specs_nonneg check (
    (coverage_m2 is null or coverage_m2 >= 0) and
    (noise_db is null or noise_db >= 0) and
    (cooling_power_kw is null or cooling_power_kw >= 0) and
    (heating_power_kw is null or heating_power_kw >= 0) and
    (seer is null or seer >= 0) and
    (scop is null or scop >= 0) and
    (warranty_months is null or warranty_months >= 0) and
    (weight_indoor_kg is null or weight_indoor_kg >= 0) and
    (weight_outdoor_kg is null or weight_outdoor_kg >= 0) and
    (dim_indoor_length_mm is null or dim_indoor_length_mm >= 0) and
    (dim_indoor_width_mm is null or dim_indoor_width_mm >= 0) and
    (dim_indoor_height_mm is null or dim_indoor_height_mm >= 0) and
    (dim_outdoor_length_mm is null or dim_outdoor_length_mm >= 0) and
    (dim_outdoor_width_mm is null or dim_outdoor_width_mm >= 0) and
    (dim_outdoor_height_mm is null or dim_outdoor_height_mm >= 0)
  );


-- ============================================================
-- 0035_featured_top_products.sql
-- „Топ продукти“ за главната страница: до 6 позиции (3 горе, 3 долу),
-- всяка може да има визуален „badge“. featured_position (1..6) определя
-- позицията в 3×2 грида, featured_badge е от затворен списък.
-- ============================================================

alter table public.products
  add column if not exists featured_position smallint,
  add column if not exists featured_badge    text;

create unique index if not exists uq_products_featured_position
  on public.products (featured_position)
  where featured_position is not null;

create index if not exists idx_products_featured_position_active
  on public.products (featured_position)
  where featured_position is not null and is_active = true;

alter table public.products
  drop constraint if exists chk_products_featured_position;
alter table public.products
  add constraint chk_products_featured_position check (
    featured_position is null
    or (featured_position >= 1 and featured_position <= 6)
  );

alter table public.products
  drop constraint if exists chk_products_featured_badge;
alter table public.products
  add constraint chk_products_featured_badge check (
    featured_badge is null
    or featured_badge in (
      'bestseller', 'top_offer', 'promo',
      'top_searched', 'premium', 'best_value'
    )
  );

update public.products
set is_featured = true
where featured_position is not null and is_featured is distinct from true;


-- ============================================================
-- 0036_service_protocols_status_workflow.sql
-- ============================================================
-- Преработка на жизнения цикъл на приемно-предавателния протокол:
--   draft  → prepared    (офисът подготвя, чака сервизен екип)
--   sent   → signed      (изпратеният протокол вече е бил подписан)
--   in_progress          (нов — сервизният екип го попълва на място)

alter table public.service_protocols
  drop constraint if exists service_protocols_status_check;

update public.service_protocols
   set status = 'prepared'
 where status = 'draft';

update public.service_protocols
   set status = 'signed'
 where status = 'sent';

alter table public.service_protocols
  add constraint service_protocols_status_check
  check (status in ('prepared', 'in_progress', 'signed'));

alter table public.service_protocols
  alter column status set default 'prepared';


-- ============================================================
-- Край. След изпълнение:
-- 1. Authentication → Settings → enable Email/Password sign-in
-- 2. Създай admin потребител в Authentication → Users
-- 3. Добави реда в admin_users: INSERT INTO public.admin_users (id, email, name, role)
--    VALUES ('<uuid от Auth>', 'email', 'Ime', 'master_admin');
-- ============================================================
