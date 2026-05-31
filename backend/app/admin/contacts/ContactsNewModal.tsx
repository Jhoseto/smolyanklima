"use client";

import { X, UserPlus, Plus, Trash2 } from "lucide-react";
import { Button, Input, Select, Textarea } from "../ui";

type ContactKind = "client" | "supplier";

type PhoneDraft = { phone: string; label: string };

export type NewContactForm = {
  fullName: string;
  phone: string;
  additionalPhones: PhoneDraft[];
  email: string;
  address: string;
  notes: string;
  contactKind: ContactKind;
  customerStatus: "new" | "active" | "vip" | "lost";
  nextFollowUpAt: string;
};

type Theme = {
  titleSingular: string;
  titleSingularCapital: string;
  accentText: string;
  accentBorderSoft: string;
  accentRing: string;
};

type Props = {
  open: boolean;
  kind: ContactKind;
  theme: Theme;
  form: NewContactForm;
  creating: boolean;
  onChange: (updater: (prev: NewContactForm) => NewContactForm) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function ContactsNewModal({
  open,
  kind,
  theme,
  form,
  creating,
  onChange,
  onClose,
  onSubmit,
}: Props) {
  if (!open) return null;

  const primaryBtn =
    kind === "client"
      ? "bg-brand-blue-500 hover:bg-brand-blue-600 active:bg-brand-blue-700"
      : "bg-brand-orange-500 hover:bg-brand-orange-600 active:bg-brand-orange-700";

  const dashedBtn =
    kind === "client"
      ? "border-brand-blue-300 text-brand-blue-700 hover:bg-brand-blue-50"
      : "border-brand-orange-300 text-brand-orange-700 hover:bg-brand-orange-50";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end bg-slate-950/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full md:w-[min(480px,100vw)] md:max-h-none max-h-[92dvh] flex flex-col bg-white md:border-l border-slate-200 shadow-2xl rounded-t-3xl md:rounded-none overflow-hidden pb-safe md:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 md:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className={`flex items-start justify-between gap-3 px-5 py-4 border-b ${theme.accentBorderSoft} shrink-0`}>
          <div>
            <div className={`text-[10px] font-black uppercase tracking-widest ${theme.accentText}`}>
              Нов запис
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-0.5">
              {theme.titleSingularCapital}
            </h2>
            <p className="text-xs text-slate-500 mt-1">Полетата с * са задължителни.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"
            aria-label="Затвори"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
          <label className="block">
            <span className="block text-xs font-bold text-slate-600 mb-1">
              {kind === "client" ? "Име и фамилия *" : "Име на фирма / лице *"}
            </span>
            <Input
              autoFocus
              value={form.fullName}
              onChange={(e) => onChange((f) => ({ ...f, fullName: e.target.value }))}
              placeholder={kind === "client" ? "напр. Иван Петров" : "напр. Daikin Bulgaria ЕООД"}
            />
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-slate-600 mb-1">Основен телефон *</span>
            <Input
              value={form.phone}
              onChange={(e) => onChange((f) => ({ ...f, phone: e.target.value }))}
              placeholder="напр. 0888 58 58 16"
            />
          </label>

          {form.additionalPhones.length > 0 && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Допълнителни телефони
              </div>
              {form.additionalPhones.map((p, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-1.5 items-center">
                  <Input
                    value={p.phone}
                    onChange={(e) =>
                      onChange((f) => ({
                        ...f,
                        additionalPhones: f.additionalPhones.map((it, i) =>
                          i === idx ? { ...it, phone: e.target.value } : it,
                        ),
                      }))
                    }
                    placeholder="Телефон"
                    className="text-xs"
                  />
                  <Input
                    value={p.label}
                    onChange={(e) =>
                      onChange((f) => ({
                        ...f,
                        additionalPhones: f.additionalPhones.map((it, i) =>
                          i === idx ? { ...it, label: e.target.value } : it,
                        ),
                      }))
                    }
                    placeholder="Етикет"
                    className="text-xs"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange((f) => ({
                        ...f,
                        additionalPhones: f.additionalPhones.filter((_, i) => i !== idx),
                      }))
                    }
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                    title="Премахни"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() =>
              onChange((f) => ({
                ...f,
                additionalPhones: [...f.additionalPhones, { phone: "", label: "" }],
              }))
            }
            className={`w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed text-xs font-semibold transition-colors ${dashedBtn}`}
          >
            <Plus className="w-3.5 h-3.5" /> Добави още телефон
          </button>

          <label className="block">
            <span className="block text-xs font-bold text-slate-600 mb-1">Имейл</span>
            <Input value={form.email} onChange={(e) => onChange((f) => ({ ...f, email: e.target.value }))} />
          </label>

          <label className="block">
            <span className="block text-xs font-bold text-slate-600 mb-1">Адрес</span>
            <Input value={form.address} onChange={(e) => onChange((f) => ({ ...f, address: e.target.value }))} />
          </label>

          {kind === "client" && (
            <label className="block">
              <span className="block text-xs font-bold text-slate-600 mb-1">Статус клиент</span>
              <Select
                value={form.customerStatus}
                onChange={(e) =>
                  onChange((f) => ({
                    ...f,
                    customerStatus: e.target.value as NewContactForm["customerStatus"],
                  }))
                }
              >
                <option value="new">Нов</option>
                <option value="active">Активен</option>
                <option value="vip">VIP</option>
                <option value="lost">Загубен</option>
              </Select>
            </label>
          )}

          <label className="block">
            <span className="block text-xs font-bold text-slate-600 mb-1">Бележка</span>
            <Textarea value={form.notes} onChange={(e) => onChange((f) => ({ ...f, notes: e.target.value }))} rows={3} />
          </label>
        </div>

        <div className="border-t border-slate-100 px-5 py-4 flex gap-2 shrink-0">
          <Button variant="secondary" onClick={onClose} disabled={creating} className="flex-1">
            Отказ
          </Button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={creating || !form.fullName.trim() || !form.phone.trim()}
            className={`flex-[2] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${primaryBtn}`}
          >
            <UserPlus className="w-4 h-4" />
            {creating ? "Създаване..." : `Създай ${theme.titleSingular}`}
          </button>
        </div>
      </div>
    </div>
  );
}
