-- 0005_seed_minimal.sql
-- Optional minimal seed for UI facets and common features.

-- Categories (UI facets) — align with frontend/data/productService.ts CATEGORIES ids
insert into public.categories (slug, name, icon, accent_color, sort_order, is_active)
values
  ('all', 'Всички', 'LayoutGrid', '#6B7280', 0, true),
  ('wall', 'Стенни климатици', 'Home', '#FF4D00', 10, true),
  ('multi', 'Мулти-сплит системи', 'Layers', '#00B4D8', 20, true),
  ('cassette', 'Касетни климатици', 'Building2', '#7C3AED', 30, true),
  ('floor', 'Подови климатици', 'ArrowDown', '#0D9488', 40, true),
  ('office', 'Офис системи', 'Briefcase', '#2563EB', 50, true)
on conflict (slug) do nothing;

-- Common feature slugs (used in FilterSidebar)
insert into public.features (slug, name)
values
  ('wifi', 'WiFi управление'),
  ('inverter', 'Инвертор'),
  ('night_mode', 'Нощен режим'),
  ('self_cleaning', 'Самопочистване'),
  ('ionizer', 'Йонизатор'),
  ('nanoe', 'nanoe™'),
  ('turbo', 'Турбо режим')
on conflict (slug) do nothing;

-- Minimal settings placeholders
insert into public.settings (key, value, description)
values
  ('company_phone', '0888 58 58 16', 'Primary phone number'),
  ('company_email', 'office@smolyanklima.bg', 'Primary email'),
  ('company_address', 'ул. Наталия 19, Смолян', 'Office address'),
  ('working_hours', 'Пон-Пет: 09:00-18:00; Съб: 10:00-14:00', 'Working hours')
on conflict (key) do nothing;

