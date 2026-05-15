-- 0050_work_items_consultation.sql
-- Консултация по телефон: отделно събитие в календара + контакти за обаждане.

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
      'service_in_shop',
      'consultation'
    )
  );

comment on column public.work_items.event_code is
  'Тип събитие: …; consultation = обаждане за консултация (CRM контакт, статус чака/завършено).';
