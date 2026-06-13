"use client";

import { useState, useEffect, useMemo } from "react";
import { X, Pencil, Download, Loader2, Mail, PlayCircle } from "lucide-react";
import { Logo } from "@/app/admin/ui/Logo";
import { useAdminBackHandler } from "@/app/admin/ui";
import type { AdminRole } from "@/lib/admin/db";
import {
  PDF_LEFT_MATERIALS,
  PDF_RIGHT_MATERIALS,
  ACCESSORIES_LABELS,
  EMPTY_ACCESSORIES,
} from "@/lib/protocol-materials";
import type { AccessoriesEntry, MaterialEntry, ProtocolMaterial } from "@/lib/protocol-materials";
import { ProtocolPhotosGallery } from "./ProtocolPhotosGallery";
import { SignatureDisplay } from "./SignatureDisplay";

interface Props {
  protocolId: string;
  protocolNumber: string;
  clientLabel: string;
  dateLabel: string;
  role: AdminRole;
  onClose: () => void;
  onEdit: () => void;
}

interface ProtocolRow {
  id: string;
  protocol_number: string;
  date: string;
  client_name: string | null;
  ac_model: string | null;
  serial_number: string | null;
  indoor_unit_serial: string | null;
  outdoor_unit_serial: string | null;
  address: string | null;
  paid_amount: number | null;
  client_email: string | null;
  client_phone: string | null;
  mount_types: string[] | null;
  materials: MaterialEntry[] | null;
  cable_channels_m: number | null;
  accessories: Record<string, number> | null;
  notes: string | null;
  photo_urls: string[] | null;
  signature_team: string | null;
  signature_client: string | null;
  status: string;
}

function mergeAccessories(raw: Record<string, number> | null | undefined): AccessoriesEntry {
  const out = { ...EMPTY_ACCESSORIES };
  if (!raw || typeof raw !== "object") return out;
  (Object.keys(EMPTY_ACCESSORIES) as (keyof AccessoriesEntry)[]).forEach(k => {
    const v = raw[k];
    if (typeof v === "number" && !Number.isNaN(v)) out[k] = v;
  });
  return out;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const MOUNT_ROWS: string[][] = [
  ["вишка", "скеле", "тераса"],
  ["под прозорец", "наземен", "демонтаж"],
  ["камък", "тухла", "бетон", "друго"],
];

export function ProtocolPreview({
  protocolId,
  protocolNumber,
  clientLabel,
  dateLabel,
  role,
  onClose,
  onEdit,
}: Props) {
  const [row, setRow] = useState<ProtocolRow | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailTo, setEmailTo] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  useAdminBackHandler(true, onClose, `protocol-preview-${protocolId}`);

  const status = row?.status as "prepared" | "in_progress" | "signed" | undefined;
  const isFinished = status === "signed";
  const canContinue =
    !isFinished &&
    !!status &&
    (role === "master_admin" || role === "office_staff" || role === "service_staff");
  const canEditFinished = isFinished && (role === "master_admin" || role === "office_staff");

  const pdfUrl = `/api/admin/service/protocols/${protocolId}/pdf`;

  useEffect(() => {
    setEmailTo("");
    setEmailFeedback(null);
  }, [protocolId]);

  useEffect(() => {
    const em = row?.client_email?.trim();
    if (em) setEmailTo(em);
  }, [row?.client_email]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadErr(null);
      try {
        const res = await fetch(`/api/admin/service/protocols/${protocolId}`, {
          credentials: "include",
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? "Грешка при зареждане");
        if (!cancelled) setRow(json.data as ProtocolRow);
      } catch (e) {
        if (!cancelled) setLoadErr(e instanceof Error ? e.message : "Грешка");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [protocolId]);

  const qtyMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const x of row?.materials ?? []) {
      if (x?.id) m[x.id] = x.qty;
    }
    return m;
  }, [row?.materials]);

  const acc = useMemo(() => mergeAccessories(row?.accessories ?? undefined), [row?.accessories]);
  const cableChannelsM = Number(row?.cable_channels_m ?? acc.cable_channels_m ?? 0);

  const mountSet = useMemo(() => new Set(row?.mount_types ?? []), [row?.mount_types]);

  async function sendProtocolEmail() {
    const trimmed = emailTo.trim();
    if (!trimmed) {
      setEmailFeedback({ ok: false, text: "Въведете имейл адрес." });
      return;
    }
    setEmailBusy(true);
    setEmailFeedback(null);
    try {
      const res = await fetch(`/api/admin/service/protocols/${protocolId}/email`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string; skipped?: boolean };
      if (!res.ok) throw new Error(json.error ?? "Грешка при изпращане");
      const skipped = Boolean(json.skipped);
      setEmailFeedback({
        ok: true,
        text: skipped ? "Имейл услугата не е конфигурирана — изпращането е пропуснато." : "Протоколът е изпратен на имейла.",
      });
      // Бел.: статусът на протокола НЕ се променя след изпращане —
      // жизненият цикъл (виж миграция 0036) е prepared → in_progress →
      // signed, а изпращането по имейл е странично действие, което може
      // да се повтори многократно за един и същ подписан протокол.
    } catch (e) {
      setEmailFeedback({
        ok: false,
        text: e instanceof Error ? e.message : "Грешка при изпращане",
      });
    } finally {
      setEmailBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Преглед на протокол"
    >
      <div className="flex flex-1 flex-col bg-slate-100 w-full h-full md:max-w-3xl md:mx-auto md:my-3 md:rounded-2xl md:shadow-2xl md:max-h-[calc(100vh-1.5rem)] overflow-hidden border border-slate-200 md:border-0">
        {/* Лента */}
        <div className="border-b border-slate-200 bg-white shrink-0 safe-top">
          <div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
            <button
              type="button"
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              aria-label="Затвори"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0 basis-[min(100%,180px)]">
              <p className="text-sm font-bold text-slate-900 truncate">{protocolNumber}</p>
              <p className="text-xs text-slate-500 truncate">
                {clientLabel || "—"} · {dateLabel}
              </p>
            </div>
            {isFinished && (
              <button
                type="button"
                onClick={async () => {
                  try {
                    const res = await fetch(pdfUrl, { credentials: "include" });
                    if (!res.ok) { window.open(pdfUrl, "_blank"); return; }
                    const blob = await res.blob();
                    const objectUrl = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = objectUrl;
                    a.download = `protocol.pdf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(objectUrl);
                  } catch { window.open(pdfUrl, "_blank"); }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 shrink-0"
              >
                <Download className="w-4 h-4" />
                PDF
              </button>
            )}
            {canContinue && (
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shrink-0 shadow-sm"
              >
                <PlayCircle className="w-4 h-4" />
                Довърши
              </button>
            )}
            {canEditFinished && (
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 text-slate-800 text-sm font-semibold hover:bg-slate-200 shrink-0"
              >
                <Pencil className="w-4 h-4" />
                Редактирай
              </button>
            )}
          </div>
          {!loading && !loadErr && row ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 pb-3 sm:px-4 sm:pb-3 pt-0 border-t border-slate-100">
              <label className="sr-only" htmlFor={`proto-email-${protocolId}`}>
                Имейл за изпращане на протокола
              </label>
              <input
                id={`proto-email-${protocolId}`}
                type="email"
                autoComplete="email"
                placeholder="Имейл на получателя"
                value={emailTo}
                onChange={e => { setEmailTo(e.target.value); setEmailFeedback(null); }}
                className="flex-1 min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-brand-blue-400"
              />
              <button
                type="button"
                disabled={emailBusy}
                onClick={() => void sendProtocolEmail()}
                className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 shrink-0"
              >
                {emailBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Изпрати имейл
              </button>
              {emailFeedback ? (
                <p
                  className={`text-xs font-medium sm:ml-1 ${emailFeedback.ok ? "text-emerald-700" : "text-red-600"}`}
                  role="status"
                >
                  {emailFeedback.text}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Преглед като формуляр */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4">
          {loading && (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
            </div>
          )}
          {!loading && loadErr && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {loadErr}
            </div>
          )}
          {!loading && !loadErr && row && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm text-[13px] text-slate-900 max-w-[720px] mx-auto">
              {/* Хедър бланка */}
              <div className="flex flex-wrap items-center border-b-2 border-black pb-3 mb-4 px-4 pt-4 gap-3">
                <div className="shrink-0 min-w-0">
                  <Logo size="sm" className="-ml-0.5" />
                </div>
                <div className="w-px bg-black shrink-0 self-stretch min-h-[44px] hidden sm:block" aria-hidden />
                <div className="flex-1 text-right min-w-0">
                  <p className="font-bold text-[11px] sm:text-xs leading-snug">
                    ПРИЕМНО-ПРЕДАВАТЕЛЕН ПРОТОКОЛ
                  </p>
                  <p className="text-sm font-semibold mt-1">№ {row.protocol_number}</p>
                  <p className="text-xs text-slate-600 mt-1">
                    от дата{" "}
                    <span className="inline-block min-w-[100px] border-b border-dotted border-slate-400 px-1">
                      {fmtDate(row.date)}
                    </span>
                  </p>
                </div>
              </div>

              <div className="px-4 pb-4 space-y-4">
                {/* Основни полета */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  <div className="space-y-2">
                    <PreviewField label="Клиент" value={row.client_name} />
                    <PreviewField label="Модел климатик" value={row.ac_model} />
                    <PreviewField label="Сериен № вътр." value={row.indoor_unit_serial ?? row.serial_number} />
                    <PreviewField label="Сериен № външ." value={row.outdoor_unit_serial} />
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[140px]">
                        <PreviewField label="Адрес" value={row.address} />
                      </div>
                      <div className="flex items-end gap-1 pb-0.5">
                        <span className="text-xs text-slate-500">км</span>
                        <span className="inline-block w-12 border-b border-dotted border-slate-400 text-center text-sm min-h-[22px]" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs text-slate-600">Платена сума:</span>
                      <span className="block border-b border-black border-dotted mt-0.5 pb-0.5 font-semibold">
                        {row.paid_amount != null ? `€${Number(row.paid_amount).toFixed(2)}` : "—"}
                      </span>
                    </div>
                    {(row.client_phone || row.client_email) && (
                      <div className="text-xs text-slate-600 space-y-1">
                        {row.client_phone ? <p>Тел.: {row.client_phone}</p> : null}
                        {row.client_email ? <p>Имейл: {row.client_email}</p> : null}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-slate-700 mb-2">Начин на монтаж:</p>
                      <div className="space-y-1.5">
                        {MOUNT_ROWS.map((line, i) => (
                          <div key={i} className="flex flex-wrap gap-x-4 gap-y-1">
                            {line.map(mt => (
                              <label key={mt} className="flex items-center gap-1.5 cursor-default">
                                <span
                                  className={`inline-flex w-3.5 h-3.5 border border-black shrink-0 items-center justify-center ${mountSet.has(mt) ? "bg-black" : "bg-white"}`}
                                >
                                  {mountSet.has(mt) ? (
                                    <span className="text-[8px] text-white leading-none">✓</span>
                                  ) : null}
                                </span>
                                <span className="text-[11px]">{mt}</span>
                              </label>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Таблица материали */}
                <div className="border border-black rounded-none overflow-hidden text-[11px]">
                  <div className="grid grid-cols-2 divide-x divide-black">
                    <MaterialColumn materials={PDF_LEFT_MATERIALS} qtyMap={qtyMap} />
                    <MaterialColumn materials={PDF_RIGHT_MATERIALS} qtyMap={qtyMap} />
                  </div>
                </div>

                {/* Кабелни канали */}
                <div className="border border-black p-2 space-y-2 text-[11px]">
                  <AccessoryRow label={ACCESSORIES_LABELS.cable_channels_m} value={cableChannelsM} />
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {(["outer_corner", "inner_corner", "angle_out", "connector"] as const).map(k => (
                      <AccessoryInline key={k} label={ACCESSORIES_LABELS[k]} value={acc[k]} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {(["inner_cap", "outer_cap", "end_cap", "holder"] as const).map(k => (
                      <AccessoryInline key={k} label={ACCESSORIES_LABELS[k]} value={acc[k]} />
                    ))}
                  </div>
                </div>

                {/* Забележки */}
                <div>
                  <p className="text-xs font-semibold mb-1">Забележки:</p>
                  <div className="border border-slate-300 min-h-[72px] p-2 text-sm whitespace-pre-wrap">
                    {row.notes?.trim() || "—"}
                  </div>
                </div>

                {/* Снимки от монтажа */}
                {Array.isArray(row.photo_urls) && row.photo_urls.length > 0 && (
                  <ProtocolPhotosGallery urls={row.photo_urls} compact />
                )}

                {/* Подписи */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-5 pt-4">
                  <SigBlock title="Монтажна група" src={row.signature_team} />
                  <SigBlock title="Подпис на клиента:" src={row.signature_client} />
                </div>

                <p className="text-center text-[10px] text-slate-500 pt-4 border-t border-slate-200 leading-relaxed">
                  Смолян Клима ЕООД, ЕИК: BG 204223522 гр. Смолян ул. Елица № 36 Тел: 0888 58 58 16
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-xs text-slate-600">{label}</span>
      <div className="border-b border-dotted border-slate-500 min-h-[22px] text-sm mt-0.5">
        {value?.trim() || ""}
      </div>
    </div>
  );
}

function MaterialColumn({
  materials,
  qtyMap,
}: {
  materials: ProtocolMaterial[];
  qtyMap: Record<string, number>;
}) {
  return (
    <div className="divide-y divide-black/40">
      {materials.map(mat => {
        const q = qtyMap[mat.id];
        const show = q != null && q > 0;
        return (
          <div key={mat.id} className="flex min-h-[26px]">
            <div className="flex-1 px-1.5 py-1 leading-snug">
              {mat.name}/{mat.unit}
            </div>
            <div className="w-9 border-l border-black/40 flex items-center justify-center font-medium tabular-nums">
              {show ? String(q) : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AccessoryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <span>{label}</span>
      <span className="inline-block min-w-[28px] border-b border-black text-center">{value > 0 ? value : ""}</span>
    </div>
  );
}

function AccessoryInline({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-end gap-1">
      <span className="text-[10px] leading-tight max-w-[120px]">{label}</span>
      <span className="inline-block min-w-[22px] border-b border-black text-center text-[11px]">
        {value > 0 ? value : ""}
      </span>
    </span>
  );
}

function SigBlock({ title, src }: { title: string; src: string | null }) {
  return (
    <div className="flex items-end gap-2.5 min-h-[88px]">
      <p className="text-[11px] font-semibold text-slate-900 shrink-0 w-[92px] leading-snug pb-2">
        {title}
      </p>
      <div className="flex-1 bg-white border-b-2 border-black min-h-[84px] flex items-end justify-center px-1 pb-0">
        {src ? (
          <SignatureDisplay
            src={src}
            className="max-h-[80px] w-full object-contain object-bottom"
          />
        ) : (
          <span className="text-[10px] text-slate-300 pb-2">—</span>
        )}
      </div>
    </div>
  );
}
