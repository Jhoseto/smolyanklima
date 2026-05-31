-- 0002_brands_minimal.sql
-- Seed на основните марки климатици. Изпълни се идемпотентно (on conflict
-- do nothing), затова е безопасно да се пуска повторно. Името „Mitsubishi
-- Heavy“ е отделна марка от „Mitsubishi Electric“ — те са две напълно
-- различни компании, които споделят само името на търговската марка
-- „Mitsubishi“.

insert into public.brands (slug, name, color, is_active)
values
  ('daikin',             'Daikin',                '#0033A0', true),
  ('mitsubishi-electric','Mitsubishi Electric',   '#E50012', true),
  ('mitsubishi-heavy',   'Mitsubishi Heavy',      '#B00020', true),
  ('samsung',            'Samsung',               '#1428A0', true),
  ('lg',                 'LG',                    '#A50034', true),
  ('fujitsu',            'Fujitsu',               '#FF0000', true),
  ('gree',               'Gree',                  '#00A84F', true),
  ('panasonic',          'Panasonic',             '#003087', true),
  ('hitachi',            'Hitachi',               '#CC0000', true),
  ('carrier',            'Carrier',               '#003087', true),
  ('toshiba',            'Toshiba',               '#FF0000', true),
  ('midea',              'Midea',                 '#007DC5', true),
  ('sharp',              'Sharp',                 '#E60012', true),
  ('nacional',           'Nacional',              '#0f766e', true),
  ('auratsu',            'Auratsu',               '#0077B6', true),
  ('aspen',              'Aspen',                 '#F97316', true),
  ('atlantic',           'Atlantic',              '#2563EB', true),
  ('williams',           'Williams',              '#64748B', true),
  ('olimpia-splendid',   'Olimpia Splendid',      '#0EA5E9', true),
  ('kaisai',             'Kaisai',                '#006B54', true),
  ('aux',                'AUX',                   '#E11D48', true),
  ('arielli',            'Arielli',               '#7C3AED', true),
  ('tcl',                'TCL',                   '#DC2626', true)
on conflict (slug) do update
  set is_active = excluded.is_active,
      color = coalesce(public.brands.color, excluded.color);
