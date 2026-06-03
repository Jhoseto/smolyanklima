"use client";

import { Button, AdminPhoneLink } from "./ui";

export type ConsultationCompletePreview = {
  title: string;
  customerName?: string | null;
  customerPhone?: string | null;
  dueDate?: string | null;
  kind?: "consultation" | "contact" | "task";
};

function formatDueDateBg(due: string | null | undefined): string {
  if (!due) return "без дата";
  return new Date(`${String(due).slice(0, 10)}T00:00:00`).toLocaleDateString("bg-BG");
}

function buildCopy(preview: ConsultationCompletePreview) {
  const who = preview.customerName?.trim() || "контакта";
  const phone = preview.customerPhone?.trim();
  const when = formatDueDateBg(preview.dueDate);
  const contactLine = phone ? `${who} (${phone})` : who;

  if (preview.kind === "contact") {
    return {
      title: "Завършване на обаждане",
      description: `Ще маркирате CRM обаждането с ${contactLine} на ${when} като завършено. Планираното follow-up излиза от чакащите.`,
      eventLabel: "CRM обаждане",
      confirmLabel: "Завърши",
    };
  }

  if (preview.kind === "task") {
    return {
      title: "Завършване на задача",
      description: `Ще маркирате задачата „${preview.title}“ с ${contactLine} на ${when} като завършена. Свързаното CRM follow-up се нулира.`,
      eventLabel: "Задача",
      confirmLabel: "Завърши",
    };
  }

  return {
    title: "Завършване на консултация",
    description: `Ще маркирате обаждането за консултация с ${contactLine} на ${when} като завършено. Събитието излиза от чакащите обаждания; планираното CRM follow-up се нулира.`,
    eventLabel: "Консултация",
    confirmLabel: "Завърши",
  };
}

export function ConsultationCompleteConfirmModal({
  preview,
  savingBusy,
  onCancel,
  onConfirm,
}: {
  preview: ConsultationCompletePreview;
  savingBusy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const copy = buildCopy(preview);
  const who = preview.customerName?.trim();
  const phone = preview.customerPhone?.trim();

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-4 backdrop-blur-md md:items-center"
      onClick={() => !savingBusy && onCancel()}
    >
      <div
        className="w-full max-w-lg rounded-t-3xl border border-white/70 bg-white p-6 shadow-[0_-8px_40px_rgba(15,23,42,0.25)] md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex justify-center md:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>
        <div className="text-xs font-bold uppercase tracking-wide text-green-700">
          Маркиране като завършено
        </div>
        <div className="mt-1 text-xl font-black text-slate-950">{copy.title}</div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">{copy.description}</p>
        <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <div>
            <span className="font-semibold text-slate-500">Събитие: </span>
            <span className="font-semibold text-slate-900">{copy.eventLabel}</span>
          </div>
          <div>
            <span className="font-semibold text-slate-500">Заглавие: </span>
            <span className="font-semibold text-slate-900">{preview.title}</span>
          </div>
          {who ? (
            <div>
              <span className="font-semibold text-slate-500">Клиент: </span>
              <span className="font-semibold text-slate-900">{who}</span>
              {phone ? (
                <>
                  <span className="text-slate-400"> · </span>
                  <AdminPhoneLink phone={phone} showIcon={false} className="text-slate-600 text-sm" />
                </>
              ) : null}
            </div>
          ) : null}
          <div>
            <span className="font-semibold text-slate-500">Дата: </span>
            <span className="font-semibold text-slate-900">{formatDueDateBg(preview.dueDate)}</span>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancel} disabled={savingBusy}>
            Отказ
          </Button>
          <Button
            variant="primary"
            className="!border-green-700 !bg-green-600 hover:!bg-green-700"
            onClick={onConfirm}
            disabled={savingBusy}
          >
            {savingBusy ? "Запис..." : copy.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
