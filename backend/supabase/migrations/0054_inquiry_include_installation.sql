-- Предпочитание за монтаж при продуктово запитване (true = с монтаж, false = само уред).
alter table public.inquiries
  add column if not exists include_installation boolean;

comment on column public.inquiries.include_installation is
  'Клиентът иска оферта с монтаж (true) или само уред (false). NULL = не е посочено.';
