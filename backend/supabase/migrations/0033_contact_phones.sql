-- 0033_contact_phones.sql
-- Множество телефони за контакт (клиент или доставчик).
--
-- Концепция:
--   * `contacts.phone` остава задължителен — съдържа ОСНОВНИЯ телефон,
--     показва се в списъка „Контакти“ и се ползва от older код (work_items,
--     inquiries, sales). Не го пипаме, за да не чупим съществуващи интеграции.
--   * `contact_phones` пази ВСИЧКИ телефони (включително основния), всеки със
--     свой етикет (напр. „Офис“, „Сервиз“, „Варна“, „Мобилен“). Това позволява
--     един доставчик да има няколко номера за различни клонове / отдели.

create table if not exists public.contact_phones (
  id           uuid primary key default gen_random_uuid(),
  contact_id   uuid not null references public.contacts (id) on delete cascade,
  phone        text not null,
  label        text,
  is_primary   boolean not null default false,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.contact_phones
  drop constraint if exists chk_contact_phones_phone_nonempty;

alter table public.contact_phones
  add constraint chk_contact_phones_phone_nonempty
  check (length(btrim(phone)) >= 3);

create index if not exists idx_contact_phones_contact_id
  on public.contact_phones (contact_id, sort_order);

-- Само един „основен“ телефон на контакт.
create unique index if not exists uq_contact_phones_one_primary
  on public.contact_phones (contact_id)
  where is_primary;

-- Автоматично актуализиране на updated_at при UPDATE.
create or replace function public.touch_contact_phones_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_contact_phones_updated_at on public.contact_phones;
create trigger trg_contact_phones_updated_at
  before update on public.contact_phones
  for each row execute function public.touch_contact_phones_updated_at();

-- RLS — наследяваме политиката от contacts (само admin-те ползват таблицата).
alter table public.contact_phones enable row level security;

drop policy if exists contact_phones_admin_all on public.contact_phones;
create policy contact_phones_admin_all on public.contact_phones
  for all
  using (public.is_active_admin())
  with check (public.is_active_admin());
