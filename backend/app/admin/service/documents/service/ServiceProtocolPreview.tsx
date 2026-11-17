"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Pencil, PlayCircle, X } from "lucide-react";
import { Logo } from "@/app/admin/ui/Logo";
import type { AdminRole } from "@/lib/admin/db";
import type { RepairProtocolPhase } from "@/lib/repair-protocol-fields";
import { REPAIR_PROTOCOL_STEPS, repairProtocolStepRows } from "@/lib/repair-protocol-steps";
import {
  repairProtocolDisplayStage, repairProtocolDocumentParts, type RepairProtocolDocument,
} from "@/lib/repair-protocol-presentation";
import { RepairProtocolStageBadge } from "./RepairProtocolStageBadge";

interface Props {
  protocolId: string;
  protocolNumber: string;
  clientLabel: string;
  dateLabel: string;
  role: AdminRole;
  onClose: () => void;
  onEdit: (phase?: RepairProtocolPhase) => void;
  stacked?: boolean;
}

export function ServiceProtocolPreview({
  protocolId, protocolNumber, clientLabel, dateLabel, role, onClose, onEdit, stacked = false,
}: Props) {
  const [row, setRow] = useState<RepairProtocolDocument | null>(null);
  const [loadError, setLoadError] = useState("");
  const [pdfError, setPdfError] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setRow(null);
    setLoadError("");
    setPdfError("");
    (async () => {
      try {
        const res = await fetch(`/api/admin/service/repair-protocols/${protocolId}`, {
          credentials: "include", signal: controller.signal,
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Грешка при зареждане");
        if (!controller.signal.aborted) setRow(json.data);
      } catch (error) {
        if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : "Грешка при зареждане");
      }
    })();
    return () => controller.abort();
  }, [protocolId]);

  async function downloadPdf() {
    if (pdfBusy) return;
    setPdfBusy(true);
    setPdfError("");
    try {
      const res = await fetch(`/api/admin/service/repair-protocols/${protocolId}/pdf`, { credentials: "include" });
      if (!res.ok) throw new Error("Неуспешно генериране на PDF.");
      const objectUrl = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `servizen-protokol-${protocolNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(objectUrl); }, 1000);
    } catch (error) {
      setPdfError(error instanceof Error ? error.message : "Неуспешно сваляне на PDF.");
    } finally {
      setPdfBusy(false);
    }
  }

  const stage = row ? repairProtocolDisplayStage(row) : null;
  const canCorrect = role === "master_admin" || role === "office_staff";
  const editLabel = stage === "intake" ? "Продължи завеждането"
    : stage === "received" || stage === "legacy_signed" ? "Започни издаване"
    : stage === "issuing" ? "Продължи издаването"
    : stage === "issued" && canCorrect ? "Редактирай издаването" : null;
  const parts = row ? repairProtocolDocumentParts(row) : [];

  return (
    <div
      className={stacked
        ? "fixed inset-0 z-[70] flex flex-col bg-black/25 md:flex-row md:justify-end md:pl-[min(34%,360px)]"
        : "fixed inset-0 z-50 flex flex-col bg-black/45 backdrop-blur-[2px]"}
      role="dialog" aria-modal="true" aria-label="Преглед на сервизен протокол"
    >
      <div className={`flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-slate-100 md:my-3 md:max-h-[calc(100vh-1.5rem)] md:rounded-2xl md:shadow-2xl ${stacked ? "md:mr-3 md:max-w-2xl" : "md:mx-auto md:max-w-3xl"}`}>
        <div className="safe-top shrink-0 border-b border-slate-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-600 hover:bg-slate-100" aria-label="Затвори">
              <X className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1 basis-40">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-bold text-slate-900">{protocolNumber}</p>
                {stage && <RepairProtocolStageBadge stage={stage} />}
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">{clientLabel} · {dateLabel}</p>
            </div>
            {row && (
              <button type="button" onClick={downloadPdf} disabled={pdfBusy} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60">
                {pdfBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PDF
              </button>
            )}
            {editLabel && (
              <button type="button" onClick={() => onEdit(stage === "intake" ? "intake" : "issue")} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-blue-800">
                <PlayCircle className="h-4 w-4" /> {editLabel}
              </button>
            )}
            {stage === "legacy_signed" && canCorrect && (
              <button type="button" onClick={() => onEdit("intake")} className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Pencil className="h-4 w-4" /> Коригирай стария протокол
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
          {!row && !loadError && <Loader2 aria-label="Зареждане" className="mx-auto my-20 h-8 w-8 animate-spin text-brand-blue-700" />}
          {(loadError || pdfError) && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError || pdfError}</p>}
          {row && (
            <article className="mx-auto max-w-[720px] space-y-5 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm sm:p-6">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-800 pb-3">
                <Logo size="sm" />
                <div className="text-right">
                  <h2 className="text-sm font-bold uppercase">Сервизен протокол</h2>
                  <p className="text-sm font-semibold">№ {row.protocol_number}</p>
                </div>
              </header>

              {REPAIR_PROTOCOL_STEPS.map(({ title }, step) => {
                const rowsByPart = parts.map(({ data }) => new Map(repairProtocolStepRows(data, step).map(({ label, value }) => [label, value])));
                const labels = Array.from(new Set(rowsByPart.flatMap((rows) => [...rows.keys()])));
                return (
                  <section key={step}>
                    <h3 className="mb-1.5 text-sm font-bold text-brand-blue-900">{title}</h3>
                    <table className="w-full table-fixed border-collapse text-left text-xs sm:text-sm">
                      <thead className="border-b border-slate-200 bg-slate-50">
                        <tr>
                          <th scope="col" className="w-[35%] px-2 py-1.5 font-medium text-slate-500">Поле</th>
                          {parts.map(({ title: partTitle }) => <th key={partTitle} scope="col" className="px-2 py-1.5 font-semibold">{partTitle}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {labels.map((label) => (
                          <tr key={label} className="border-b border-slate-100 align-top">
                            <th scope="row" className="break-words px-2 py-1.5 font-normal text-slate-600">{label}</th>
                            {rowsByPart.map((rows, i) => <td key={i} className="whitespace-pre-wrap break-words px-2 py-1.5 font-medium">{rows.get(label) ?? "—"}</td>)}
                          </tr>
                        ))}
                        {step === REPAIR_PROTOCOL_STEPS.length - 1 && (
                          <tr className="align-top">
                            <th scope="row" className="px-2 py-2 font-normal text-slate-600">Подпис на сервизен техник</th>
                            {parts.map(({ title: partTitle, data }) => (
                              <td key={partTitle} className="px-2 py-2">
                                {data.signature_team
                                  ? <img src={data.signature_team} alt={`Подпис · ${partTitle}`} className="max-h-16 max-w-full object-contain" />
                                  : <span className="text-slate-500">—</span>}
                              </td>
                            ))}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </section>
                );
              })}

              <footer className="border-t border-slate-200 pt-3 text-center text-[10px] text-slate-500">
                Смолян Клима ЕООД · ЕИК BG 204223522 · гр. Смолян, ул. Елица № 36 · 0878 58 16 16
              </footer>
            </article>
          )}
        </div>
      </div>
    </div>
  );
}
