-- Причина за отказ на продажба / монтаж (само за event_code=sale или свързан монтаж).

alter table public.work_items
  add column if not exists cancel_reason text;

alter table public.work_items
  drop constraint if exists work_items_cancel_reason_check;

alter table public.work_items
  add constraint work_items_cancel_reason_check
  check (
    cancel_reason is null
    or cancel_reason in ('client_declined', 'staff_error')
  );

comment on column public.work_items.cancel_reason is
  'При отказ: client_declined = клиентът се отказва; staff_error = лична грешка.';
