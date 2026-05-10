"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ChevronLeft, ChevronRight, Check, Download, Mail,
  PenLine, Trash2, X, Loader2, CheckCircle2,
} from "lucide-react";
import {
  PROTOCOL_MATERIALS, LEFT_MATERIALS, RIGHT_MATERIALS,
  MOUNT_TYPES, EMPTY_ACCESSORIES, ACCESSORIES_LABELS,
} from "@/lib/protocol-materials";
import type { AccessoriesEntry, MaterialEntry } from "@/lib/protocol-materials";
import { SignatureCanvas } from "./SignatureCanvas";
import { ProductAutocomplete } from "./ProductAutocomplete";

// ─── Типове ──────────────────────────────────────────────────────────────────

interface FormData {
  work_item_id:     string | null;
  date:             string;
  client_name:      string;
  ac_model:         string;
  serial_number:    string;
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
  status:           "draft" | "signed" | "sent";
}

const defaultForm = (): FormData => ({
  work_item_id:     null,
  date:             new Date().toISOString().slice(0, 10),
  client_name:      "",
  ac_model:         "",
  serial_number:    "",
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
  status:           "draft",
});

interface Props {
  protocolId?: string;
  initialData?: Partial<FormData>;
  onClose: () => void;
  onSaved: (id: string) => void;
}

const STEPS = [
  "Основна информация",
  "Начин на монтаж",
  "Тръби & дюбели",
  "Кабели & стойки",
  "Кабелни канали",
  "Забележки",
  "Подписи",
] as const;

// ─── Главен компонент ────────────────────────────────────────────────────────

export function ProtocolFormWizard({ protocolId, initialData, onClose, onSaved }: Props) {
  const [step, setStep]     = useState(0);
  const [form, setForm]     = useState<FormData>({ ...defaultForm(), ...initialData });
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(protocolId ?? null);
  const [sigOpen, setSigOpen] = useState<"team" | "client" | null>(null);
  const [sendEmail, setSendEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(initialData?.client_email ?? "");
  const [sending, setSending] = useState(false);
  const [sent, setSent]      = useState(false);
  const [error, setError]    = useState<string | null>(null);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Автоматично запазване при смяна на данните
  // Не стартира auto-save ако формулярът е все още напълно празен (нищо не е въведено)
  const autoSave = useCallback(async (data: FormData, id: string | null) => {
    const hasContent = data.client_name || data.ac_model || data.serial_number ||
      data.address || data.paid_amount || data.client_phone || data.client_email ||
      data.mount_types.length > 0 || Object.values(data.materials).some(v => v > 0);
    if (!hasContent && !id) return; // Не запазвай напълно празен протокол

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

  // ── Запазване в API ───────────────────────────────────────────────────────

  const persistForm = async (data: FormData, id: string | null, showSaving = true) => {
    if (showSaving) setSaving(true);
    setError(null);
    try {
      // Само полетата, очаквани от API-то
      const payload = {
        work_item_id:     data.work_item_id,
        date:             data.date || new Date().toISOString().slice(0, 10),
        client_name:      data.client_name || null,
        ac_model:         data.ac_model || null,
        serial_number:    data.serial_number || null,
        address:          data.address || null,
        paid_amount:      data.paid_amount ? parseFloat(data.paid_amount) : null,
        client_email:     data.client_email || null,
        client_phone:     data.client_phone || null,
        mount_types:      data.mount_types,
        materials:        PROTOCOL_MATERIALS
          .filter(m => (data.materials[m.id] ?? 0) > 0)
          .map(m => ({ id: m.id, name: m.name, unit: m.unit, qty: data.materials[m.id] })) as MaterialEntry[],
        cable_channels_m: data.cable_channels_m ? parseFloat(data.cable_channels_m) : 0,
        accessories:      data.accessories,
        notes:            data.notes || null,
        signature_team:   data.signature_team,
        signature_client: data.signature_client,
        status:           data.status,
      };

      if (id) {
        const res = await fetch(`/api/admin/service/protocols/${id}`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Грешка при запазване");
      } else {
        const res = await fetch("/api/admin/service/protocols", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? "Грешка при запазване");
        const { data: created } = await res.json();
        setSavedId(created.id);
        onSaved(created.id);
        return created.id as string;
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Грешка");
    } finally {
      if (showSaving) setSaving(false);
    }
    return id;
  };

  // Финализиране + подписи
  const finalize = async () => {
    const updated = { ...form, status: "signed" as const };
    setForm(updated);
    const id = await persistForm(updated, savedId, true);
    if (id) setSavedId(id);
  };

  // Изпращане на имейл
  const doSendEmail = async () => {
    if (!savedId || !emailInput) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/service/protocols/${savedId}/email`, {
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

  // PDF сваляне
  const downloadPdf = () => {
    if (!savedId) return;
    window.open(`/api/admin/service/protocols/${savedId}/pdf`, "_blank");
  };

  const isLastStep = step === STEPS.length - 1;
  const isSigned   = form.status === "signed" || form.status === "sent";

  // ─── Рендер стъпка ────────────────────────────────────────────────────────

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
        {/* Прогрес лента */}
        <div className="h-1 bg-slate-100">
          <div
            className="h-1 bg-blue-600 transition-all duration-300"
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
                <input
                  type="date" value={form.date}
                  onChange={e => update("date", e.target.value)}
                  className="w-full text-base border-b-2 border-slate-300 focus:border-blue-500 outline-none py-2 bg-transparent"
                />
              </Field>
              <Field label="Клиент">
                <input
                  type="text" value={form.client_name} placeholder="Иван Иванов"
                  onChange={e => update("client_name", e.target.value)}
                  className="w-full text-base border-b-2 border-slate-300 focus:border-blue-500 outline-none py-2 bg-transparent"
                />
              </Field>
              <ProductAutocomplete
                label="Модел климатик"
                value={form.ac_model}
                placeholder="Daikin FTXM25N..."
                onChange={(name) => update("ac_model", name)}
              />
              <Field label="Сериен номер">
                <input
                  type="text" value={form.serial_number}
                  onChange={e => update("serial_number", e.target.value)}
                  className="w-full text-base border-b-2 border-slate-300 focus:border-blue-500 outline-none py-2 bg-transparent"
                />
              </Field>
              <Field label="Адрес">
                <input
                  type="text" value={form.address} placeholder="гр. Смолян, ул. ..."
                  onChange={e => update("address", e.target.value)}
                  className="w-full text-base border-b-2 border-slate-300 focus:border-blue-500 outline-none py-2 bg-transparent"
                />
              </Field>
              <Field label="Платена сума (€)">
                <input
                  type="number" value={form.paid_amount} placeholder="0.00" min="0" step="0.01"
                  onChange={e => update("paid_amount", e.target.value)}
                  className="w-full text-base border-b-2 border-slate-300 focus:border-blue-500 outline-none py-2 bg-transparent"
                />
              </Field>
              <Field label="Телефон на клиента">
                <input
                  type="tel" value={form.client_phone} placeholder="0888 123 456"
                  onChange={e => update("client_phone", e.target.value)}
                  className="w-full text-base border-b-2 border-slate-300 focus:border-blue-500 outline-none py-2 bg-transparent"
                />
              </Field>
              <Field label="Имейл на клиента (за изпращане)">
                <input
                  type="email" value={form.client_email} placeholder="client@example.com"
                  onChange={e => { update("client_email", e.target.value); setEmailInput(e.target.value); }}
                  className="w-full text-base border-b-2 border-slate-300 focus:border-blue-500 outline-none py-2 bg-transparent"
                />
              </Field>
            </div>
          )}

          {/* ──────────── Стъпка 1: Начин на монтаж ──────────── */}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-3">
              {MOUNT_TYPES.map(type => {
                const active = form.mount_types.includes(type);
                return (
                  <button
                    key={type}
                    onClick={() => {
                      const next = active
                        ? form.mount_types.filter(t => t !== type)
                        : [...form.mount_types, type];
                      update("mount_types", next);
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

          {/* ──────────── Стъпка 2: Тръби & дюбели (ляв стълб) ──────────── */}
          {step === 2 && (
            <MaterialStepGroup
              materials={LEFT_MATERIALS}
              values={form.materials}
              onChange={vals => update("materials", vals)}
            />
          )}

          {/* ──────────── Стъпка 3: Кабели & стойки (десен стълб) ──────────── */}
          {step === 3 && (
            <MaterialStepGroup
              materials={RIGHT_MATERIALS}
              values={form.materials}
              onChange={vals => update("materials", vals)}
            />
          )}

          {/* ──────────── Стъпка 4: Кабелни канали & аксесоари ──────────── */}
          {step === 4 && (
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
                      onChange={v => update("accessories", { ...form.accessories, [k]: v })}
                    />
                  </div>
                ))}
            </div>
          )}

          {/* ──────────── Стъпка 5: Забележки ──────────── */}
          {step === 5 && (
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

          {/* ──────────── Стъпка 6: Подписи ──────────── */}
          {step === 6 && (
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
                    onClick={downloadPdf}
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
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* ── Навигация Назад / Напред ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 flex gap-3 safe-bottom">
        <button
          onClick={() => { setStep(s => s - 1); setError(null); }}
          disabled={step === 0}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold text-sm disabled:opacity-30"
        >
          <ChevronLeft className="w-5 h-5" />
          Назад
        </button>

        <div className="flex-1" />

        {isLastStep ? (
          <button
            onClick={finalize}
            disabled={saving || isSigned}
            className="flex items-center gap-2 bg-green-600 disabled:bg-slate-400 text-white px-5 py-3 rounded-xl font-semibold text-sm active:bg-green-700"
          >
            {saving
              ? <><Loader2 className="w-5 h-5 animate-spin" /> Запазва се...</>
              : isSigned
                ? <><CheckCircle2 className="w-5 h-5" /> Подписан</>
                : <><Check className="w-5 h-5" /> Финализирай</>
            }
          </button>
        ) : (
          <button
            onClick={() => { setStep(s => s + 1); setError(null); }}
            className="flex items-center gap-1.5 px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold text-sm active:bg-blue-700"
          >
            Напред
            <ChevronRight className="w-5 h-5" />
          </button>
        )}
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">
        {label}
      </label>
      {children}
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
