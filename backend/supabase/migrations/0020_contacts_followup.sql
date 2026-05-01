-- 0020_contacts_followup.sql
-- Lightweight CRM follow-up fields for daily admin work.

alter table public.contacts
add column if not exists customer_status text not null default 'new';

alter table public.contacts
drop constraint if exists chk_contacts_customer_status;

alter table public.contacts
add constraint chk_contacts_customer_status check (
  customer_status in ('new', 'active', 'vip', 'lost')
);

alter table public.contacts
add column if not exists next_follow_up_at date;

alter table public.contacts
add column if not exists last_contacted_at date;

create index if not exists idx_contacts_next_follow_up_at on public.contacts (next_follow_up_at);
create index if not exists idx_contacts_customer_status on public.contacts (customer_status);
