"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { adminLocalDateKey } from "@/lib/admin/localDateKey";
import { formatAdminDateOnly } from "@/lib/admin/formatEuro";
import { REPAIR_PROTOCOL_STEPS, repairProtocolStepRows } from "@/lib/repair-protocol-steps";
import {
  ChevronLeft, ChevronRight, Download,
  PenLine, Trash2, X, Loader2, CheckCircle2, Star, Save,
} from "lucide-react";
import { SignatureCanvas } from "../acceptance/SignatureCanvas";
import { ProtocolProductLinkPanel } from "./ProtocolProductLinkPanel";
import { ContactAutocomplete, type ContactSuggestion } from "../acceptance/ContactAutocomplete";
import type { AdminRole } from "@/lib/admin/db";
import {
  FREON_CHARGE_OPTIONS, BEARINGS_OPTIONS, NOISE_OPTIONS,
  SERVICE_RATING_OPTIONS, SERVICE_KIND_OPTIONS, isJapaneseBrand,
  REFRIGERANT_TYPE_OPTIONS,
  type FreonChargeMethod, type BearingsState, type NoiseLevel,
  type RepairServiceKind, type RepairProtocolPhase, type RepairWorkflowStage,
} from "@/lib/repair-protocol-fields";
import { combineLegacySerialField } from "@/lib/protocol-contact-fields";
import { hydrateRepairProtocolClientFields } from "@/lib/admin/matchRepairProtocolProduct";
import { ProtocolBrandModelFields } from "./ProtocolBrandModelFields";
import { useAdminBackHandler } from "@/lib/admin/useAdminBackHandler";

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

  /** Конкретната бройка от каталога при завеждане. */
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
  date:             adminLocalDateKey(),
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
  initialPhase?: RepairProtocolPhase;
  initialData?: Partial<FormData>;
  role: AdminRole;
  onClose: () => void;
  onSaved: (id: string) => void;
}

function formFromRecord(data: Record<string, unknown>): FormData {
  const hydrated = hydrateRepairProtocolClientFields({
    ac_brand: (data.ac_brand as string | null) ?? "",
    ac_model: (data.ac_model as string | null) ?? "",
    serial_number: (data.serial_number as string | null) ?? "",
    indoor_unit_serial: (data.indoor_unit_serial as string | null) ?? "",
    outdoor_unit_serial: (data.outdoor_unit_serial as string | null) ?? "",
  });
  return {
    date:             (data.date as string) ?? adminLocalDateKey(),
    work_item_id:     (data.work_item_id as string | null) ?? null,
    service_kind:     ((data.service_kind as RepairServiceKind) === "recycle" ? "recycle" : "client"),

    client_name:      (data.client_name as string) ?? "",
    client_phone:     (data.client_phone as string) ?? "",
    client_email:     (data.client_email as string) ?? "",
    address:          (data.address as string) ?? "",
    serial_number:    (data.serial_number as string) ?? "",

    product_id:           (data.product_id as string | null) ?? null,
    indoor_unit_serial:   hydrated.indoor_unit_serial,
    outdoor_unit_serial:  hydrated.outdoor_unit_serial,

    ac_brand:         hydrated.ac_brand,
    ac_model:         hydrated.ac_model,

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
    status:           (data.status as FormData["status"]) ?? "prepared",
    };
}

function issueForm(intake: FormData, issue: Record<string, unknown> | null): FormData {
  const base = {
    ...defaultForm(), service_kind: intake.service_kind, work_item_id: intake.work_item_id,
    product_id: intake.product_id, ac_brand: intake.ac_brand, ac_model: intake.ac_model,
    indoor_unit_serial: intake.indoor_unit_serial, outdoor_unit_serial: intake.outdoor_unit_serial,
    serial_number: intake.serial_number, client_name: intake.client_name, client_phone: intake.client_phone,
    client_email: intake.client_email, address: intake.address, is_japanese_brand: intake.is_japanese_brand,
  };
  return issue ? formFromRecord({ ...base, ...issue }) : base;
}

function formPayload(data: FormData) {
  const numOrNull = (s: string) => {
    if (!s) return null;
    const n = Number(s.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  };

  const indoorSerial = data.indoor_unit_serial.trim() || null;
  const outdoorSerial = data.outdoor_unit_serial.trim() || null;

  return {
    work_item_id:     data.work_item_id,
    date:             data.date || adminLocalDateKey(),
    service_kind:     data.service_kind,

    client_name:      data.service_kind === "recycle" ? null : (data.client_name.trim() || null),
    client_phone:     data.service_kind === "recycle" ? null : (data.client_phone.trim() || null),
    client_email:     data.service_kind === "recycle" ? null : (data.client_email.trim() || null),
    address:          data.service_kind === "recycle" ? null : (data.address.trim() || null),
    serial_number:    data.service_kind === "recycle"
      ? null
      : (combineLegacySerialField(indoorSerial, outdoorSerial) ?? (data.serial_number.trim() || null)),

    product_id:           data.product_id ?? null,
    indoor_unit_serial:   indoorSerial,
    outdoor_unit_serial:  outdoorSerial,

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
}

type ProtocolRecord = Record<string, unknown> & {
  id: string;
  updated_at: string;
  workflow_stage: RepairWorkflowStage;
  issue_data: Record<string, unknown> | null;
};

const inputCls =
  "w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-blue-400 disabled:opacity-60 disabled:cursor-not-allowed";

function formHasDraftContent(data: FormData): boolean {
  return Boolean(
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
    data.signature_team,
  );
}

function serializeFormSnapshot(data: FormData): string {
  return JSON.stringify(data);
}

// ─── Главен компонент ────────────────────────────────────────────────────────

export function ServiceProtocolFormWizard({ protocolId, initialPhase, initialData, role, onClose, onSaved }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(() => ({ ...defaultForm(), ...initialData }));
  const [intake, setIntake] = useState<FormData | null>(null);
  const [phase, setPhase] = useState<RepairProtocolPhase>("intake");
  const [stage, setStage] = useState<RepairWorkflowStage>("intake");
  const [savedId, setSavedId] = useState<string | null>(protocolId ?? null);
  const [loading, setLoading] = useState(Boolean(protocolId));
  const [saving, setSaving] = useState(false);
  const [sigOpen, setSigOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkWarning, setLinkWarning] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [completed, setCompleted] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [conflict, setConflict] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const savedRowRef = useRef<ProtocolRecord | null>(null);
  const creationIdRef = useRef<string | null>(null);
  const savingRef = useRef(false);
  const baselineFormRef = useRef(serializeFormSnapshot(form));
  const scrollRef = useRef<HTMLDivElement>(null);
  const isIssue = phase === "issue";
  const signedCorrection = stage === "issued" || (stage === "legacy_signed" && !isIssue);
  const isSigned = signedCorrection && role === "service_staff";
  const isSignedRef = useRef(isSigned);
  isSignedRef.current = isSigned;

  const applyRecord = useCallback((row: ProtocolRecord, editingPhase: RepairProtocolPhase) => {
    const received = formFromRecord(row);
    const next = editingPhase === "issue" ? issueForm(received, row.issue_data) : received;
    savedRowRef.current = row;
    setSavedId(row.id);
    setStage(row.workflow_stage ?? (row.status === "signed" ? "legacy_signed" : "intake"));
    setIntake(received);
    setPhase(editingPhase);
    setForm(next);
    baselineFormRef.current = serializeFormSnapshot(next);
  }, []);

  useEffect(() => {
    if (!protocolId || savedRowRef.current?.id === protocolId) return;
    const request = new AbortController();
    setLoading(true);
    setLoadErr(null);
    (async () => {
      try {
        const res = await fetch(`/api/admin/service/repair-protocols/${protocolId}`, {
          credentials: "include", signal: request.signal,
        });
        const json = await res.json();
        if (!res.ok || !json.data) throw new Error(json.error || "Протоколът не може да бъде зареден.");
        if (request.signal.aborted) return;
        const row: ProtocolRecord = json.data;
        const workflow = row.workflow_stage ?? (row.status === "signed" ? "legacy_signed" : "intake");
        const editIntake = workflow === "intake" || (workflow === "legacy_signed" && initialPhase === "intake");
        applyRecord(row, editIntake ? "intake" : "issue");
      } catch (cause) {
        if (!request.signal.aborted) setLoadErr(cause instanceof Error ? cause.message : "Грешка при зареждане.");
      } finally {
        if (!request.signal.aborted) setLoading(false);
      }
    })();
    return () => request.abort();
  }, [protocolId, initialPhase, applyRecord, loadAttempt]);

  useEffect(() => {
    if (isSignedRef.current || isIssue) return;
    if (isJapaneseBrand(`${form.ac_brand} ${form.ac_model}`)) {
      setForm(prev => prev.is_japanese_brand === null ? { ...prev, is_japanese_brand: true } : prev);
    }
  }, [form.ac_brand, form.ac_model, isIssue]);

  useEffect(() => { scrollRef.current?.scrollTo(0, 0); }, [step]);

  const update = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    if (!isSigned && !savingRef.current) setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleCancel = () => {
    if (savingRef.current) return;
    if (!completed && !isSigned && serializeFormSnapshot(form) !== baselineFormRef.current &&
        !window.confirm("Затваряне без запазване на промените?")) return;
    onClose();
  };
  useAdminBackHandler(true, handleCancel, "service-protocol-wizard");

  function reloadFromServer() {
    if (conflict && !window.confirm("Да заредя ли последния запис вместо въведените тук промени?")) return;
    savedRowRef.current = null;
    setConflict(false);
    setError(null);
    setLoadAttempt(n => n + 1);
  }

  const save = async (complete: boolean) => {
    if (savingRef.current || loading || loadErr || isSigned || conflict) return;
    if (!formHasDraftContent(form) && !savedId) {
      setError("Попълнете данни за протокола преди запазване.");
      return;
    }
    if ((complete || signedCorrection) && !form.signature_team) {
      setError("Необходим е подпис на сервизния техник.");
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setSaveMessage("");
    try {
      const payload: Record<string, unknown> = formPayload(form);
      if (isIssue) {
        // The server keeps the unit linked to its intake, including serials on older records.
        for (const key of ["service_kind", "work_item_id", "product_id", "ac_brand", "ac_model",
          "indoor_unit_serial", "outdoor_unit_serial", "serial_number"]) delete payload[key];
      }
      if (!savedId) creationIdRef.current ??= crypto.randomUUID();
      const res = await fetch(savedId ? `/api/admin/service/repair-protocols/${savedId}` : "/api/admin/service/repair-protocols", {
        method: savedId ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload, phase, complete: complete || signedCorrection,
          ...(savedId ? { expected_updated_at: savedRowRef.current?.updated_at } : { creation_id: creationIdRef.current }),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.data?.id) {
        if (res.status === 409) {
          if (!savedId && json.data?.id) {
            savedRowRef.current = json.data;
            setSavedId(json.data.id);
            if (json.data.workflow_stage !== "intake") {
              setConflict(true);
              onSaved(json.data.id);
            }
          } else if (savedId) setConflict(true);
        }
        throw new Error(json.error || "Грешка при запазване на протокола.");
      }
      applyRecord(json.data, phase);
      setLinkWarning(json.productLinkWarning ?? null);
      setSaveMessage(complete || signedCorrection ? "Промените са запазени." : "Черновата е запазена.");
      if (complete) setCompleted(signedCorrection ? "Корекцията е запазена" : isIssue ? "Климатикът е издаден" : "Климатикът е заведен");
      onSaved(json.data.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Грешка при запазване на протокола.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
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

  const isLastStep = step === REPAIR_PROTOCOL_STEPS.length - 1;
  const phaseLabel = isIssue ? "Издаване" : "Завеждане";
  const number = savedRowRef.current?.protocol_number;
  const title = number ? `Сервизен протокол № ${number}` : "Нов сервизен протокол";
  const rows = isIssue && intake ? repairProtocolStepRows({ ...intake }, step) : [];

  if (loading || loadErr || completed) {
    return (
      <div className="fixed inset-0 z-40 bg-slate-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          {loading ? <p role="status" className="flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Зареждане…</p> :
            loadErr ? <p role="alert" className="text-red-700">{loadErr}</p> : (
              <>
                <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900"><CheckCircle2 className="w-6 h-6 text-emerald-600" />{completed}</h2>
                {stage === "received" && <p className="text-sm text-slate-600">За издаване отвори същия протокол от списъка.</p>}
              </>
            )}
          {linkWarning && <p role="alert" className="text-sm text-amber-800">{linkWarning}</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex items-center flex-wrap gap-2">
            <button type="button" onClick={onClose} className="min-h-11 rounded-xl bg-brand-blue-700 px-4 font-semibold text-white">Затвори</button>
            {loadErr && <button type="button" onClick={reloadFromServer} className="min-h-11 px-3 text-brand-blue-800">Опитай отново</button>}
            {completed && <button type="button" onClick={downloadPdf} className="flex items-center gap-2 min-h-11 px-3 text-brand-blue-800"><Download className="w-4 h-4" /> Свали PDF</button>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-slate-50 flex flex-col" role="dialog" aria-modal="true" aria-label={title}>
      <header className="bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={handleCancel} disabled={saving} aria-label="Затвори протокола"
            className="min-h-[44px] min-w-[44px] grid place-items-center rounded-xl text-slate-500 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-500">{phaseLabel}{number ? ` · № ${number}` : ""} · Стъпка {step + 1} от {REPAIR_PROTOCOL_STEPS.length}</p>
            <h1 className="text-sm sm:text-lg font-bold text-slate-900">{REPAIR_PROTOCOL_STEPS[step].title}</h1>
          </div>
          {isSigned ? <span className="text-xs text-slate-500">Само преглед</span> : !signedCorrection && (
            <button type="button" onClick={() => void save(false)} disabled={saving || conflict}
              className="flex items-center gap-2 px-3 min-h-11 rounded-xl border border-brand-blue-200 text-brand-blue-800 font-semibold text-sm disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Запази чернова
            </button>
          )}
        </div>
        <div className="h-1 bg-slate-100"><div className="h-1 bg-brand-orange-500 transition-all" style={{ width: `${((step + 1) / REPAIR_PROTOCOL_STEPS.length) * 100}%` }} /></div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className={`mx-auto w-full p-3 sm:p-5 ${isIssue ? "max-w-5xl grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]" : "max-w-2xl"}`}>
          {isIssue && intake && (
            <aside aria-label="Данни при завеждане" className="sticky top-0 z-10 self-start lg:top-4 lg:col-start-2 lg:row-start-1">
              <details open className="overflow-hidden rounded-xl border border-brand-blue-200 bg-white shadow-sm">
                <summary className="cursor-pointer px-4 py-2.5 text-sm font-bold text-brand-blue-900 bg-brand-blue-50">
                  При завеждане{intake.date ? " · " + formatAdminDateOnly(intake.date) : ""}
                </summary>
                <div className="max-h-[25dvh] overflow-y-auto px-4 py-2 lg:max-h-[65dvh]">
                  <dl className="divide-y divide-slate-100">{rows.map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-baseline gap-3 py-2 text-sm">
                      <dt className="text-slate-500">{label}</dt>
                      <dd className="min-w-0 whitespace-pre-wrap break-words text-right font-semibold text-slate-800">{value}</dd>
                    </div>
                  ))}</dl>
                  {isLastStep && (intake.signature_team ? <img src={intake.signature_team} alt="Подпис на техника при завеждане" className="max-w-full h-14 object-contain" /> :
                    <p className="text-sm text-slate-500">Подпис на техник —</p>)}
                </div>
              </details>
            </aside>
          )}
          <fieldset disabled={saving} className="min-w-0 space-y-3 lg:col-start-1 lg:row-start-1">
            {isIssue && <legend className="mb-2 text-sm font-bold text-slate-800">При издаване</legend>}

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
                        disabled={isSigned || isIssue}
                        onClick={() => {
                          if (isSignedRef.current) return;
                          setForm((prev) => {
                            const next: FormData = {
                              ...prev,
                              service_kind: opt.value,
                              ...(opt.value === "recycle"
                                ? { client_name: "", client_phone: "", client_email: "", address: "" }
                                : {}),
                            };
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

              <Field label={isIssue ? "Дата на издаване" : "Дата на завеждане"}>
                <input
                  type="date"
                  min={isIssue ? intake?.date : undefined}
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

                </>
              )}

              <ProtocolBrandModelFields
                value={form}
                disabled={isSigned || isIssue}
                onChange={(next) => {
                  if (isSignedRef.current) return;
                  setForm(prev => ({
                    ...prev,
                    ...next,
                    ...(prev.product_id !== next.product_id ? { serial_number: "" } : {}),
                  }));
                }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Сериен № вътрешно тяло">
                  <input
                    type="text"
                    value={form.indoor_unit_serial}
                    onChange={e => update("indoor_unit_serial", e.target.value)}
                    placeholder="От табелката на вътрешното тяло"
                    disabled={isSigned || isIssue}
                    className={inputCls}
                  />
                </Field>
                <Field label="Сериен № външно тяло">
                  <input
                    type="text"
                    value={form.outdoor_unit_serial}
                    onChange={e => update("outdoor_unit_serial", e.target.value)}
                    placeholder="От табелката на външното тяло"
                    disabled={isSigned || isIssue}
                    className={inputCls}
                  />
                </Field>
              </div>

              <ProtocolProductLinkPanel
                protocolId={isIssue ? null : savedId}
                productId={form.product_id}
                disabled={isSigned || isIssue}
                onLink={(productId) => {
                  if (isSignedRef.current || isIssue) return;
                  setForm(prev => ({ ...prev, product_id: productId }));
                }}
              />
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

            </div>
          )}

            {linkWarning && <p role="alert" className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{linkWarning}</p>}
            {error && <div role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}{conflict && <button type="button" onClick={reloadFromServer} className="block mt-2 font-semibold underline">Зареди последния запис</button>}
            </div>}
            {saveMessage && !error && serializeFormSnapshot(form) === baselineFormRef.current &&
              <p role="status" className="text-sm text-emerald-700">{saveMessage}</p>}
          </fieldset>
        </div>
      </div>

      <footer className="bg-white border-t border-slate-200 shrink-0 px-4 py-3 pb-safe">
        <div className="flex justify-between items-center gap-2 max-w-5xl mx-auto">
          <button type="button" onClick={() => setStep(s => s - 1)} disabled={step === 0 || saving}
            className="flex items-center gap-1 min-h-11 px-3 text-slate-700 rounded-xl font-semibold text-sm disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" /> Назад
          </button>
          {isLastStep && !isSigned ? (
            <button type="button" onClick={() => void save(true)} disabled={saving || conflict || !form.signature_team}
              className="flex items-center gap-2 min-h-11 px-4 rounded-xl font-bold text-sm bg-brand-blue-700 text-white disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {signedCorrection ? "Запази корекцията" : isIssue ? "Издай климатика" : "Заведи климатика"}
            </button>
          ) : (
            <button type="button" onClick={() => isLastStep ? handleCancel() : setStep(s => s + 1)} disabled={saving}
              className="flex items-center gap-1 min-h-11 px-4 rounded-xl font-semibold text-sm bg-brand-blue-700 text-white">
              {isLastStep ? "Затвори" : "Напред"}{!isLastStep && <ChevronRight className="w-4 h-4" />}
            </button>
          )}
        </div>
      </footer>
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
