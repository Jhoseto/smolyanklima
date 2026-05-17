-- inquiries.product_id: при изтриване на продукт запазваме запитването, махаме само връзката.
alter table public.inquiries
  drop constraint if exists inquiries_product_id_fkey;

alter table public.inquiries
  add constraint inquiries_product_id_fkey
  foreign key (product_id) references public.products(id) on delete set null;
