-- 0076_work_items_supplier_fields.sql
-- Доставчик и ф-ра доставка на продажба — отделни колони (не в notes).

alter table public.work_items
  add column if not exists supplier_name text,
  add column if not exists supplier_invoice_number text;

comment on column public.work_items.supplier_name is
  'Доставчик при продажба (име от Excel/продукт).';

comment on column public.work_items.supplier_invoice_number is
  'Номер на фактура от доставчик (ф-ра доставка).';

-- Исторически импорти: доставчик от notes
update public.work_items w
set supplier_name = nullif(btrim(substring(w.notes from '(?i)доставчик:\s*([^·]+)')), '')
where w.event_code = 'sale'
  and w.supplier_name is null
  and w.notes is not null
  and w.notes ~* 'доставчик:';

-- Ф-ра от notes или от продукта
update public.work_items w
set supplier_invoice_number = coalesce(
  nullif(btrim(substring(w.notes from '(?i)ф-ра доставка:\s*([^·]+)')), ''),
  p.supplier_invoice_number
)
from public.products p
where w.product_id = p.id
  and w.event_code = 'sale'
  and w.supplier_invoice_number is null;

update public.work_items w
set supplier_invoice_number = p.supplier_invoice_number
from public.products p
where w.product_id = p.id
  and w.event_code = 'sale'
  and w.supplier_invoice_number is null
  and p.supplier_invoice_number is not null
  and btrim(p.supplier_invoice_number) <> '';

do $idx$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    execute $sql$
      create index if not exists idx_work_items_supplier_invoice_trgm
        on public.work_items using gin (supplier_invoice_number gin_trgm_ops)
        where event_code = 'sale' and supplier_invoice_number is not null
    $sql$;
  end if;
end
$idx$;
