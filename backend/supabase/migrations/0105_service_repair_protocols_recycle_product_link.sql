-- 0105_service_repair_protocols_recycle_product_link.sql
-- Свързва сервизен протокол тип "рециклиране" (втора употреба) с конкретна
-- анонимна бройка от партидата в products (виж 0097_containers.sql +
-- партидното добавяне без серийни номера). При финализация — щом и двата
-- серийни номера (вътрешно + външно тяло) са попълнени в протокола — те
-- се пренасят автоматично върху свързаната бройка, превръщайки я в
-- конкретна, разпознаваема инстанция.
--
-- Виж 0096_service_repair_protocols_service_kind.sql (service_kind =
-- 'recycle' вече съществуваше, но без връзка към конкретен продукт).

alter table public.service_repair_protocols
  add column if not exists product_id uuid references public.products(id) on delete set null,
  add column if not exists indoor_unit_serial text,
  add column if not exists outdoor_unit_serial text;

create index if not exists idx_service_repair_protocols_product_id
  on public.service_repair_protocols (product_id)
  where product_id is not null;

comment on column public.service_repair_protocols.product_id is
  'Свързана анонимна бройка от партида втора употреба (products) — само за service_kind=recycle.';

comment on column public.service_repair_protocols.indoor_unit_serial is
  'Сериен номер на вътрешно тяло, зададен при рециклиране — пренася се към products при финализация.';

comment on column public.service_repair_protocols.outdoor_unit_serial is
  'Сериен номер на външно тяло, зададен при рециклиране — пренася се към products при финализация.';
