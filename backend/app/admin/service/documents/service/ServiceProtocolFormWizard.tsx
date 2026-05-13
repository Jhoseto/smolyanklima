"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Download,
  PenLine, Trash2, X, Loader2, CheckCircle2, Star,
} from "lucide-react";
import { SignatureCanvas } from "../acceptance/SignatureCanvas";
import { ProductAutocomplete } from "../acceptance/ProductAutocomplete";
import {
  FREON_CHARGE_OPTIONS, BEARINGS_OPTIONS, NOISE_OPTIONS,
  SERVICE_RATING_OPTIONS, isJapaneseBrand,
  type FreonChargeMethod, type BearingsState, type NoiseLevel,
} from "@/lib/repair-protocol-fields";

// ─── Типове ──────────────────────────────────────────────────────────────────

interface FormData {
  date:             string;
  work_item_id:     string | null;
  ac_brand:         string;
  ac_model:         string;

  is_japanese_brand:   boolean | null;
  freon_charge_method: FreonChargeMethod | null;

  vacuum_cleaning_done:   boolean | null;
  valves_ok:              boolean | null;
  outdoor_bearings_state: BearingsState | null;
  indoor_bearings_state:  BearingsState | null;

  pressure_cold_bar:   string;
  pressure_hot_bar:    string;
  consumption_cold_kw: string;
  consumption_hot_kw:  string;

  original_remote:     boolean | null;
  outdoor_noise_level: NoiseLevel | null;

  welds_indoor_heat_exchanger:  boolean | null;
  welds_outdoor_heat_exchanger: boolean | null;
  welds_pipes:                  boolean | null;
  indoor_mechanism_repaired:    boolean | null;
  broken_turbine:               boolean | null;

  service_rating: number | null;

  notes:            string;
  signature_team:   string | null;
  /** Виж миграция 0041: prepared | in_progress | signed */
  status:           "prepared" | "in_progress" | "signed";
}

const defaultForm = (): FormData => ({
  date:             new Date().toISOString().slice(0, 10),
  work_item_id:     null,
  ac_brand:         "",
  ac_model:         "",

  is_japanese_brand:   null,
  freon_charge_method: null,

  vacuum_cleaning_done:   null,
  valves_ok:              null,
  outdoor_bearings_state: null,
  indoor_bearings_state:  null,

  pressure_cold_bar:   "",
  pressure_hot_bar:    "",
  consumption_cold_kw: "",
  consumption_hot_kw:  "",

  original_remote:     null,
  outdoor_noise_level: null,

  welds_indoor_heat_exchanger:  null,
  welds_outdoor_heat_exchanger: null,
  welds_pipes:                  null,
  indoor_mechanism_repaired:    null,
  broken_turbine:               null,

  service_rating: null,

  notes:            "",
  signature_team:   null,
  status:           "prepared",
});

interface Props {
  protocolId?: string;
  initialData?: Partial<FormData>;
  onClose: () => void;
  onSaved: (id: string) => void;
}

const STEPS = [
  "Марка, модел и дата",
  "Фреон & почистване",
  "Клапи, лагери & дистанционно",
  "Налягания & консумация",
  "Шум & заварки",
  "Ремонти & оценка",
  "Забележки & подпис",
] as const;

// ─── Главен компонент ────────────────────────────────────────────────────────

export function ServiceProtocolFormWizard({ protocolId, initialData, onClose, onSaved }: Props) {
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState<FormData>({ ...defaultForm(), ...initialData });
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(protocolId ?? null);
  const [sigOpen, setSigOpen] = useState(false);
  const [error, setError]    = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Зареждане на initial data при отваряне на съществуващ протокол ─────────
  useEffect(() => {
    if (!protocolId || initialData) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/service/repair-protocols/${protocolId}`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const { data } = await res.json();
        if (cancelled || !data) return;
        applyServerData(data);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocolId]);

  const applyServerData = useCallback((data: Record<string, unknown>) => {
    setForm(prev => ({
      ...prev,
      date:             (data.date as string) ?? prev.date,
      work_item_id:     (data.work_item_id as string | null) ?? null,
      ac_brand:         (data.ac_brand as string) ?? "",
      ac_model:         (data.ac_model as string) ?? "",

      is_japanese_brand:   (data.is_japanese_brand as boolean | null) ?? null,
      freon_charge_method: (data.freon_charge_method as FreonChargeMethod | null) ?? null,

      vacuum_cleaning_done:   (data.vacuum_cleaning_done as boolean | null) ?? null,
      valves_ok:              (data.valves_ok as boolean | null) ?? null,
      outdoor_bearings_state: (data.outdoor_bearings_state as BearingsState | null) ?? null,
      indoor_bearings_state:  (data.indoor_bearings_state as BearingsState | null) ?? null,

      pressure_cold_bar:   data.pressure_cold_bar != null ? String(data.pressure_cold_bar) : "",
      pressure_hot_bar:    data.pressure_hot_bar != null ? String(data.pressure_hot_bar) : "",
      consumption_cold_kw: data.consumption_cold_kw != null ? String(data.consumption_cold_kw) : "",
      consumption_hot_kw:  data.consumption_hot_kw != null ? String(data.consumption_hot_kw) : "",

      original_remote:     (data.original_remote as boolean | null) ?? null,
      outdoor_noise_level: (data.outdoor_noise_level as NoiseLevel | null) ?? null,

      welds_indoor_heat_exchanger:  (data.welds_indoor_heat_exchanger as boolean | null) ?? null,
      welds_outdoor_heat_exchanger: (data.welds_outdoor_heat_exchanger as boolean | null) ?? null,
      welds_pipes:                  (data.welds_pipes as boolean | null) ?? null,
      indoor_mechanism_repaired:    (data.indoor_mechanism_repaired as boolean | null) ?? null,
      broken_turbine:               (data.broken_turbine as boolean | null) ?? null,

      service_rating: (data.service_rating as number | null) ?? null,

      notes:            (data.notes as string) ?? "",
      signature_team:   (data.signature_team as string | null) ?? null,
      status:           (data.status as FormData["status"]) ?? prev.status,
    }));
  }, []);

  // Auto-detect: ако моделът съдържа японска марка и потребителят не е дал
  // изричен отговор на is_japanese_brand → отбелязваме автоматично.
  useEffect(() => {
    if (form.is_japanese_brand !== null) return;
    const brandModelHint = `${form.ac_brand} ${form.ac_model}`.trim();
    if (isJapaneseBrand(brandModelHint)) {
      setForm(prev => ({ ...prev, is_japanese_brand: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ac_brand, form.ac_model]);

  // In-flight lock: предотвратява двойно повикване на persistForm.
  const persistRef = useRef<Promise<unknown> | null>(null);

  useEffect(() => () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
  }, []);

  /**
   * Auto-save: ако формулярът има някакво съдържание (клиент или техническа
   * информация), запазва се след 2с. Празните протоколи НЕ се запазват.
   */
  const autoSave = useCallback(async (data: FormData, id: string | null) => {
    const hasContent =
      data.ac_brand || data.ac_model ||
      data.is_japanese_brand !== null || data.freon_charge_method !== null ||
      data.vacuum_cleaning_done !== null || data.valves_ok !== null ||
      data.outdoor_bearings_state !== null || data.indoor_bearings_state !== null ||
      data.pressure_cold_bar || data.pressure_hot_bar ||
      data.consumption_cold_kw || data.consumption_hot_kw ||
      data.original_remote !== null || data.outdoor_noise_level !== null ||
      data.welds_indoor_heat_exchanger !== null ||
      data.welds_outdoor_heat_exchanger !== null || data.welds_pipes !== null ||
      data.indoor_mechanism_repaired !== null || data.broken_turbine !== null ||
      data.service_rating !== null || data.notes ||
      data.signature_team;
    if (!hasContent && !id) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(async () => {
      await persistForm(data, id, false);
    }, 2000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm(prev => {
      const next = { ...prev, [key]: val };
      autoSave(next, savedId);
      return next;
    });
  }, [savedId, autoSave]);

  // ── Запазване в API ─────────────────────────────────────────────────────

  const persistForm = async (data: FormData, id: string | null, showSaving = true): Promise<string | null> => {
    if (persistRef.current) {
      try { await persistRef.current; } catch { /* ignore */ }
    }
    const job = persistFormInner(data, id, showSaving);
    persistRef.current = job;
    try {
      return await job;
    } finally {
      if (persistRef.current === job) persistRef.current = null;
    }
  };

  const persistFormInner = async (data: FormData, id: string | null, showSaving = true): Promise<string | null> => {
    if (showSaving) setSaving(true);
    setError(null);
    try {
      // Не изпращаме status — backend-ът сам управлява workflow-а.
      const numOrNull = (s: string) => {
        if (!s) return null;
        const n = Number(s.replace(",", "."));
        return Number.isFinite(n) ? n : null;
      };

      const payload = {
        work_item_id:     data.work_item_id,
        date:             data.date || new Date().toISOString().slice(0, 10),
        // Сервизният протокол не събира клиентски данни — винаги нулираме колоните в БД.
        client_name:      null,
        ac_brand:         data.ac_brand || null,
        ac_model:         data.ac_model || null,
        serial_number:    null,
        address:          null,
        paid_amount:      null,
        client_email:     null,
        client_phone:     null,

        is_japanese_brand:   data.is_japanese_brand,
        freon_charge_method: data.freon_charge_method,

        vacuum_cleaning_done:   data.vacuum_cleaning_done,
        valves_ok:              data.valves_ok,
        outdoor_bearings_state: data.outdoor_bearings_state,
        indoor_bearings_state:  data.indoor_bearings_state,

        pressure_cold_bar:   numOrNull(data.pressure_cold_bar),
        pressure_hot_bar:    numOrNull(data.pressure_hot_bar),
        consumption_cold_kw: numOrNull(data.consumption_cold_kw),
        consumption_hot_kw:  numOrNull(data.consumption_hot_kw),

        original_remote:     data.original_remote,
        outdoor_noise_level: data.outdoor_noise_level,

        welds_indoor_heat_exchanger:  data.welds_indoor_heat_exchanger,
        welds_outdoor_heat_exchanger: data.welds_outdoor_heat_exchanger,
        welds_pipes:                  data.welds_pipes,
        indoor_mechanism_repaired:    data.indoor_mechanism_repaired,
        broken_turbine:               data.broken_turbine,

        service_rating: data.service_rating,

        notes:          data.notes || null,
        signature_team: data.signature_team,
      };

      if (id) {
        const res = await fetch(`/api/admin/service/repair-protocols/${id}`, {
          method:  "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({})) as { error?: string; data?: { status?: FormData["status"] } };
        if (!res.ok) throw new Error(json.error ?? `Грешка при запазване (${res.status})`);
        if (json.data?.status && json.data.status !== data.status) {
          setForm(prev => ({ ...prev, status: json.data!.status! }));
        }
      } else {
        const res = await fetch("/api/admin/service/repair-protocols", {
          method:  "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({})) as {
          error?: string;
          data?: { id?: string; status?: FormData["status"] };
        };
        if (!res.ok) throw new Error(json.error ?? `Грешка при създаване (${res.status})`);
        const newId = json.data?.id;
        if (!newId) throw new Error("Липсва id от сървъра");
        setSavedId(newId);
        if (json.data?.status) {
          setForm(prev => ({ ...prev, status: json.data!.status! }));
        }
        onSaved(newId);
        return newId;
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally {
      if (showSaving) setSaving(false);
    }
    return id;
  };

  const finalize = async () => {
    const id = await persistForm(form, savedId, true);
    if (id) setSavedId(id);
  };

  const downloadPdf = () => {
    if (!savedId) return;
    window.open(`/api/admin/service/repair-protocols/${savedId}/pdf`, "_blank");
  };

  const isLastStep = step === STEPS.length - 1;
  const isSigned   = form.status === "signed";

  // ─── Рендер ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col">
      {/* ── Хедър с прогрес ── */}
      <div className="bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onClose} className="text-slate-500 active:text-slate-800 p-1 -ml-1">
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <p className="text-xs text-slate-400">Стъпка {step + 1} от {STEPS.length}</p>
            <p className="text-sm font-bold text-slate-800">{STEPS[step]}</p>
          </div>
          {saving && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        </div>
        <div className="h-1 bg-slate-100">
          <div
            className="h-1 bg-brand-orange-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Съдържание ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-24 max-w-2xl mx-auto">
          {/* Стъпка 0 — само дата + марка + модел */}
          {step === 0 && (
            <div className="space-y-3">
              <Field label="Дата на сервиз">
                <input
                  type="date"
                  value={form.date}
                  onChange={e => update("date", e.target.value)}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400"
                />
              </Field>

              <Field label="Марка">
                <input
                  type="text"
                  value={form.ac_brand}
                  onChange={e => update("ac_brand", e.target.value)}
                  placeholder="напр. Daikin"
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400"
                />
              </Field>

              <Field label="Модел">
                <ProductAutocomplete
                  value={form.ac_model}
                  onChange={(model) => update("ac_model", model)}
                  placeholder="Търси в каталога или въведи ръчно"
                />
              </Field>
            </div>
          )}

          {/* Стъпка 1 — Фреон & почистване */}
          {step === 1 && (
            <div className="space-y-4">
              <YesNoField
                label="Японски климатик?"
                hint="Автоматично се отбелязва ако марката е сред японските."
                value={form.is_japanese_brand}
                onChange={v => update("is_japanese_brand", v)}
              />

              <EnumField<FreonChargeMethod>
                label="Фреон / зареждане"
                hint={form.is_japanese_brand
                  ? 'За японски модели зареждането „на кантар“ е препоръка от производителя.'
                  : 'Стандартно зареждане при повечето модели.'}
                value={form.freon_charge_method}
                options={FREON_CHARGE_OPTIONS}
                onChange={v => update("freon_charge_method", v)}
              />

              <YesNoField
                label="Прахосмукачка (почистване)"
                value={form.vacuum_cleaning_done}
                onChange={v => update("vacuum_cleaning_done", v)}
              />
            </div>
          )}

          {/* Стъпка 2 — Клапи, лагери & дистанционно */}
          {step === 2 && (
            <div className="space-y-4">
              <YesNoField
                label="Клапи в ред"
                hint='Изолационни и контролни клапи на тръбите.'
                value={form.valves_ok}
                onChange={v => update("valves_ok", v)}
              />
              <EnumField<BearingsState>
                label="Лагери на външно тяло"
                value={form.outdoor_bearings_state}
                options={BEARINGS_OPTIONS}
                onChange={v => update("outdoor_bearings_state", v)}
              />
              <EnumField<BearingsState>
                label="Лагери на вътрешно тяло"
                value={form.indoor_bearings_state}
                options={BEARINGS_OPTIONS}
                onChange={v => update("indoor_bearings_state", v)}
              />
              <YesNoField
                label="Оригинално дистанционно"
                value={form.original_remote}
                onChange={v => update("original_remote", v)}
              />
            </div>
          )}

          {/* Стъпка 3 — Налягания & консумация */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Налягания (bar)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Студен режим">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.pressure_cold_bar}
                      onChange={e => update("pressure_cold_bar", e.target.value)}
                      placeholder="bar"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400"
                    />
                  </Field>
                  <Field label="Топъл режим">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      inputMode="decimal"
                      value={form.pressure_hot_bar}
                      onChange={e => update("pressure_hot_bar", e.target.value)}
                      placeholder="bar"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400"
                    />
                  </Field>
                </div>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Консумация (kW)
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Студен режим">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      inputMode="decimal"
                      value={form.consumption_cold_kw}
                      onChange={e => update("consumption_cold_kw", e.target.value)}
                      placeholder="kW"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400"
                    />
                  </Field>
                  <Field label="Топъл режим">
                    <input
                      type="number"
                      step="0.001"
                      min="0"
                      inputMode="decimal"
                      value={form.consumption_hot_kw}
                      onChange={e => update("consumption_hot_kw", e.target.value)}
                      placeholder="kW"
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400"
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* Стъпка 4 — Шум & заварки */}
          {step === 4 && (
            <div className="space-y-4">
              <EnumField<NoiseLevel>
                label="Ниво на шум на външното тяло"
                value={form.outdoor_noise_level}
                options={NOISE_OPTIONS}
                onChange={v => update("outdoor_noise_level", v)}
              />

              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Заварки (необходими/направени)
                </p>
                <div className="space-y-2">
                  <YesNoField
                    label="Топлообменник на вътрешно тяло"
                    value={form.welds_indoor_heat_exchanger}
                    onChange={v => update("welds_indoor_heat_exchanger", v)}
                  />
                  <YesNoField
                    label="Топлообменник на външно тяло"
                    value={form.welds_outdoor_heat_exchanger}
                    onChange={v => update("welds_outdoor_heat_exchanger", v)}
                  />
                  <YesNoField
                    label="Тръби"
                    value={form.welds_pipes}
                    onChange={v => update("welds_pipes", v)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Стъпка 5 — Ремонти & оценка */}
          {step === 5 && (
            <div className="space-y-4">
              <YesNoField
                label="Ремонт на механиката на вътрешното тяло"
                value={form.indoor_mechanism_repaired}
                onChange={v => update("indoor_mechanism_repaired", v)}
              />
              <YesNoField
                label="Счупена турбина"
                value={form.broken_turbine}
                onChange={v => update("broken_turbine", v)}
              />

              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Сервизна оценка за работата на климатика
                </p>
                <StarRatingField
                  value={form.service_rating}
                  onChange={v => update("service_rating", v)}
                />
              </div>
            </div>
          )}

          {/* Стъпка 6 — Забележки & подпис */}
          {step === 6 && (
            <div className="space-y-4">
              <Field label="Забележки">
                <textarea
                  value={form.notes}
                  onChange={e => update("notes", e.target.value)}
                  rows={4}
                  placeholder="Допълнителни наблюдения, препоръки, направени интервенции..."
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400 resize-none"
                />
              </Field>

              <SignatureSlot
                label="Подпис на сервизен техник"
                signature={form.signature_team}
                onSign={() => setSigOpen(true)}
                onClear={() => update("signature_team", null)}
                disabled={isSigned && !!form.signature_team}
              />

              {sigOpen && (
                <SignatureCanvas
                  label="Подпис на сервизен техник"
                  onSave={dataUrl => {
                    update("signature_team", dataUrl);
                    setSigOpen(false);
                  }}
                  onClose={() => setSigOpen(false)}
                />
              )}

              {/* Финализиране */}
              {form.signature_team && form.status !== "signed" && (
                <button
                  onClick={finalize}
                  disabled={saving}
                  className="w-full py-3 bg-brand-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-blue-800 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Финализирай протокола
                </button>
              )}

              {/* PDF — само за подписан протокол (без имейл към клиент). */}
              {savedId && isSigned && (
                <div className="space-y-3 pt-2">
                  <button
                    onClick={downloadPdf}
                    className="w-full py-3 bg-slate-800 text-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-slate-900"
                  >
                    <Download className="w-5 h-5" />
                    Свали PDF
                  </button>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Навигация (фиксиран footer) ── */}
      <div className="bg-white border-t border-slate-200 shrink-0 px-4 py-3">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <button
            onClick={() => setStep(s => Math.max(0, s - 1))}
            disabled={step === 0}
            className="flex items-center gap-1 px-4 py-2.5 text-slate-700 rounded-xl font-semibold text-sm disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
            Назад
          </button>
          <button
            onClick={() => isLastStep ? onClose() : setStep(s => s + 1)}
            className="flex-1 flex items-center justify-center gap-1 px-4 py-2.5 bg-brand-blue-700 text-white rounded-xl font-semibold text-sm hover:bg-brand-blue-800 active:bg-brand-blue-900"
          >
            {isLastStep ? "Затвори" : "Напред"}
            {!isLastStep && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Помощни sub-components ──────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1.5">{label}</span>
      {children}
    </label>
  );
}

/**
 * Три-стейт boolean поле: NULL (не проверено) / true (Да) / false (Не).
 * Показва три бутона; активният има по-наситен цвят. „—“ нулира избора.
 */
function YesNoField({
  label, hint, value, onChange,
}: {
  label: string;
  hint?: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
        </div>
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[10px] uppercase tracking-wider font-bold text-slate-400 hover:text-slate-600 shrink-0"
            title="Изчисти отговора"
          >
            Изчисти
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            value === true
              ? "bg-brand-blue-700 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Да
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            value === false
              ? "bg-rose-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Не
        </button>
      </div>
    </div>
  );
}

/**
 * Поле с фиксиран списък от опции. NULL → нищо избрано.
 * Показваме чипове в grid за лесен touch избор.
 */
function EnumField<T extends string>({
  label, hint, value, options, onChange,
}: {
  label: string;
  hint?: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
        </div>
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-[10px] uppercase tracking-wider font-bold text-slate-400 hover:text-slate-600 shrink-0"
            title="Изчисти отговора"
          >
            Изчисти
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`py-2 px-3 rounded-lg text-sm font-medium text-left transition-colors ${
              value === opt.value
                ? "bg-brand-blue-700 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StarRatingField({
  value, onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4, 5].map(n => {
          const active = value !== null && n <= value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onChange(value === n ? null : n)}
              className="p-1.5 transition-transform active:scale-90"
              title={SERVICE_RATING_OPTIONS.find(o => o.value === n)?.label}
            >
              <Star
                className={`w-9 h-9 transition-colors ${
                  active
                    ? "fill-brand-orange-500 text-brand-orange-500"
                    : "text-slate-300"
                }`}
              />
            </button>
          );
        })}
      </div>
      {value !== null && (
        <p className="text-center text-sm font-semibold text-slate-700 mt-1.5">
          {SERVICE_RATING_OPTIONS.find(o => o.value === value)?.label}
        </p>
      )}
    </div>
  );
}

function SignatureSlot({
  label, signature, onSign, onClear, disabled,
}: {
  label: string;
  signature: string | null;
  onSign: () => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <p className="text-xs font-semibold text-slate-700 mb-2">{label}</p>
      {signature ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={signature} alt="Подпис" className="w-full h-24 object-contain bg-slate-50 rounded-lg" />
          {!disabled && (
            <button
              type="button"
              onClick={onClear}
              className="absolute top-1 right-1 p-1.5 bg-white/90 hover:bg-rose-50 text-rose-600 rounded-lg shadow-sm"
              title="Изтрий"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={onSign}
          disabled={disabled}
          className="w-full h-24 border-2 border-dashed border-slate-300 hover:border-brand-blue-400 hover:bg-brand-blue-50 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-brand-blue-800 transition-colors disabled:opacity-50"
        >
          <PenLine className="w-5 h-5" />
          <span className="text-xs font-semibold">Подпиши</span>
        </button>
      )}
    </div>
  );
}
