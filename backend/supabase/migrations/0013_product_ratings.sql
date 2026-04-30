-- 0013_product_ratings.sql
-- Real customer ratings with one vote per client token per product.

create table if not exists public.product_ratings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  rater_key text not null,
  ip_hash text,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (product_id, rater_key)
);

create index if not exists idx_product_ratings_product_created
  on public.product_ratings (product_id, created_at desc);

create or replace function public.refresh_product_rating(p_product_id uuid)
returns void
language plpgsql
as $$
declare
  v_reviews int;
  v_rating numeric(2,1);
begin
  select
    count(*)::int,
    coalesce(round(avg(stars)::numeric, 1), 0)
  into v_reviews, v_rating
  from public.product_ratings
  where product_id = p_product_id;

  update public.products
  set
    reviews_count = coalesce(v_reviews, 0),
    rating = coalesce(v_rating, 0)
  where id = p_product_id;
end;
$$;

create or replace function public.trg_refresh_product_rating()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_product_rating(old.product_id);
    return old;
  end if;

  perform public.refresh_product_rating(new.product_id);

  if tg_op = 'UPDATE' and old.product_id <> new.product_id then
    perform public.refresh_product_rating(old.product_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_product_ratings_refresh on public.product_ratings;
create trigger trg_product_ratings_refresh
after insert or update or delete on public.product_ratings
for each row execute function public.trg_refresh_product_rating();
