-- =====================================================================
-- Fix: BG телефони от +359 → 0... за исторически импорти
-- =====================================================================
-- Пусни в Supabase SQL Editor (Ctrl+A → Run), ако Book2023 / Klimatici
-- импортите са записали телефони като „+359 878 ...“ вместо „0878 ...“.
-- Безопасно за повторно пускане — обработва само +359 BG номера.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.fix_bg_phone_display(p text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d text;
BEGIN
  IF p IS NULL OR btrim(p) = '' THEN
    RETURN p;
  END IF;

  -- Чуждестранни номера (не BG) — без промяна
  IF p LIKE '+%' AND p NOT LIKE '+359%' THEN
    RETURN p;
  END IF;

  d := regexp_replace(p, '[^\d]', '', 'g');

  IF d LIKE '359%' AND length(d) = 12 THEN
    d := '0' || substring(d from 4);
  ELSIF length(d) = 10 AND d LIKE '0%' THEN
    NULL;
  ELSE
    RETURN p;
  END IF;

  IF length(d) = 10 AND d LIKE '0%' THEN
    RETURN substring(d, 1, 4) || ' ' || substring(d, 5, 3) || ' ' || substring(d, 8, 3);
  END IF;

  RETURN p;
END;
$$;

DO $fix$
DECLARE
  r RECORD;
  v_fixed text;
  v_existing uuid;
  v_merged int := 0;
  v_updated int := 0;
  v_sales int := 0;
  v_phones int := 0;
BEGIN
  -- 1) customer_phone на продажбите от импортите
  UPDATE public.work_items wi
  SET customer_phone = public.fix_bg_phone_display(wi.customer_phone)
  WHERE wi.event_code = 'sale'
    AND wi.customer_phone LIKE '+359%'
    AND (
      wi.notes LIKE 'Импорт Book2023, ред %'
      OR wi.notes LIKE 'Импорт Klimatici2023 VTORA, лист %'
      OR wi.notes LIKE 'Импорт Klimatici2022 VTORA, лист %'
    );

  GET DIAGNOSTICS v_sales = ROW_COUNT;

  -- 2) contacts.phone — merge към съществуващ контакт с 0..., ако има
  FOR r IN
    SELECT DISTINCT c.id AS contact_id, c.phone
    FROM public.contacts c
    JOIN public.work_items wi ON wi.contact_id = c.id AND wi.event_code = 'sale'
    WHERE c.contact_kind = 'client'
      AND c.phone LIKE '+359%'
      AND (
        wi.notes LIKE 'Импорт Book2023, ред %'
        OR wi.notes LIKE 'Импорт Klimatici2023 VTORA, лист %'
        OR wi.notes LIKE 'Импорт Klimatici2022 VTORA, лист %'
      )
  LOOP
    v_fixed := public.fix_bg_phone_display(r.phone);
    IF v_fixed = r.phone OR v_fixed IS NULL OR btrim(v_fixed) = '' THEN
      CONTINUE;
    END IF;

    SELECT id INTO v_existing
    FROM public.contacts
    WHERE contact_kind = 'client'
      AND phone = v_fixed
      AND id <> r.contact_id
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE public.work_items
      SET contact_id = v_existing
      WHERE contact_id = r.contact_id
        AND event_code = 'sale'
        AND (
          notes LIKE 'Импорт Book2023, ред %'
          OR notes LIKE 'Импорт Klimatici2023 VTORA, лист %'
          OR notes LIKE 'Импорт Klimatici2022 VTORA, лист %'
        );

      UPDATE public.contacts
      SET phone = NULL
      WHERE id = r.contact_id
        AND NOT EXISTS (
          SELECT 1 FROM public.work_items wi WHERE wi.contact_id = r.contact_id
        );

      v_merged := v_merged + 1;
    ELSE
      UPDATE public.contacts
      SET phone = v_fixed
      WHERE id = r.contact_id;

      v_updated := v_updated + 1;
    END IF;
  END LOOP;

  -- 3) contact_phones за засегнатите контакти
  UPDATE public.contact_phones cp
  SET phone = public.fix_bg_phone_display(cp.phone)
  WHERE cp.phone LIKE '+359%'
    AND EXISTS (
      SELECT 1 FROM public.contacts c
      WHERE c.id = cp.contact_id
        AND c.contact_kind = 'client'
    );

  GET DIAGNOSTICS v_phones = ROW_COUNT;

  RAISE NOTICE 'fix_import_phones: sales=%, contacts_updated=%, contacts_merged=%, contact_phones=%',
    v_sales, v_updated, v_merged, v_phones;
END
$fix$;
