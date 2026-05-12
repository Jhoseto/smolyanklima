-- 0041_service_repair_protocols.sql
-- Дигитален „сервизен протокол“ за профилактика / ремонт / диагностика
-- на климатици. Различен от приемно-предавателния протокол
-- (service_protocols), който се ползва при монтаж.
--
-- Жизнен цикъл (огледало на приемно-предавателния):
--   prepared    → офисът подготвя клиентски данни преди визита
--   in_progress → екип работи на място, попълва техническа част
--   signed      → подписан от двете страни (екип + клиент)
--
-- RLS:
--   master_admin   → пълен достъп
--   service_staff  → само техните протоколи (created_by = auth.uid())
--   office_staff   → достъп през API (read + create), не директно през Supabase

CREATE TABLE IF NOT EXISTS public.service_repair_protocols (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_number TEXT        UNIQUE NOT NULL,
  date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  work_item_id    UUID        REFERENCES public.work_items(id) ON DELETE SET NULL,

  -- ── Клиентска информация ────────────────────────────────────────────
  client_name     TEXT,
  ac_model        TEXT,
  serial_number   TEXT,
  address         TEXT,
  paid_amount     NUMERIC(10,2),
  client_email    TEXT,
  client_phone    TEXT,

  -- ── Японски климатици: специфики при фреона ─────────────────────────
  -- Японските модели (Daikin, Mitsubishi Electric, Mitsubishi Heavy,
  -- Fujitsu, Toshiba, Panasonic, Hitachi) често имат прецизна нужда от
  -- зареждане на кантар вместо стандартно.
  is_japanese_brand     BOOLEAN,
  freon_charge_method   TEXT CHECK (freon_charge_method IN (
    'none',      -- няма зареждане (системата е затворена/добра)
    'scale',     -- зареден на кантар (само за японски модели)
    'standard'   -- стандартно зареждане
  )),

  -- ── Почистване и механика ───────────────────────────────────────────
  vacuum_cleaning_done   BOOLEAN,  -- почистено с прахосмукачка
  valves_ok              BOOLEAN,  -- клапи да/не

  -- Лагери — състояние (ok / шумни / смазани / сменени)
  outdoor_bearings_state TEXT CHECK (outdoor_bearings_state IN (
    'ok', 'noisy', 'lubricated', 'replaced'
  )),
  indoor_bearings_state  TEXT CHECK (indoor_bearings_state IN (
    'ok', 'noisy', 'lubricated', 'replaced'
  )),

  -- ── Налягания (bar) ─────────────────────────────────────────────────
  pressure_cold_bar  NUMERIC(6,2),  -- налягане на студено
  pressure_hot_bar   NUMERIC(6,2),  -- налягане на топло

  -- ── Консумация (kW) ─────────────────────────────────────────────────
  consumption_cold_kw NUMERIC(6,3), -- консумация при студен режим
  consumption_hot_kw  NUMERIC(6,3), -- консумация при топъл режим

  -- ── Дистанционно ────────────────────────────────────────────────────
  original_remote     BOOLEAN,

  -- ── Шум на външно тяло (5 степени) ──────────────────────────────────
  outdoor_noise_level TEXT CHECK (outdoor_noise_level IN (
    'quiet', 'normal', 'elevated', 'loud', 'very_loud'
  )),

  -- ── Заварки (да/не) ─────────────────────────────────────────────────
  welds_indoor_heat_exchanger  BOOLEAN,  -- топлообменник вътрешно тяло
  welds_outdoor_heat_exchanger BOOLEAN,  -- топлообменник външно тяло
  welds_pipes                  BOOLEAN,  -- тръби

  -- ── Други ремонти ───────────────────────────────────────────────────
  indoor_mechanism_repaired BOOLEAN,  -- ремонт на механика на вътрешно тяло
  broken_turbine            BOOLEAN,  -- счупена турбина

  -- ── Сервизна оценка (1-5) ───────────────────────────────────────────
  -- 1 = много лошо състояние / 5 = отлично състояние
  service_rating INTEGER CHECK (service_rating BETWEEN 1 AND 5),

  -- ── Текстови полета ─────────────────────────────────────────────────
  notes           TEXT,

  -- ── Подписи (base64 PNG data URL) ───────────────────────────────────
  signature_team   TEXT,
  signature_client TEXT,

  -- ── Статус (същия като acceptance protocol-а за консистентност) ─────
  status TEXT NOT NULL DEFAULT 'prepared'
    CHECK (status IN ('prepared', 'in_progress', 'signed')),

  -- ── Метаданни ───────────────────────────────────────────────────────
  created_by      UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Индекси ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_service_repair_protocols_date
  ON public.service_repair_protocols (date DESC);

CREATE INDEX IF NOT EXISTS idx_service_repair_protocols_work_item
  ON public.service_repair_protocols (work_item_id)
  WHERE work_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_repair_protocols_created_by
  ON public.service_repair_protocols (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_repair_protocols_status
  ON public.service_repair_protocols (status);

-- ── Автоматично updated_at ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_service_repair_protocols_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_service_repair_protocols_updated_at
  ON public.service_repair_protocols;

CREATE TRIGGER trg_service_repair_protocols_updated_at
  BEFORE UPDATE ON public.service_repair_protocols
  FOR EACH ROW EXECUTE FUNCTION public.update_service_repair_protocols_updated_at();

-- ── Секвенция за номер на сервизен протокол (SR-2026001, SR-2026002…) ─
CREATE SEQUENCE IF NOT EXISTS public.service_repair_protocol_seq START 1;

CREATE OR REPLACE FUNCTION public.next_repair_protocol_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq_val BIGINT;
BEGIN
  seq_val := nextval('public.service_repair_protocol_seq');
  RETURN 'SR-' || TO_CHAR(CURRENT_DATE, 'YYYY') || LPAD(seq_val::TEXT, 3, '0');
END;
$$;

-- ── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.service_repair_protocols ENABLE ROW LEVEL SECURITY;

-- master_admin: пълен достъп
DROP POLICY IF EXISTS "master_admin_all_repair_protocols" ON public.service_repair_protocols;
CREATE POLICY "master_admin_all_repair_protocols"
  ON public.service_repair_protocols
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid() AND au.role = 'master_admin' AND au.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid() AND au.role = 'master_admin' AND au.is_active = true
    )
  );

-- service_staff: само своите
DROP POLICY IF EXISTS "service_staff_own_repair_protocols" ON public.service_repair_protocols;
CREATE POLICY "service_staff_own_repair_protocols"
  ON public.service_repair_protocols
  FOR ALL
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid() AND au.role = 'service_staff' AND au.is_active = true
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.admin_users au
      WHERE au.id = auth.uid() AND au.role = 'service_staff' AND au.is_active = true
    )
  );
