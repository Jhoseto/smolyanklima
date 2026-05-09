-- 0025_performance_and_security.sql
-- Критични липсващи оптимизации откити при одит на API заявките:
-- 1. RLS на contacts и work_items (липсва — всеки authenticated може да чете)
-- 2. Trigram индекси за ILIKE търсения (без тях = full-table scan при всяко търсене)
-- 3. Съставни индекси за честите multi-column query patterns
-- 4. Covering индекси за hot query пътища
-- ────────────────────────────────────────────────────────────────────────────


-- ══════════════════════════════════════════════════════════════════════════════
-- 1. RLS — contacts (липсваше напълно — сигурностен пропуск)
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.contacts enable row level security;

drop policy if exists contacts_admin_all on public.contacts;
create policy contacts_admin_all on public.contacts
  for all
  using  (public.is_active_admin())
  with check (public.is_active_admin());


-- ══════════════════════════════════════════════════════════════════════════════
-- 2. RLS — work_items (липсваше напълно)
-- ══════════════════════════════════════════════════════════════════════════════

alter table public.work_items enable row level security;

drop policy if exists work_items_admin_all on public.work_items;
create policy work_items_admin_all on public.work_items
  for all
  using  (public.is_active_admin())
  with check (public.is_active_admin());


-- ══════════════════════════════════════════════════════════════════════════════
-- 3. Trigram (ILIKE) индекси — contacts
--    API: full_name.ilike, phone.ilike, email.ilike, address.ilike
-- ══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_contacts_name_trgm
  on public.contacts using gin (full_name gin_trgm_ops);

create index if not exists idx_contacts_phone_trgm
  on public.contacts using gin (phone gin_trgm_ops);

create index if not exists idx_contacts_email_trgm
  on public.contacts using gin (email gin_trgm_ops);

create index if not exists idx_contacts_address_trgm
  on public.contacts using gin (address gin_trgm_ops);

-- Default sort: updated_at DESC
create index if not exists idx_contacts_updated_at_desc
  on public.contacts (updated_at desc);


-- ══════════════════════════════════════════════════════════════════════════════
-- 4. Trigram (ILIKE) индекси — inquiries
--    API: customer_name.ilike, customer_phone.ilike, customer_email.ilike, message.ilike
-- ══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_inquiries_customer_name_trgm
  on public.inquiries using gin (customer_name gin_trgm_ops);

create index if not exists idx_inquiries_customer_phone_trgm
  on public.inquiries using gin (customer_phone gin_trgm_ops);

create index if not exists idx_inquiries_customer_email_trgm
  on public.inquiries using gin (customer_email gin_trgm_ops);

-- message е дълъг текст — тригрем е скъп; FTS е по-ефективен
create index if not exists idx_inquiries_message_fts
  on public.inquiries
  using gin (to_tsvector('simple', coalesce(message, '')));

-- Филтър по source (contact|product|wizard|quick_view|ai)
create index if not exists idx_inquiries_source
  on public.inquiries (source);


-- ══════════════════════════════════════════════════════════════════════════════
-- 5. Trigram (ILIKE) индекси — work_items
--    API: title.ilike, customer_name.ilike, customer_phone.ilike, customer_address.ilike
-- ══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_work_items_title_trgm
  on public.work_items using gin (title gin_trgm_ops);

create index if not exists idx_work_items_customer_name_trgm
  on public.work_items using gin (customer_name gin_trgm_ops);

create index if not exists idx_work_items_customer_phone_trgm
  on public.work_items using gin (customer_phone gin_trgm_ops);

create index if not exists idx_work_items_customer_address_trgm
  on public.work_items using gin (customer_address gin_trgm_ops);


-- ══════════════════════════════════════════════════════════════════════════════
-- 6. Съставни индекси — work_items
--    WorkItemsPlanner: WHERE due_date BETWEEN x AND y (+ optional status filter)
-- ══════════════════════════════════════════════════════════════════════════════

-- Основна заявка на планера: due_date range + status
create index if not exists idx_work_items_due_date_status
  on public.work_items (due_date, status)
  where due_date is not null;

-- Service staff: assigned_to + active statuses
create index if not exists idx_work_items_assigned_status_due
  on public.work_items (assigned_to, status, due_date)
  where assigned_to is not null;

-- Default sort: due_date asc, created_at desc
create index if not exists idx_work_items_due_created
  on public.work_items (due_date asc nulls last, created_at desc);


-- ══════════════════════════════════════════════════════════════════════════════
-- 7. Live chats — last_message_at (sort ред в admin chat list)
-- ══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_live_chats_last_message_at
  on public.live_chats (last_message_at desc nulls last);

-- Съставен: status + last_message_at (честата заявка: WHERE status='waiting' ORDER BY last_message_at)
create index if not exists idx_live_chats_status_last_msg
  on public.live_chats (status, last_message_at desc nulls last);


-- ══════════════════════════════════════════════════════════════════════════════
-- 8. Products — допълнителни индекси за admin sort/filter
--    API сортира по: name, price, stock_quantity, sold_quantity, is_active, is_featured, created_at
-- ══════════════════════════════════════════════════════════════════════════════

-- Default sort (created_at) + is_active filter
create index if not exists idx_products_active_created_desc
  on public.products (is_active, created_at desc);

-- stock_status filter (in_stock / out_of_stock / on_order)
create index if not exists idx_products_active_stock_status
  on public.products (is_active, stock_status);

-- sold_quantity за sales stats
create index if not exists idx_products_sold_quantity_desc
  on public.products (sold_quantity desc)
  where is_active = true;

-- Slug ILIKE (admin search by slug)
create index if not exists idx_products_slug_trgm
  on public.products using gin (slug gin_trgm_ops);


-- ══════════════════════════════════════════════════════════════════════════════
-- 9. Accessories — ILIKE search (name, description)
-- ══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_accessories_name_trgm
  on public.accessories using gin (name gin_trgm_ops);

create index if not exists idx_accessories_description_trgm
  on public.accessories using gin (description gin_trgm_ops);


-- ══════════════════════════════════════════════════════════════════════════════
-- 10. Activity logs — action ILIKE (admin search)
-- ══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_activity_logs_action_trgm
  on public.activity_logs using gin (action gin_trgm_ops);


-- ══════════════════════════════════════════════════════════════════════════════
-- 11. Email outbox — covering index (drain scheduler: pending + send_after + kind)
-- ══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_email_outbox_pending_full
  on public.email_outbox (status, send_after asc, kind)
  where status in ('pending', 'failed');


-- ══════════════════════════════════════════════════════════════════════════════
-- 12. Product images — sort_order (за product detail зареждане)
-- ══════════════════════════════════════════════════════════════════════════════

create index if not exists idx_product_images_product_sort
  on public.product_images (product_id, sort_order asc);


-- ══════════════════════════════════════════════════════════════════════════════
-- 13. live_chat_messages — по-бърз streaming (admin + visitor SSE)
-- ══════════════════════════════════════════════════════════════════════════════

-- Вече съществува idx_live_chat_msgs_chat_id (chat_id, created_at)
-- Добавяме partial за само-admin заявките (admin чете по-нов от определена дата)
create index if not exists idx_live_chat_msgs_chat_created_asc
  on public.live_chat_messages (chat_id, created_at asc);
