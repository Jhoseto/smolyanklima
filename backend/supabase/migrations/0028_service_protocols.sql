-- 0028_service_protocols.sql
-- Таблица за дигитални приемно-предавателни протоколи при монтаж на климатици.

CREATE TABLE IF NOT EXISTS public.service_protocols (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_number TEXT        UNIQUE NOT NULL,
  date            DATE        NOT NULL DEFAULT CURRENT_DATE,
  work_item_id    UUID        REFERENCES public.work_items(id) ON DELETE SET NULL,

  -- Клиентска информация
  client_name     TEXT,
  ac_model        TEXT,
  serial_number   TEXT,
  address         TEXT,
  paid_amount     NUMERIC(10,2),
  client_email    TEXT,
  client_phone    TEXT,

  -- Начин на монтаж (масив от стойности: вишка, скеле, тераса, ...)
  mount_types     TEXT[]  NOT NULL DEFAULT '{}',

  -- Материали: [{id, name, unit, qty}] — само попълнените редове
  materials       JSONB   NOT NULL DEFAULT '[]',

  -- Кабелни канали и аксесоари
  cable_channels_m  NUMERIC(8,2) DEFAULT 0,
  accessories       JSONB        NOT NULL DEFAULT '{}',

  -- Забележки
  notes           TEXT,

  -- Подписи (base64 PNG data URL)
  signature_team   TEXT,
  signature_client TEXT,

  -- Статус
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'signed', 'sent')),

  -- Метаданни
  created_by      UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индекси
CREATE INDEX IF NOT EXISTS idx_service_protocols_date
  ON public.service_protocols (date DESC);

CREATE INDEX IF NOT EXISTS idx_service_protocols_work_item
  ON public.service_protocols (work_item_id)
  WHERE work_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_protocols_created_by
  ON public.service_protocols (created_by)
  WHERE created_by IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_service_protocols_status
  ON public.service_protocols (status);

-- Автоматично обновяване на updated_at
CREATE OR REPLACE FUNCTION public.update_service_protocols_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_service_protocols_updated_at
  BEFORE UPDATE ON public.service_protocols
  FOR EACH ROW EXECUTE FUNCTION public.update_service_protocols_updated_at();

-- Секвенция за автоматичен номер на протокол (SK-2026001, SK-2026002, ...)
CREATE SEQUENCE IF NOT EXISTS public.service_protocol_seq START 1;

CREATE OR REPLACE FUNCTION public.next_protocol_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  seq_val BIGINT;
BEGIN
  seq_val := nextval('public.service_protocol_seq');
  RETURN 'SK-' || TO_CHAR(CURRENT_DATE, 'YYYY') || LPAD(seq_val::TEXT, 3, '0');
END;
$$;

-- RLS
ALTER TABLE public.service_protocols ENABLE ROW LEVEL SECURITY;

-- master_admin вижда и може да прави всичко
CREATE POLICY "master_admin_all_protocols"
  ON public.service_protocols
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

-- service_staff вижда само своите протоколи
CREATE POLICY "service_staff_own_protocols"
  ON public.service_protocols
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
