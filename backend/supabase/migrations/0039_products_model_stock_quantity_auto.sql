-- =====================================================================
-- Migration 0039: автоматично количество по модел
-- ---------------------------------------------------------------------
-- Преди тази миграция: `products.stock_quantity` се редактираше ръчно
-- от админа. Това позволяваше несъответствие между физическите
-- инстанции (всеки продукт с уникален сериен номер) и показваното
-- количество в каталога.
--
-- След тази миграция: `stock_quantity` е DERIVED стойност. За всяка
-- комбинация (brand_id, lower(model_code)) се преброяват ВСИЧКИ
-- продукти със статус `in_stock`, и тази бройка се записва на всеки
-- запис със същия модел. Поддържа се чрез тригери при insert/update/
-- delete — single source of truth, без шанс за разсинхронизация.
--
-- Стратегия:
--   1. `recompute_model_stock_quantity(brand_id, model_code)` — функция,
--      която изчислява и записва count-а за дадения модел.
--   2. AFTER trigger на products, който се закача само при промяна на
--      „значимите“ полета (brand_id, model_code, stock_status). На
--      INSERT/DELETE — винаги. Recompute се вика и за OLD и за NEW
--      модел (когато model_code/brand_id се променя).
--   3. Backfill — изпълнен веднага след създаването на тригерите, за
--      коректни стойности на всички съществуващи записи.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Helper функция: recompute_model_stock_quantity
-- ---------------------------------------------------------------------
create or replace function public.recompute_model_stock_quantity(
  p_brand_id uuid,
  p_model_code text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_key text;
begin
  -- Без brand/model — нищо за recompute (не групираме „празните“).
  if p_brand_id is null then return 0; end if;
  v_key := lower(coalesce(p_model_code, ''));
  if v_key = '' then return 0; end if;

  -- COUNT само на „в наличност“ инстанции (out_of_stock и on_order
  -- не се броят като физическо налично количество в каталога).
  select count(*)::int
    into v_count
    from public.products
   where brand_id = p_brand_id
     and lower(coalesce(model_code, '')) = v_key
     and stock_status = 'in_stock';

  -- UPDATE-ваме ВСИЧКИ инстанции на модела (включително out_of_stock —
  -- те също трябва да виждат „общото количество на модела в каталога“).
  update public.products
     set stock_quantity = v_count
   where brand_id = p_brand_id
     and lower(coalesce(model_code, '')) = v_key
     and coalesce(stock_quantity, -1) <> v_count;  -- skip no-op writes

  return v_count;
end
$$;

comment on function public.recompute_model_stock_quantity(uuid, text) is
  'Преброява всички продукти със същия (brand_id, model_code) и status=in_stock; '
  'записва бройката като stock_quantity на ВСИЧКИ продукти от този модел.';

-- ---------------------------------------------------------------------
-- 2) Trigger функция
-- ---------------------------------------------------------------------
-- ВАЖНО: ползваме pg_trigger_depth() > 1 guard за защита от рекурсия,
-- защото UPDATE-ите вътре в recompute_model_stock_quantity ще
-- задействат отново тригера. Когато сме на дълбочина > 1, излизаме.
create or replace function public.products_recompute_stock_qty_trg()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Guard срещу рекурсия: ако сме вече вътре в recompute UPDATE — skip.
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;

  if (tg_op = 'DELETE') then
    perform public.recompute_model_stock_quantity(old.brand_id, old.model_code);
    return old;
  end if;

  if (tg_op = 'INSERT') then
    perform public.recompute_model_stock_quantity(new.brand_id, new.model_code);
    return new;
  end if;

  -- UPDATE: recompute за стария И за новия модел, ако (brand/model) са
  -- се променили. Иначе само за текущия.
  if (
    coalesce(old.brand_id::text, '') is distinct from coalesce(new.brand_id::text, '')
    or lower(coalesce(old.model_code, '')) is distinct from lower(coalesce(new.model_code, ''))
  ) then
    perform public.recompute_model_stock_quantity(old.brand_id, old.model_code);
    perform public.recompute_model_stock_quantity(new.brand_id, new.model_code);
  else
    perform public.recompute_model_stock_quantity(new.brand_id, new.model_code);
  end if;

  return new;
end
$$;

comment on function public.products_recompute_stock_qty_trg() is
  'Тригер хелпер: вика recompute_model_stock_quantity при insert/update/delete на продукти.';

-- ---------------------------------------------------------------------
-- 3) Triggers
-- ---------------------------------------------------------------------
-- INSERT: винаги преизчисляваме за новия модел.
drop trigger if exists trg_products_recompute_stock_qty_insert on public.products;
create trigger trg_products_recompute_stock_qty_insert
after insert on public.products
for each row
execute function public.products_recompute_stock_qty_trg();

-- UPDATE: само когато реално могат да повлияят на count-а.
drop trigger if exists trg_products_recompute_stock_qty_update on public.products;
create trigger trg_products_recompute_stock_qty_update
after update of brand_id, model_code, stock_status on public.products
for each row
when (
  coalesce(old.brand_id::text, '') is distinct from coalesce(new.brand_id::text, '')
  or lower(coalesce(old.model_code, '')) is distinct from lower(coalesce(new.model_code, ''))
  or coalesce(old.stock_status, '') is distinct from coalesce(new.stock_status, '')
)
execute function public.products_recompute_stock_qty_trg();

-- DELETE: винаги преизчисляваме за стария модел.
drop trigger if exists trg_products_recompute_stock_qty_delete on public.products;
create trigger trg_products_recompute_stock_qty_delete
after delete on public.products
for each row
execute function public.products_recompute_stock_qty_trg();

-- ---------------------------------------------------------------------
-- 4) Backfill — еднократно за всички съществуващи модели
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in (
    select distinct brand_id, model_code
      from public.products
     where brand_id is not null
       and model_code is not null
       and length(trim(model_code)) > 0
  ) loop
    perform public.recompute_model_stock_quantity(r.brand_id, r.model_code);
  end loop;
end
$$;
