-- 0047_work_items_service_on_site_in_shop.sql
-- Разделяне на „сервиз на терен“ и „сервиз в склад“; стари repair/inspection → терен.

update public.work_items
set event_code = 'service_on_site'
where event_code in ('service_repair', 'service_inspection');

alter table public.work_items
  drop constraint if exists chk_work_items_event_code;

alter table public.work_items
  add constraint chk_work_items_event_code check (
    event_code is null or event_code in (
      'item_added',
      'item_removed',
      'sale',
      'service_installation',
      'service_maintenance',
      'service_on_site',
      'service_in_shop'
    )
  );

comment on column public.work_items.event_code is
  'Тип събитие: склад item_added/item_removed; sale от панел Продажби; service_installation монтаж; service_maintenance профилактика; service_on_site / service_in_shop сервиз.';
