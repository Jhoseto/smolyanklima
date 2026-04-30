-- Internal CRM notes (not visible to customer).
alter table public.inquiries
  add column if not exists admin_notes text;

comment on column public.inquiries.admin_notes is 'Internal admin-only notes for CRM';
