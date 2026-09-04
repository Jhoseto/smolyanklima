"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Download,
  PenLine, Trash2, X, Loader2, CheckCircle2, Star,
} from "lucide-react";
import { SignatureCanvas } from "../acceptance/SignatureCanvas";
import {
  ProductAutocomplete,
  splitProductSelection,
  type ProductSuggestion,
} from "../acceptance/ProductAutocomplete";
import { RecycleBatchPicker, type RecycleBatchGroup } from "./RecycleBatchPicker";
import { ContactAutocomplete, type ContactSuggestion } from "../acceptance/ContactAutocomplete";
import type { AdminRole } from "@/lib/admin/db";
import {
  FREON_CHARGE_OPTIONS, BEARINGS_OPTIONS, NOISE_OPTIONS,
  SERVICE_RATING_OPTIONS, SERVICE_KIND_OPTIONS, isJapaneseBrand,
  REFRIGERANT_TYPE_OPTIONS,
  type FreonChargeMethod, type BearingsState, type NoiseLevel,
  type RepairServiceKind,
} from "@/lib/repair-protocol-fields";

// ─── Типове ──────────────────────────────────────────────────────────────────

interface FormData {
  date:             string;
  work_item_id:     string | null;
  service_kind:     RepairServiceKind;

  client_name:      string;
  client_phone:     string;
  client_email:     string;
  address:          string;
  serial_number:    string;

  /** Само за service_kind='recycle' — виж 0105_*.sql. */
  product_id:          string | null;
  indoor_unit_serial:   string;
  outdoor_unit_serial:  string;

  ac_brand:         string;
  ac_model:         string;

  is_japanese_brand:   boolean | null;
  freon_charge_method: FreonChargeMethod | null;
  refrigerant_type:       string;
  refrigerant_amount_g:   string;

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
  service_kind:     "client",

  client_name:      "",
  client_phone:     "",
  client_email:     "",
  address:          "",
  serial_number:    "",

  product_id:           null,
  indoor_unit_serial:   "",
  outdoor_unit_serial:  "",

  ac_brand:         "",
  ac_model:         "",

  is_japanese_brand:   null,
  freon_charge_method: null,
  refrigerant_type:       "",
  refrigerant_amount_g:   "",

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
  role: AdminRole;
  onClose: () => void;
  onSaved: (id: string) => void;
}

const STEPS = [
  "Тип, климатик и дата",
  "Фреон & почистване",
  "Клапи, лагери & дистанционно",
  "Налягания & консумация",
  "Шум & заварки",
  "Ремонти & оценка",
  "Забележки & подпис",
] as const;

const inputCls =
  "w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400 disabled:opacity-60 disabled:cursor-not-allowed";

// ─── Главен компонент ────────────────────────────────────────────────────────

export function ServiceProtocolFormWizard({ protocolId, initialData, role, onClose, onSaved }: Props) {
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState<FormData>({ ...defaultForm(), ...initialData });
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(protocolId ?? null);
  const [sigOpen, setSigOpen] = useState(false);
  const [error, setError]    = useState<string | null>(null);
  const [linkWarning, setLinkWarning] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSignedRef = useRef(false);

  // master/office могат да коригират signed; service_staff — само преглед
  const canEditSigned = role === "master_admin" || role === "office_staff";
  const isSigned = form.status === "signed" && !canEditSigned;
  isSignedRef.current = isSigned;

  // ── Зареждане на initial data при отваряне на съществуващ протокол ─────────
  useEffect(() => {
    if (!protocolId || initialData) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/admin/service/repair-protocols/${protocolId}`, {
          credentials: "include",
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          if (!cancelled) {
            setLoadErr((json as { error?: string }).error ?? "Протоколът не може да бъде зареден");
          }
          return;
        }
        const { data } = await res.json();
        if (cancelled || !data) return;
        applyServerData(data);
      } catch {
        if (!cancelled) setLoadErr("Протоколът не може да бъде зареден");
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocolId]);

  const applyServerData = useCallback((data: Record<string, unknown>) => {
    setForm(prev => ({
      ...prev,
      date:             (data.date as string) ?? prev.date,
      work_item_id:     (data.work_item_id as string | null) ?? null,
      service_kind:     ((data.service_kind as RepairServiceKind) === "recycle" ? "recycle" : "client"),

      client_name:      (data.client_name as string) ?? "",
      client_phone:     (data.client_phone as string) ?? "",
      client_email:     (data.client_email as string) ?? "",
      address:          (data.address as string) ?? "",
      serial_number:    (data.serial_number as string) ?? "",

      product_id:           (data.product_id as string | null) ?? null,
      indoor_unit_serial:   (data.indoor_unit_serial as string) ?? "",
      outdoor_unit_serial:  (data.outdoor_unit_serial as string) ?? "",

      ac_brand:         (data.ac_brand as string) ?? "",
      ac_model:         (data.ac_model as string) ?? "",

      is_japanese_brand:   (data.is_japanese_brand as boolean | null) ?? null,
      freon_charge_method: (data.freon_charge_method as FreonChargeMethod | null) ?? null,
      refrigerant_type:     (data.refrigerant_type as string) ?? "",
      refrigerant_amount_g: data.refrigerant_amount_g != null ? String(data.refrigerant_amount_g) : "",

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

  // Auto-detect японска марка
  useEffect(() => {
    if (isSignedRef.current) return;
    if (form.is_japanese_brand !== null) return;
    const brandModelHint = `${form.ac_brand} ${form.ac_model}`.trim();
    if (isJapaneseBrand(brandModelHint)) {
      setForm(prev => ({ ...prev, is_japanese_brand: true }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.ac_brand, form.ac_model]);

  const persistRef = useRef<Promise<unknown> | null>(null);

  useEffect(() => () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
  }, []);

  const autoSave = useCallback(async (data: FormData, id: string | null) => {
    if (isSignedRef.current) return;

    const hasContent =
      data.client_name || data.client_phone || data.address || data.serial_number ||
      data.product_id || data.indoor_unit_serial || data.outdoor_unit_serial ||
      data.ac_brand || data.ac_model ||
      data.is_japanese_brand !== null || data.freon_charge_method !== null ||
      data.refrigerant_type || data.refrigerant_amount_g ||
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
      if (isSignedRef.current) return;
      await persistForm(data, id, false);
    }, 2000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    if (isSignedRef.current) return;
    setForm(prev => {
      const next = { ...prev, [key]: val };
      autoSave(next, savedId);
      return next;
    });
  }, [savedId, autoSave]);

  // ── Запазване в API ─────────────────────────────────────────────────────

  const persistForm = async (data: FormData, id: string | null, showSaving = true): Promise<string | null> => {
    if (isSignedRef.current) return id;
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
      const numOrNull = (s: string) => {
        if (!s) return null;
        const n = Number(s.replace(",", "."));
        return Number.isFinite(n) ? n : null;
      };

      const payload = {
        work_item_id:     data.work_item_id,
        date:             data.date || new Date().toISOString().slice(0, 10),
        service_kind:     data.service_kind,

        client_name:      data.service_kind === "recycle" ? null : (data.client_name.trim() || null),
        client_phone:     data.service_kind === "recycle" ? null : (data.client_phone.trim() || null),
        client_email:     data.service_kind === "recycle" ? null : (data.client_email.trim() || null),
        address:          data.service_kind === "recycle" ? null : (data.address.trim() || null),
        serial_number:    data.service_kind === "recycle" ? null : (data.serial_number.trim() || null),
        paid_amount:      null,

        product_id:           data.service_kind === "recycle" ? data.product_id : null,
        indoor_unit_serial:   data.service_kind === "recycle" ? (data.indoor_unit_serial.trim() || null) : null,
        outdoor_unit_serial:  data.service_kind === "recycle" ? (data.outdoor_unit_serial.trim() || null) : null,

        ac_brand:         data.ac_brand || null,
        ac_model:         data.ac_model || null,

        is_japanese_brand:   data.is_japanese_brand,
        freon_charge_method: data.freon_charge_method,
        refrigerant_type:     data.refrigerant_type.trim() || null,
        refrigerant_amount_g: numOrNull(data.refrigerant_amount_g),

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
        const json = await res.json().catch(() => ({})) as {
          error?: string;
          data?: { status?: FormData["status"] };
          productLinkWarning?: string;
        };
        if (!res.ok) throw new Error(json.error ?? `Грешка при запазване (${res.status})`);
        if (json.data?.status && json.data.status !== data.status) {
          setForm(prev => ({ ...prev, status: json.data!.status! }));
        }
        setLinkWarning(json.productLinkWarning ?? null);
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
          productLinkWarning?: string;
        };
        if (!res.ok) throw new Error(json.error ?? `Грешка при създаване (${res.status})`);
        const newId = json.data?.id;
        if (!newId) throw new Error("Липсва id от сървъра");
        setSavedId(newId);
        if (json.data?.status) {
          setForm(prev => ({ ...prev, status: json.data!.status! }));
        }
        setLinkWarning(json.productLinkWarning ?? null);
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
    if (isSigned) return;
    const id = await persistForm(form, savedId, true);
    if (id) setSavedId(id);
  };

  const downloadPdf = async () => {
    if (!savedId) return;
    try {
      const res = await fetch(`/api/admin/service/repair-protocols/${savedId}/pdf`, {
        credentials: "include",
      });
      if (!res.ok) {
        setError("Грешка при генериране на PDF");
        return;
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `servizen-protokol-${savedId}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch {
      setError("Неуспешно сваляне на PDF");
    }
  };

  const isLastStep = step === STEPS.length - 1;

  // ─── Рендер ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col">
      {/* ── Хедър с прогрес ── */}
      <div className="bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={onClose} className="text-slate-500 active:text-slate-800 p-1 -ml-1" title="Затвори">
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-400">Стъпка {step + 1} от {STEPS.length}</p>
            <p className="text-sm font-bold text-slate-800 truncate">{STEPS[step]}</p>
          </div>
          {isSigned && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-slate-100 text-slate-600 shrink-0">
              Само преглед
            </span>
          )}
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
          {loadErr && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-sm">
              {loadErr}
            </div>
          )}

          {isSigned && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Подписаният протокол е само за преглед. За корекции се свържете с офиса.
            </div>
          )}

          {/* Стъпка 0 — тип + дата + клиент/климатик */}
          {step === 0 && (
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-slate-700 mb-1.5">Тип сервиз</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SERVICE_KIND_OPTIONS.map((opt) => {
                    const active = form.service_kind === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        disabled={isSigned}
                        onClick={() => {
                          if (isSignedRef.current) return;
                          setForm((prev) => {
                            const next: FormData = {
                              ...prev,
                              service_kind: opt.value,
                              ...(opt.value === "recycle"
                                ? {
                                    client_name: "",
                                    client_phone: "",
                                    client_email: "",
                                    address: "",
                                    serial_number: "",
                                    is_japanese_brand:
                                      prev.is_japanese_brand === null ? true : prev.is_japanese_brand,
                                  }
                                : {
                                    product_id: null,
                                    indoor_unit_serial: "",
                                    outdoor_unit_serial: "",
                                  }),
                            };
                            autoSave(next, savedId);
                            return next;
                          });
                        }}
                        className={`text-left rounded-xl border px-3 py-3 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                          active
                            ? "border-brand-blue-600 bg-brand-blue-50 ring-2 ring-brand-blue-400"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <p className={`text-sm font-bold ${active ? "text-brand-blue-900" : "text-slate-800"}`}>
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{opt.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Field label="Дата на сервиз">
                <input
                  type="date"
                  value={form.date}
                  onChange={e => update("date", e.target.value)}
                  disabled={isSigned}
                  className={inputCls}
                />
              </Field>

              {form.service_kind === "client" && (
                <>
                  <ContactAutocomplete
                    label="Клиент (от указателя)"
                    value={form.client_name}
                    placeholder="Търси контакт или въведи име"
                    disabled={isSigned}
                    onChange={(name, contact?: ContactSuggestion) => {
                      if (isSignedRef.current) return;
                      setForm(prev => {
                        const next = {
                          ...prev,
                          client_name: name,
                          ...(contact ? {
                            client_phone: contact.phone ?? prev.client_phone,
                            client_email: contact.email ?? prev.client_email,
                            address:      contact.address ?? prev.address,
                          } : {}),
                        };
                        autoSave(next, savedId);
                        return next;
                      });
                    }}
                  />

                  <Field label="Телефон">
                    <input
                      type="tel"
                      value={form.client_phone}
                      onChange={e => update("client_phone", e.target.value)}
                      placeholder="08…"
                      disabled={isSigned}
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Адрес">
                    <input
                      type="text"
                      value={form.address}
                      onChange={e => update("address", e.target.value)}
                      placeholder="гр. Смолян, ул. …"
                      disabled={isSigned}
                      className={inputCls}
                    />
                  </Field>

                  <ProductAutocomplete
                    label="Марка и модел"
                    value={[form.ac_brand, form.ac_model].filter(Boolean).join(" ")}
                    disabled={isSigned}
                    placeholder="Търси в каталога или въведи ръчно"
                    onChange={(label, product?: ProductSuggestion) => {
                      if (isSignedRef.current) return;
                      setForm(prev => {
                        let ac_brand = "";
                        let ac_model = label.trim();
                        if (product) {
                          const split = splitProductSelection(product);
                          ac_brand = split.brand;
                          ac_model = split.model;
                        }
                        const serialFromProduct = product
                          ? [product.indoor_unit_serial, product.outdoor_unit_serial]
                              .filter(Boolean)
                              .join(" / ")
                          : "";
                        const next = {
                          ...prev,
                          ac_brand,
                          ac_model,
                          ...(serialFromProduct && !prev.serial_number.trim()
                            ? { serial_number: serialFromProduct }
                            : {}),
                        };
                        autoSave(next, savedId);
                        return next;
                      });
                    }}
                  />

                  <Field label="Сериен номер">
                    <input
                      type="text"
                      value={form.serial_number}
                      onChange={e => update("serial_number", e.target.value)}
                      placeholder="От табелката на тялото"
                      disabled={isSigned}
                      className={inputCls}
                    />
                  </Field>
                </>
              )}

              {form.service_kind === "recycle" && (
                <>
                  <div className="rounded-xl border border-brand-orange-200 bg-brand-orange-50 px-3 py-2.5 text-sm text-brand-orange-900">
                    Рециклиране за магазина — без клиент. Избери конкретна бройка от партида
                    втора употреба и попълни серийните номера — те ще се пренесат автоматично
                    към складовата бройка.
                  </div>

                  <RecycleBatchPicker
                    value={form.product_id}
                    currentLabel={[form.ac_brand, form.ac_model].filter(Boolean).join(" ")}
                    disabled={isSigned}
                    onChange={(productId, group?: RecycleBatchGroup) => {
                      if (isSignedRef.current) return;
                      setForm(prev => {
                        const ac_brand = group ? group.brand : prev.ac_brand;
                        const ac_model = group ? group.model : prev.ac_model;
                        const next = { ...prev, product_id: productId, ac_brand, ac_model };
                        autoSave(next, savedId);
                        return next;
                      });
                    }}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Сериен № вътрешно тяло">
                      <input
                        type="text"
                        value={form.indoor_unit_serial}
                        onChange={e => update("indoor_unit_serial", e.target.value)}
                        placeholder="От табелката на вътрешното тяло"
                        disabled={isSigned}
                        className={inputCls}
                      />
                    </Field>
                    <Field label="Сериен № външно тяло">
                      <input
                        type="text"
                        value={form.outdoor_unit_serial}
                        onChange={e => update("outdoor_unit_serial", e.target.value)}
                        placeholder="От табелката на външното тяло"
                        disabled={isSigned}
                        className={inputCls}
                      />
                    </Field>
                  </div>

                  {form.product_id && form.indoor_unit_serial.trim() && form.outdoor_unit_serial.trim() && (
                    <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                      И двата серийни номера са попълнени — при запис бройката ще стане
                      конкретна инстанция в склада.
                    </p>
                  )}
                </>
              )}
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
                disabled={isSigned}
              />

              <EnumField<FreonChargeMethod>
                label="Фреон / зареждане"
                hint={form.is_japanese_brand
                  ? 'За японски модели зареждането „на кантар“ е препоръка от производителя.'
                  : 'Стандартно зареждане при повечето модели.'}
                value={form.freon_charge_method}
                options={FREON_CHARGE_OPTIONS}
                onChange={v => update("freon_charge_method", v)}
                disabled={isSigned}
              />

              {form.freon_charge_method && form.freon_charge_method !== "none" && (
                <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
                  <p className="text-sm font-semibold text-slate-800">Вид и количество на хладилния агент</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Вид хладилен агент">
                      <input
                        type="text"
                        list="refrigerant-type-options"
                        value={form.refrigerant_type}
                        onChange={e => update("refrigerant_type", e.target.value)}
                        placeholder="напр. R-32"
                        disabled={isSigned}
                        className={inputCls}
                      />
                      <datalist id="refrigerant-type-options">
                        {REFRIGERANT_TYPE_OPTIONS.map(v => <option key={v} value={v} />)}
                      </datalist>
                    </Field>
                    <Field label="Количество сложено (грамове)">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        inputMode="numeric"
                        value={form.refrigerant_amount_g}
                        onChange={e => update("refrigerant_amount_g", e.target.value)}
                        placeholder="напр. 150"
                        disabled={isSigned}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                </div>
              )}

              <YesNoField
                label="Прахосмукачка (почистване)"
                value={form.vacuum_cleaning_done}
                onChange={v => update("vacuum_cleaning_done", v)}
                disabled={isSigned}
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
                disabled={isSigned}
              />
              <EnumField<BearingsState>
                label="Лагери на външно тяло"
                value={form.outdoor_bearings_state}
                options={BEARINGS_OPTIONS}
                onChange={v => update("outdoor_bearings_state", v)}
                disabled={isSigned}
              />
              <EnumField<BearingsState>
                label="Лагери на вътрешно тяло"
                value={form.indoor_bearings_state}
                options={BEARINGS_OPTIONS}
                onChange={v => update("indoor_bearings_state", v)}
                disabled={isSigned}
              />
              <YesNoField
                label="Оригинално дистанционно"
                value={form.original_remote}
                onChange={v => update("original_remote", v)}
                disabled={isSigned}
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
                      disabled={isSigned}
                      className={inputCls}
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
                      disabled={isSigned}
                      className={inputCls}
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
                      disabled={isSigned}
                      className={inputCls}
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
                      disabled={isSigned}
                      className={inputCls}
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
                disabled={isSigned}
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
                    disabled={isSigned}
                  />
                  <YesNoField
                    label="Топлообменник на външно тяло"
                    value={form.welds_outdoor_heat_exchanger}
                    onChange={v => update("welds_outdoor_heat_exchanger", v)}
                    disabled={isSigned}
                  />
                  <YesNoField
                    label="Тръби"
                    value={form.welds_pipes}
                    onChange={v => update("welds_pipes", v)}
                    disabled={isSigned}
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
                disabled={isSigned}
              />
              <YesNoField
                label="Счупена турбина"
                value={form.broken_turbine}
                onChange={v => update("broken_turbine", v)}
                disabled={isSigned}
              />

              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
                  Сервизна оценка за работата на климатика
                </p>
                <StarRatingField
                  value={form.service_rating}
                  onChange={v => update("service_rating", v)}
                  disabled={isSigned}
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
                  disabled={isSigned}
                  className={`${inputCls} resize-none`}
                />
              </Field>

              <SignatureSlot
                label="Подпис на сервизен техник"
                signature={form.signature_team}
                onSign={() => setSigOpen(true)}
                onClear={() => update("signature_team", null)}
                disabled={isSigned || (form.status === "signed" && !!form.signature_team)}
              />

              {sigOpen && !isSigned && (
                <SignatureCanvas
                  label="Подпис на сервизен техник"
                  onSave={dataUrl => {
                    update("signature_team", dataUrl);
                    setSigOpen(false);
                  }}
                  onClose={() => setSigOpen(false)}
                />
              )}

              {form.signature_team && form.status !== "signed" && !isSigned && (
                <button
                  onClick={finalize}
                  disabled={saving}
                  className="w-full py-3 bg-brand-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-blue-800 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Финализирай протокола
                </button>
              )}

              {savedId && form.status === "signed" && (
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

          {linkWarning && (
            <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-xl text-sm">
              Протоколът е запазен, но серийните номера не са пренесени към склада: {linkWarning}
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
      <div className="bg-white border-t border-slate-200 shrink-0 px-4 py-3 pb-safe">
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

function YesNoField({
  label, hint, value, onChange, disabled,
}: {
  label: string;
  hint?: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-3 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
        </div>
        {value !== null && !disabled && (
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
          disabled={disabled}
          onClick={() => onChange(true)}
          className={`py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
            value === true
              ? "bg-brand-blue-700 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Да
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(false)}
          className={`py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
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

function EnumField<T extends string>({
  label, hint, value, options, onChange, disabled,
}: {
  label: string;
  hint?: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  onChange: (v: T | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-3 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800">{label}</p>
          {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
        </div>
        {value !== null && !disabled && (
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
            disabled={disabled}
            onClick={() => onChange(opt.value)}
            className={`py-2 px-3 rounded-lg text-sm font-medium text-left transition-colors disabled:cursor-not-allowed ${
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
  value, onChange, disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className={`bg-white border border-slate-200 rounded-xl p-3 ${disabled ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-center gap-2">
        {[1, 2, 3, 4, 5].map(n => {
          const active = value !== null && n <= value;
          return (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onChange(value === n ? null : n)}
              className="p-1.5 transition-transform active:scale-90 disabled:cursor-not-allowed"
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
