"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Check, Download, Mail,
  PenLine, Trash2, X, Loader2, CheckCircle2, CloudOff, Save,
} from "lucide-react";
import {
  PROTOCOL_MATERIALS, PRIMARY_MATERIALS, LEFT_MATERIALS, RIGHT_MATERIALS,
  MOUNT_TYPES, EMPTY_ACCESSORIES, ACCESSORIES_LABELS,
} from "@/lib/protocol-materials";
import type { AccessoriesEntry, MaterialEntry } from "@/lib/protocol-materials";
import { SignatureCanvas } from "./SignatureCanvas";
import { ProductAutocomplete, type ProductSuggestion } from "./ProductAutocomplete";
import { ContactAutocomplete, type ContactSuggestion } from "./ContactAutocomplete";
import { Input, useAdminBackHandler } from "@/app/admin/ui";
import { offlineSend, offlineGet, newLocalId, isLocalId } from "@/lib/offline/offlineFetch";
import { resolveServerId } from "@/lib/offline/queue";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { useOfflineQueue } from "@/lib/hooks/useOfflineQueue";
import {
  digitsOnlyPhoneInput,
  validateProtocolEmail,
  validateProtocolPhone,
  normalizeProtocolEmailForApi,
  normalizeProtocolPhoneForApi,
  normalizeWorkItemIdForApi,
} from "@/lib/protocol-contact-validation";
import { parseOfflineApiError } from "@/lib/offline/acceptancePayload";

// ─── Типове ──────────────────────────────────────────────────────────────────

interface FormData {
  work_item_id:     string | null;
  date:             string;
  client_name:      string;
  ac_model:         string;
  indoor_unit_serial:  string;
  outdoor_unit_serial: string;
  address:          string;
  paid_amount:      string;
  client_email:     string;
  client_phone:     string;
  mount_types:      string[];
  materials:        Record<string, number>; // { [materialId]: qty }
  cable_channels_m: string;
  accessories:      AccessoriesEntry;
  notes:            string;
  signature_team:   string | null;
  signature_client: string | null;
  /**
   * Жизнен цикъл (виж миграция 0036):
   *   prepared    — офисът е въвел клиентските данни, чака сервизен екип.
   *   in_progress — сервизният екип е започнал да попълва на място.
   *   signed      — завършен и подписан от двете страни.
   */
  status:           "prepared" | "in_progress" | "signed";
}

const defaultForm = (): FormData => ({
  work_item_id:     null,
  date:             new Date().toISOString().slice(0, 10),
  client_name:      "",
  ac_model:         "",
  indoor_unit_serial:  "",
  outdoor_unit_serial: "",
  address:          "",
  paid_amount:      "",
  client_email:     "",
  client_phone:     "",
  mount_types:      [],
  materials:        {},
  cable_channels_m: "",
  accessories:      { ...EMPTY_ACCESSORIES },
  notes:            "",
  signature_team:   null,
  signature_client: null,
  status:           "prepared",
});

interface Props {
  protocolId?: string;
  initialData?: Partial<FormData>;
  /** Ролята на текущия потребител — определя дали подписан протокол може да се редактира. */
  role: import("@/lib/admin/db").AdminRole;
  onClose: () => void;
  onSaved: (id: string) => void;
}

const STEPS = [
  "Основна информация",
  "Главни монтажни елементи",
  "Начин на монтаж",
  "Допълнителни тръби & дюбели",
  "Допълнителни кабели & стойки",
  "Кабелни канали",
  "Забележки",
  "Подписи",
] as const;

function formHasDraftContent(data: FormData): boolean {
  return Boolean(
    data.client_name || data.ac_model || data.indoor_unit_serial || data.outdoor_unit_serial ||
    data.address || data.paid_amount || data.client_phone || data.client_email ||
    data.notes.trim() || data.cable_channels_m ||
    data.mount_types.length > 0 ||
    Object.values(data.materials).some(v => v > 0) ||
    Object.values(data.accessories).some(v => Number(v ?? 0) > 0) ||
    data.signature_team || data.signature_client
  );
}

// ─── Главен компонент ────────────────────────────────────────────────────────

export function ProtocolFormWizard({ protocolId, initialData, role, onClose, onSaved }: Props) {
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState<FormData>({ ...defaultForm(), ...initialData });
  const [saving, setSaving] = useState(false);
  // savedId може да е серверен UUID или offline-generated "local-..." UUID
  // (когато протоколът е създаден без мрежа). При възстановяване на мрежа,
  // sync engine-ът мапва local-id → server-id зад кулисите.
  const [savedId, setSavedId] = useState<string | null>(protocolId ?? null);
  // Локален UUID за нови протоколи — генерира се при първия POST, за да можем
  // да трекваме записа в IndexedDB и преди да получим server id.
  const localIdRef = useRef<string | null>(null);
  const [pendingSync, setPendingSync] = useState(false);
  const online = useOnlineStatus();
  const { syncNow, refreshQueueState, pendingSampleError, isSyncing } = useOfflineQueue();
  const [sigOpen, setSigOpen] = useState<"team" | "client" | null>(null);
  useAdminBackHandler(Boolean(sigOpen), () => setSigOpen(null), "protocol-signature");
  const [sendEmail, setSendEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(initialData?.client_email ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent]      = useState(false);
  const [error, setError]    = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistFormRef = useRef<(data: FormData, id: string | null, showSaving?: boolean) => Promise<string | null>>(() => Promise.resolve(null));
  const onlineRef = useRef(online);
  onlineRef.current = online;
  /** Следи дали протоколът е подписан и потребителят е service_staff (read-only). */
  const isSignedRef = useRef(false);
  /** Само при отваряне на съществуващ протокол — не при auto-save CREATE в същата сесия. */
  const resumeStepOnLoadRef = useRef(Boolean(protocolId));

  // ── Зареждане на initial data при отваряне на съществуващ протокол ─────────
  useEffect(() => {
    if (!protocolId || initialData) return;
    let cancelled = false;
    (async () => {
      // Първо опитай мрежата (ако сме онлайн); fallback към cache.
      let serverFailed = false;
      try {
        if (typeof navigator !== "undefined" && navigator.onLine && !isLocalId(protocolId)) {
          const res = await fetch(`/api/admin/service/protocols/${protocolId}`, {
            credentials: "include",
          });
          if (res.ok) {
            const { data } = await res.json();
            if (cancelled || !data) return;
            applyServerData(data);
            return;
          }
          serverFailed = true;
        }
      } catch { serverFailed = true; /* мрежа падна — пробваме cache */ }
      // Cache fallback (offline или мрежова грешка)
      const cached = await offlineGet<Record<string, unknown>>(protocolId);
      if (cancelled) return;
      if (!cached) {
        if (serverFailed) {
          setError("Протоколът не може да бъде зареден. Може би е изтрит или нямате достъп.");
        }
        return;
      }
      applyServerData(cached.data as Record<string, unknown>);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocolId]);

  const applyServerData = useCallback((data: Record<string, unknown>) => {
    const materialsMap: Record<string, number> = {};
    if (Array.isArray(data.materials)) {
      for (const m of data.materials as Array<{ id?: string; qty?: number }>) {
        if (m?.id && typeof m.qty === "number") materialsMap[m.id] = m.qty;
      }
    }
    const nextForm: FormData = {
      ...defaultForm(),
      work_item_id:     (data.work_item_id as string | null) ?? null,
      date:             (data.date as string) ?? defaultForm().date,
      client_name:      (data.client_name as string) ?? "",
      ac_model:         (data.ac_model as string) ?? "",
      indoor_unit_serial:  (data.indoor_unit_serial as string) ?? (data.serial_number as string) ?? "",
      outdoor_unit_serial: (data.outdoor_unit_serial as string) ?? "",
      address:          (data.address as string) ?? "",
      paid_amount:      data.paid_amount != null ? String(data.paid_amount) : "",
      client_email:     (data.client_email as string) ?? "",
      client_phone:     (data.client_phone as string) ?? "",
      mount_types:      (data.mount_types as string[]) ?? [],
      materials:        Object.keys(materialsMap).length ? materialsMap : defaultForm().materials,
      cable_channels_m: data.cable_channels_m != null ? String(data.cable_channels_m) : "",
      accessories:      (data.accessories as AccessoriesEntry) ?? { ...EMPTY_ACCESSORIES },
      notes:            (data.notes as string) ?? "",
      signature_team:   (data.signature_team as string | null) ?? null,
      signature_client: (data.signature_client as string | null) ?? null,
      status:           (data.status as FormData["status"]) ?? "prepared",
    };
    setForm(nextForm);
    setEmailInput(nextForm.client_email);
    if (resumeStepOnLoadRef.current) {
      setStep(0);
      resumeStepOnLoadRef.current = false;
    }
  }, []);

  // In-flight lock: предотвратява двойно повикване на persistForm,
  // което би създало дубликати при паралелен auto-save + finalize (виж P7 в кода ревюто).
  // Втория caller изчаква първия да приключи; последното състояние се запазва наново.
  const persistRef = useRef<Promise<unknown> | null>(null);

  // P14: При unmount изчистваме pending autoSave timeout-а, за да не извика
  // setState на unmounted компонент.
  useEffect(() => () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
  }, []);

  // Автоматично запазване — без да уведомяваме родителя (onSaved/load).
  const autoSave = useCallback((data: FormData, id: string | null) => {
    if (isSignedRef.current) return;
    if (!formHasDraftContent(data) && !id) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      void persistFormRef.current(data, id, false);
    }, 2000);
  }, []);

  const update = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    if (isSignedRef.current) return;
    setForm(prev => {
      const next = { ...prev, [key]: val };
      autoSave(next, savedId);
      return next;
    });
  }, [savedId, autoSave]);

  // ── Запазване в API ───────────────────────────────────────────────────────

  const persistForm = async (data: FormData, id: string | null, showSaving = true): Promise<string | null> => {
    // Serialize concurrent calls (P7): чакаме предишен persist преди да започнем нов.
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
    // Recovery от race: ако този persist е тригернат със стара closure стойност (id=null)
    // но в междувременен предишен persist вече е създал localId, реюзваме него вместо
    // да създадем втори запис в БД (виж P1 в кода ревюто).
    if (id === null && localIdRef.current) {
      id = localIdRef.current;
    }
    if (showSaving) setSaving(true);
    setError(null);
    try {
      // Бележка: status НЕ се изпраща — backend-ът сам управлява workflow-а:
      //   prepared → in_progress (поява на техническо съдържание)
      //   in_progress → signed   (двата подписа са налични)
      const payload = {
        work_item_id:     normalizeWorkItemIdForApi(data.work_item_id),
        date:             data.date || new Date().toISOString().slice(0, 10),
        client_name:      data.client_name || null,
        ac_model:         data.ac_model || null,
        indoor_unit_serial:  data.indoor_unit_serial || null,
        outdoor_unit_serial: data.outdoor_unit_serial || null,
        address:          data.address || null,
        paid_amount:      (() => {
          if (!data.paid_amount) return null;
          const n = parseFloat(data.paid_amount);
          return Number.isFinite(n) && n >= 0 ? n : null;
        })(),
        client_email:     normalizeProtocolEmailForApi(data.client_email),
        client_phone:     normalizeProtocolPhoneForApi(data.client_phone),
        mount_types:      data.mount_types,
        materials:        PROTOCOL_MATERIALS
          .filter(m => (data.materials[m.id] ?? 0) > 0)
          .map(m => ({ id: m.id, name: m.name, unit: m.unit, qty: data.materials[m.id] })) as MaterialEntry[],
        cable_channels_m: data.cable_channels_m ? parseFloat(data.cable_channels_m) : 0,
        accessories:      data.accessories,
        notes:            data.notes || null,
        signature_team:   data.signature_team,
        signature_client: data.signature_client,
      };

      const afterQueuedSave = async (
        result: { queued: boolean },
        effectiveId: string,
        notifySync: boolean,
      ) => {
        if (!result.queued || !notifySync) return;
        if (onlineRef.current) {
          await syncNow();
          await refreshQueueState();
          if (isLocalId(effectiveId)) {
            const sid = await resolveServerId(effectiveId);
            if (sid) {
              setSavedId(sid);
              setPendingSync(false);
            }
          } else {
            setPendingSync(false);
          }
        }
      };

      if (id) {
        // UPDATE: ако id-то е локално (още няма серверен), използваме :localId placeholder,
        // който sync engine-ът ще резолвне след първи успешен POST.
        const isLocal = isLocalId(id);
        const endpoint = isLocal
          ? `/api/admin/service/protocols/:localId`
          : `/api/admin/service/protocols/${id}`;
        const result = await offlineSend<typeof payload, { id: string; status?: FormData["status"] }>({
          kind:    "acceptance",
          method:  "PUT",
          endpoint,
          body:    payload,
          localId: isLocal ? id : undefined,
        });
        if (!result.ok) throw new Error(result.error ?? "Грешка при запазване");
        if (!result.queued) setPendingSync(false);
        else if (showSaving || !online) setPendingSync(true);
        if (result.data?.status && result.data.status !== data.status) {
          setForm(prev => ({ ...prev, status: result.data!.status! }));
        }
        await afterQueuedSave(result, id, showSaving);
      } else {
        // CREATE: винаги генерираме localId за tracking в IndexedDB.
        const localId = localIdRef.current ?? newLocalId();
        localIdRef.current = localId;

        const result = await offlineSend<typeof payload, { id: string; status?: FormData["status"] }>({
          kind:    "acceptance",
          method:  "POST",
          endpoint: "/api/admin/service/protocols",
          body:    payload,
          localId,
        });
        if (!result.ok) throw new Error(result.error ?? "Грешка при запазване");

        // Online: получихме server id → използваме него.
        // Offline: оперираме с localId докато не дойде мрежа.
        const effectiveId = result.data?.id ?? localId;
        setSavedId(effectiveId);
        if (!result.queued) setPendingSync(false);
        else if (showSaving || !online) setPendingSync(true);
        if (result.data?.status && result.data.status !== data.status) {
          setForm(prev => ({ ...prev, status: result.data!.status! }));
        }
        // onSaved само при явно запазване — auto-save не трябва да презарежда формата/стъпката.
        if (showSaving) onSaved(effectiveId);
        await afterQueuedSave(result, effectiveId, showSaving);
        return effectiveId;
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
      return null;
    } finally {
      if (showSaving) setSaving(false);
    }
    return id;
  };

  persistFormRef.current = persistForm;

  // Финализиране + подписи: backend-ът ще зададе status="signed" автоматично,
  // ако и двата подписа (екип + клиент) са налични в текущия запис.
  const finalize = async () => {
    clearAutoSaveTimer();
    const id = await persistForm(form, savedId, true);
    if (id) setSavedId(id);
  };

  const clearAutoSaveTimer = () => {
    if (autoSaveTimer.current) {
      clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = null;
    }
  };

  const validateContactFields = useCallback((data: FormData): Record<string, string> => {
    const errs: Record<string, string> = {};
    const phoneErr = validateProtocolPhone(data.client_phone);
    if (phoneErr) errs.client_phone = phoneErr;
    const emailErr = validateProtocolEmail(data.client_email);
    if (emailErr) errs.client_email = emailErr;
    return errs;
  }, []);

  const saveDraftAndClose = async () => {
    // Подписан протокол: service_staff само затваря (read-only).
    // master_admin и office_staff могат да запазват корекции.
    if (form.status === "signed" && !canEditSigned) {
      onClose();
      return;
    }
    if (!formHasDraftContent(form) && !savedId) {
      onClose();
      return;
    }
    const errs = validateContactFields(form);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Поправете телефон или имейл, преди да запазите черновата.");
      return;
    }
    clearAutoSaveTimer();
    setFieldErrors({});
    setError(null);
    const id = await persistForm(form, savedId, true);
    if (id == null) return;
    if (id) setSavedId(id);
    onSaved(id);
    onClose();
  };

  const handleClose = () => {
    void saveDraftAndClose();
  };

  useAdminBackHandler(true, handleClose, "protocol-wizard");

  // Изпращане на имейл
  const doSendEmail = async () => {
    if (!emailInput) return;
    const emailErr = validateProtocolEmail(emailInput);
    if (emailErr) {
      setError(emailErr);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const id = await resolvePdfEmailId();
      if (!id) throw new Error("Протоколът още не е качен в системата.");
      const res = await fetch(`/api/admin/service/protocols/${id}/email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailInput }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Грешка");
      setSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка при изпращане");
    } finally {
      setSending(false);
    }
  };

  // PDF сваляне — fetch→blob→<a download> за надеждност в iOS PWA
  const downloadPdf = async () => {
    const id = await resolvePdfEmailId();
    if (!id) {
      setError("Протоколът още не е качен в системата. Опитайте отново след малко.");
      return;
    }
    try {
      const res = await fetch(`/api/admin/service/protocols/${id}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Грешка при генериране на PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `protocol-${id}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    } catch {
      setError("Неуспешно сваляне на PDF. Проверете връзката.");
    }
  };

  const isLastStep = step === STEPS.length - 1;
  const bothSigned = Boolean(form.signature_team?.trim()) && Boolean(form.signature_client?.trim());
  // master_admin и office_staff могат да коригират дори подписан протокол.
  // service_staff виждат подписания протокол като read-only.
  const canEditSigned = role === "master_admin" || role === "office_staff";
  const isSigned = (form.status === "signed" || bothSigned) && !canEditSigned;
  isSignedRef.current = isSigned;

  const resolvePdfEmailId = async (): Promise<string | null> => {
    if (!savedId) return null;
    if (!isLocalId(savedId)) return savedId;
    if (onlineRef.current) {
      await syncNow();
      await refreshQueueState();
    }
    const sid = await resolveServerId(savedId);
    if (sid) {
      setSavedId(sid);
      setPendingSync(false);
      return sid;
    }
    return null;
  };

  const validateStep0 = useCallback((data: FormData): Record<string, string> => {
    const errs: Record<string, string> = {};
    const phoneErr = validateProtocolPhone(data.client_phone);
    if (phoneErr) errs.client_phone = phoneErr;
    const emailErr = validateProtocolEmail(data.client_email);
    if (emailErr) errs.client_email = emailErr;
    return errs;
  }, []);

  const goNext = () => {
    if (step === 0) {
      const errs = validateStep0(form);
      if (Object.keys(errs).length > 0) {
        setFieldErrors(errs);
        setError("Поправете полетата с грешки, преди да продължите.");
        return;
      }
    }
    setFieldErrors({});
    setError(null);
    setStep((s) => s + 1);
  };

  // ─── Рендер стъпка ────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[60] bg-slate-50 flex flex-col">

      {/* ── Хедър с прогрес ── */}
      <div className="bg-white border-b border-slate-200 shrink-0 safe-top">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={handleClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 active:bg-slate-200 transition-colors -ml-1 shrink-0"
            title="Запази и затвори"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Стъпка {step + 1} / {STEPS.length}
            </p>
            <p className="text-sm font-black text-slate-900 truncate">{STEPS[step]}</p>
          </div>
          {!online && (
            <div title="Няма мрежа — промените се пазят локално" className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-white text-[10px] font-bold shrink-0">
              <CloudOff className="w-3 h-3" />
              <span className="hidden xs:inline">Без мрежа</span>
            </div>
          )}
          {online && pendingSync && (
            <div title="Записът се качва към сървъра" className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-bold shrink-0">
              {isSyncing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              <span className="hidden xs:inline">{isSyncing ? "Качване…" : "Локален"}</span>
            </div>
          )}
          {!isSigned && (
            <button
              onClick={() => void saveDraftAndClose()}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl border-2 border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 shrink-0 transition-colors"
              title="Запазва текущото съдържание — може да довършите по-късно"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span className="text-xs font-bold">Запази</span>
            </button>
          )}
          {saving && isSigned && <Loader2 className="w-4 h-4 animate-spin text-slate-400 shrink-0" />}
        </div>

        {/* Dot progress indicator */}
        <div className="flex items-center justify-center gap-1.5 pb-2.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${
                i === step
                  ? "w-5 h-2 bg-brand-orange-500"
                  : i < step
                  ? "w-2 h-2 bg-brand-orange-300"
                  : "w-2 h-2 bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Прогрес лента */}
        <div className="h-0.5 bg-slate-100">
          <div
            className="h-0.5 bg-brand-orange-500 transition-all duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Съдържание ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 pb-24 max-w-2xl mx-auto">

          {/* ──────────── Стъпка 0: Основна информация ──────────── */}
          {step === 0 && (
            <div className="space-y-4">
              <Field label="Дата">
                <Input
                  type="date" value={form.date}
                  onChange={e => update("date", e.target.value)}
                  disabled={isSigned}
                />
              </Field>
              <ContactAutocomplete
                label="Клиент"
                value={form.client_name}
                placeholder="Иван Иванов"
                disabled={isSigned}
                onChange={(name, contact?: ContactSuggestion) => {
                  setForm(prev => {
                    const next = {
                      ...prev,
                      client_name: name,
                      ...(contact ? {
                        client_phone: contact.phone
                          ? digitsOnlyPhoneInput(contact.phone)
                          : prev.client_phone,
                        client_email: contact.email ?? prev.client_email,
                        address:      contact.address ?? prev.address,
                      } : {}),
                    };
                    autoSave(next, savedId);
                    return next;
                  });
                }}
              />
              <ProductAutocomplete
                label="Модел климатик"
                value={form.ac_model}
                placeholder="Daikin FTXM25N..."
                disabled={isSigned}
                onChange={(name, product?: ProductSuggestion) => {
                  setForm(prev => {
                    const next = {
                      ...prev,
                      ac_model: name,
                      ...(product ? {
                        indoor_unit_serial:  product.indoor_unit_serial?.trim()
                          ? (prev.indoor_unit_serial || product.indoor_unit_serial.trim())
                          : prev.indoor_unit_serial,
                        outdoor_unit_serial: product.outdoor_unit_serial?.trim()
                          ? (prev.outdoor_unit_serial || product.outdoor_unit_serial.trim())
                          : prev.outdoor_unit_serial,
                      } : {}),
                    };
                    autoSave(next, savedId);
                    return next;
                  });
                }}
              />
              <Field label="Сериен № — вътрешно тяло" error={fieldErrors.indoor_unit_serial}>
                <Input
                  type="text"
                  value={form.indoor_unit_serial}
                  onChange={e => update("indoor_unit_serial", e.target.value)}
                  placeholder="Серийният номер от табелката на вътрешното тяло"
                  disabled={isSigned}
                  className={fieldErrors.indoor_unit_serial ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}
                />
              </Field>
              <Field label="Сериен № — външно тяло" error={fieldErrors.outdoor_unit_serial}>
                <Input
                  type="text"
                  value={form.outdoor_unit_serial}
                  onChange={e => update("outdoor_unit_serial", e.target.value)}
                  placeholder="Серийният номер от табелката на външното тяло"
                  disabled={isSigned}
                  className={fieldErrors.outdoor_unit_serial ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}
                />
              </Field>
              <Field label="Адрес">
                <Input
                  type="text" value={form.address} placeholder="гр. Смолян, ул. ..."
                  onChange={e => update("address", e.target.value)}
                  disabled={isSigned}
                />
              </Field>
              <Field label="Платена сума (€)">
                <Input
                  type="number" value={form.paid_amount} placeholder="0.00" min="0" step="0.01"
                  onChange={e => update("paid_amount", e.target.value)}
                  disabled={isSigned}
                />
              </Field>
              <Field label="Телефон на клиента" error={fieldErrors.client_phone}>
                <Input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  value={form.client_phone}
                  placeholder="0888585816"
                  disabled={isSigned}
                  onChange={e => {
                    update("client_phone", digitsOnlyPhoneInput(e.target.value));
                    if (fieldErrors.client_phone) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.client_phone;
                        return next;
                      });
                    }
                  }}
                  className={fieldErrors.client_phone ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}
                />
              </Field>
              <Field label="Имейл на клиента (за изпращане)" error={fieldErrors.client_email}>
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={form.client_email}
                  placeholder="client@example.com"
                  disabled={isSigned}
                  onChange={e => {
                    const v = e.target.value;
                    update("client_email", v);
                    setEmailInput(v);
                    if (fieldErrors.client_email) {
                      setFieldErrors((prev) => {
                        const next = { ...prev };
                        delete next.client_email;
                        return next;
                      });
                    }
                  }}
                  className={fieldErrors.client_email ? "border-red-400 focus:border-red-500 focus:ring-red-200" : ""}
                />
              </Field>
            </div>
          )}

          {/* ──────────── Стъпка 1: Главни монтажни елементи ──────────── */}
          {step === 1 && (
            <PrimaryMaterialsStep
              values={form.materials}
              onChange={vals => update("materials", vals)}
            />
          )}

          {/* ──────────── Стъпка 2: Начин на монтаж ──────────── */}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-3">
              {MOUNT_TYPES.map(type => {
                const active = form.mount_types.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => {
                      setForm(prev => {
                        const next = active
                          ? prev.mount_types.filter(t => t !== type)
                          : [...prev.mount_types, type];
                        autoSave({ ...prev, mount_types: next }, savedId);
                        return { ...prev, mount_types: next };
                      });
                    }}
                    className={`min-h-[56px] rounded-xl border-2 text-sm font-semibold transition-all
                      ${active
                        ? "bg-blue-600 border-blue-600 text-white"
                        : "bg-white border-slate-200 text-slate-700 active:border-blue-300"
                      }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          )}

          {/* ──────────── Стъпка 3: Допълнителни тръби & дюбели ──────────── */}
          {step === 3 && (
            <MaterialStepGroup
              materials={LEFT_MATERIALS}
              values={form.materials}
              onChange={vals => update("materials", vals)}
            />
          )}

          {/* ──────────── Стъпка 4: Допълнителни кабели & стойки ──────────── */}
          {step === 4 && (
            <MaterialStepGroup
              materials={RIGHT_MATERIALS}
              values={form.materials}
              onChange={vals => update("materials", vals)}
            />
          )}

          {/* ──────────── Стъпка 5: Кабелни канали & аксесоари ──────────── */}
          {step === 5 && (
            <div className="space-y-3">
              <Field label="Кабелни канали (м)">
                <input
                  type="number" value={form.cable_channels_m} placeholder="0" min="0" step="0.5"
                  onChange={e => update("cable_channels_m", e.target.value)}
                  className="w-full text-base border-b-2 border-slate-300 focus:border-blue-500 outline-none py-2 bg-transparent"
                />
              </Field>
              {(Object.keys(EMPTY_ACCESSORIES) as (keyof AccessoriesEntry)[])
                .filter(k => k !== "cable_channels_m")
                .map(k => (
                  <div key={k} className="flex items-center justify-between py-3 border-b border-slate-100">
                    <span className="text-sm text-slate-700">{ACCESSORIES_LABELS[k]}</span>
                    <Stepper
                      value={form.accessories[k]}
                      onChange={v => {
                        setForm(prev => {
                          const nextAcc = { ...prev.accessories, [k]: v };
                          autoSave({ ...prev, accessories: nextAcc }, savedId);
                          return { ...prev, accessories: nextAcc };
                        });
                      }}
                    />
                  </div>
                ))}
            </div>
          )}

          {/* ──────────── Стъпка 6: Забележки ──────────── */}
          {step === 6 && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-3">Забележки</label>
              <textarea
                value={form.notes}
                onChange={e => update("notes", e.target.value)}
                placeholder="Допълнителна информация за монтажа..."
                rows={8}
                className="w-full text-base border-2 border-slate-200 focus:border-blue-500 rounded-xl p-4 outline-none resize-none bg-white"
              />
            </div>
          )}

          {/* ──────────── Стъпка 7: Подписи ──────────── */}
          {step === 7 && (
            <div className="space-y-6">
              <SignatureBlock
                label="Монтажна група"
                value={form.signature_team}
                onSign={() => setSigOpen("team")}
                onClear={() => update("signature_team", null)}
              />
              <SignatureBlock
                label="Подпис на клиента"
                value={form.signature_client}
                onSign={() => setSigOpen("client")}
                onClear={() => update("signature_client", null)}
              />

              {/* Действия след подписване */}
              {isSigned && savedId && (
                <div className="space-y-3 pt-4 border-t border-slate-200">
                  <button
                    onClick={() => void downloadPdf()}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white py-3.5 rounded-xl font-semibold text-sm active:bg-slate-700"
                  >
                    <Download className="w-5 h-5" />
                    Свали PDF
                  </button>
                  {!sendEmail ? (
                    <button
                      onClick={() => setSendEmail(true)}
                      className="w-full flex items-center justify-center gap-2 border-2 border-blue-600 text-blue-600 py-3.5 rounded-xl font-semibold text-sm active:bg-blue-50"
                    >
                      <Mail className="w-5 h-5" />
                      Изпрати на клиента
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="email"
                        value={emailInput}
                        onChange={e => setEmailInput(e.target.value)}
                        placeholder="Имейл на клиента"
                        className="w-full text-base border-2 border-slate-200 focus:border-blue-500 rounded-xl px-4 py-3 outline-none"
                      />
                      {sent ? (
                        <div className="flex items-center justify-center gap-2 text-green-600 font-semibold text-sm py-2">
                          <CheckCircle2 className="w-5 h-5" />
                          Изпратено успешно!
                        </div>
                      ) : (
                        <button
                          onClick={doSendEmail}
                          disabled={sending || !emailInput}
                          className="w-full flex items-center justify-center gap-2 bg-blue-600 disabled:bg-slate-400 text-white py-3.5 rounded-xl font-semibold text-sm active:bg-blue-700"
                        >
                          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                          {sending ? "Изпраща се..." : "Изпрати"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Грешка */}
          {online && pendingSync && pendingSampleError && (
            <div className="mt-4 bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-xl px-4 py-3">
              <p className="font-semibold">Протоколът не се качи автоматично</p>
              <p className="mt-1 text-amber-800">{parseOfflineApiError(pendingSampleError) ?? pendingSampleError}</p>
              <button
                type="button"
                onClick={() => void syncNow()}
                disabled={isSyncing}
                className="mt-2 text-xs font-bold text-amber-900 underline disabled:opacity-50"
              >
                {isSyncing ? "Качване…" : "Опитай отново"}
              </button>
            </div>
          )}
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Навигация Назад / Напред ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between md:justify-center md:gap-4">
          <button
            onClick={() => { setStep(s => s - 1); setError(null); setFieldErrors({}); }}
            disabled={step === 0}
            className="flex items-center justify-center gap-1.5 min-w-[3rem] h-12 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold disabled:opacity-30 shrink-0 active:bg-slate-50 transition-colors md:px-5"
            title="Назад"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden md:inline text-sm">Назад</span>
          </button>

          {isLastStep ? (
            <button
              onClick={finalize}
              disabled={saving || isSigned}
              className="flex items-center gap-2 bg-green-600 disabled:bg-slate-300 text-white px-5 h-12 rounded-xl font-bold text-sm active:bg-green-700 shrink-0 shadow-sm shadow-green-200 transition-colors"
            >
              {saving
                ? <><Loader2 className="w-5 h-5 animate-spin" /> Запазва се…</>
                : isSigned
                  ? <><CheckCircle2 className="w-5 h-5" /> Подписан</>
                  : <><Check className="w-5 h-5" /> Финализирай</>
              }
            </button>
          ) : (
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 px-5 h-12 rounded-xl bg-brand-orange-500 text-white font-bold text-sm active:bg-brand-orange-600 shrink-0 shadow-sm shadow-brand-orange-200 transition-colors"
            >
              Напред
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Canvas за подпис ── */}
      {sigOpen && (
        <SignatureCanvas
          label={sigOpen === "team" ? "Подпис — Монтажна група" : "Подпис на клиента"}
          existing={sigOpen === "team" ? form.signature_team : form.signature_client}
          onSave={dataUrl => {
            if (sigOpen === "team")   update("signature_team",   dataUrl);
            else                      update("signature_client", dataUrl);
            setSigOpen(null);
          }}
          onClose={() => setSigOpen(null)}
        />
      )}
    </div>
  );
}

// ─── Малки помощни компоненти ─────────────────────────────────────────────────

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs font-semibold text-red-600">{error}</p>}
    </div>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-10 h-10 rounded-l-lg border-2 border-slate-200 text-slate-600 font-bold text-lg active:bg-slate-100 flex items-center justify-center"
      >
        −
      </button>
      <div className="w-12 h-10 border-t-2 border-b-2 border-slate-200 flex items-center justify-center text-sm font-semibold text-slate-800">
        {value}
      </div>
      <button
        onClick={() => onChange(value + 1)}
        className="w-10 h-10 rounded-r-lg border-2 border-slate-200 text-slate-600 font-bold text-lg active:bg-slate-100 flex items-center justify-center"
      >
        +
      </button>
    </div>
  );
}

function MaterialStepGroup({
  materials, values, onChange,
}: {
  materials: typeof LEFT_MATERIALS;
  values: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
}) {
  return (
    <div className="space-y-0 divide-y divide-slate-100">
      {materials.map(mat => {
        const val = values[mat.id] ?? 0;
        return (
          <div key={mat.id} className="flex items-center justify-between py-3">
            <div className="flex-1 pr-3">
              <p className="text-sm text-slate-800 leading-snug">{mat.name}</p>
              <p className="text-xs text-slate-400">{mat.unit}</p>
            </div>
            <Stepper
              value={val}
              onChange={v => onChange({ ...values, [mat.id]: v })}
            />
          </div>
        );
      })}
    </div>
  );
}

/** Стъпка 2 — Главни монтажни елементи, разгрупирани по категория. */
function PrimaryMaterialsStep({
  values, onChange,
}: {
  values: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
}) {
  const groups: { title: string; ids: string[] }[] = [
    {
      title: "Тръби",
      ids: ["pri_pipe_f6", "pri_pipe_f10", "pri_pipe_f12", "pri_gofre"],
    },
    {
      title: "Кабели & изолация",
      ids: ["pri_kabel_3x15", "pri_kabel_3x25", "pri_svt_3x25", "pri_izolatsia"],
    },
    {
      title: "Стойки & монтаж",
      ids: ["pri_stoiki_4055", "pri_shaiba_f8", "pri_bolt_8x30", "pri_gaika_f8"],
    },
    {
      title: "Дюбели & винтове Ф10",
      ids: [
        "pri_dyubel_10x80",  "pri_vint_7x80",
        "pri_dyubel_10x100", "pri_vint_7x100",
        "pri_dyubel_10x120", "pri_vint_7x120",
        "pri_dyubel_10x140", "pri_vint_7x140",
        "pri_dyubel_10x160", "pri_vint_7x160",
      ],
    },
    {
      title: "Специални дюбели",
      ids: ["pri_dyubel_16x200", "pri_dyubel_8x60", "pri_vint_5x70"],
    },
  ];

  return (
    <div className="space-y-4">
      {groups.map(group => (
        <div key={group.title}>
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-0.5">
            {group.title}
          </div>
          <div className="rounded-xl bg-white border border-slate-100 divide-y divide-slate-100">
            {group.ids.map(id => {
              const mat = PRIMARY_MATERIALS.find(m => m.id === id);
              if (!mat) return null;
              const val = values[mat.id] ?? 0;
              return (
                <div key={mat.id} className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex-1 pr-3">
                    <p className="text-sm text-slate-800 leading-snug font-medium">{mat.name}</p>
                    <p className="text-xs text-slate-400">{mat.unit}</p>
                  </div>
                  <Stepper
                    value={val}
                    onChange={v => onChange({ ...values, [mat.id]: v })}
                  />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SignatureBlock({
  label, value, onSign, onClear,
}: {
  label: string;
  value: string | null;
  onSign: () => void;
  onClear: () => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 mb-2">{label}</p>
      {value ? (
        <div className="relative border-2 border-green-300 rounded-xl overflow-hidden bg-white">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt={label}
            className="w-full h-32 object-contain"
          />
          <button
            onClick={onClear}
            className="absolute top-2 right-2 bg-red-100 text-red-600 rounded-lg p-1.5 active:bg-red-200"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={onSign}
          className="w-full h-28 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 active:bg-slate-50"
        >
          <PenLine className="w-7 h-7" />
          <span className="text-sm">Докосни за подпис</span>
        </button>
      )}
    </div>
  );
}
