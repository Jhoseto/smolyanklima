-- 0107: разширени коментари за product_id и серийни полета при клиентски сервизи.

comment on column public.service_repair_protocols.product_id is
  'Опционална връзка към products — рециклиране или клиентски сервиз.';

comment on column public.service_repair_protocols.indoor_unit_serial is
  'Сериен № вътрешно тяло — рециклиране (финализация в products) или клиентски сервиз.';

comment on column public.service_repair_protocols.outdoor_unit_serial is
  'Сериен № външно тяло — рециклиране (финализация в products) или клиентски сервиз.';

comment on column public.service_repair_protocols.serial_number is
  'Legacy комбинирано поле (вътрешно / външно) — синхронизира се автоматично при запис; '
  'запазено за търсене и стари протоколи.';
