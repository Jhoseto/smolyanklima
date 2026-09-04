"use client";

import { useState, useEffect } from "react";
import { X, Pencil, Download, Loader2, Star, PlayCircle, ClipboardCheck, Wrench, CheckCircle } from "lucide-react";
import { Logo } from "@/app/admin/ui/Logo";
import type { AdminRole } from "@/lib/admin/db";
import {
  FREON_CHARGE_LABEL, BEARINGS_LABEL, NOISE_LABEL, SERVICE_KIND_LABEL,
  type FreonChargeMethod, type BearingsState, type NoiseLevel, type RepairServiceKind,
} from "@/lib/repair-protocol-fields";

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
  client_phone: string | null;
  client_email: string | null;
  address: string | null;
  serial_number: string | null;

  ac_brand: string | null;
  ac_model: string | null;
  product_id: string | null;
  indoor_unit_serial: string | null;
  outdoor_unit_serial: string | null;

  is_japanese_brand: boolean | null;
  freon_charge_method: FreonChargeMethod | null;
  refrigerant_type: string | null;
  refrigerant_amount_g: number | null;

  vacuum_cleaning_done: boolean | null;
  valves_ok: boolean | null;
  outdoor_bearings_state: BearingsState | null;
  indoor_bearings_state: BearingsState | null;

  pressure_cold_bar: number | null;
  pressure_hot_bar: number | null;
  consumption_cold_kw: number | null;
  consumption_hot_kw: number | null;

  original_remote: boolean | null;
  outdoor_noise_level: NoiseLevel | null;

  welds_indoor_heat_exchanger: boolean | null;
  welds_outdoor_heat_exchanger: boolean | null;
  welds_pipes: boolean | null;
  indoor_mechanism_repaired: boolean | null;
  broken_turbine: boolean | null;

  service_rating: number | null;

  notes: string | null;
  signature_team: string | null;
  status: string;
  service_kind?: RepairServiceKind | null;
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("bg-BG", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Визуално представяне на статуса в горната лента. */
const STATUS_BADGE: Record<"prepared" | "in_progress" | "signed", {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  cls: string;
}> = {
  prepared:    { label: "Подготвен",              icon: ClipboardCheck, cls: "bg-brand-orange-100  text-brand-orange-900"  },
  in_progress: { label: "В процес на изпълнение", icon: Wrench,         cls: "bg-brand-blue-100   text-brand-blue-900"   },
  signed:      { label: "Подписан",               icon: CheckCircle,    cls: "bg-brand-blue-100 text-brand-blue-900"},
};

/** „Да“ / „Не“ / „—“ за nullable boolean полета. */
function boolLabel(v: boolean | null | undefined): string {
  if (v === true) return "Да";
  if (v === false) return "Не";
  return "—";
}

export function ServiceProtocolPreview({
  protocolId, protocolNumber, clientLabel, dateLabel, role,
  onClose, onEdit,
}: Props) {
  const [row, setRow] = useState<ProtocolRow | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [pdfBusy, setPdfBusy] = useState(false);

  const pdfUrl = `/api/admin/service/repair-protocols/${protocolId}/pdf`;

  const downloadPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    try {
      const res = await fetch(pdfUrl, { credentials: "include" });
      if (!res.ok) return;
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      const cd = res.headers.get("Content-Disposition");
      const match = cd?.match(/filename="([^"]+)"/);
      a.download = match?.[1] ?? `servizen-protokol-${protocolNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } finally {
      setPdfBusy(false);
    }
  };

  // ── Достъп до бутоните в горната лента ──────────────────────────────
  // Завършените (signed) протоколи: само master/office могат да
  // редактират (рядка корекция). Незавършените (prepared/in_progress):
  // service_staff също могат да продължат — те са екипът на терен и
  // точно те довършват попълването. Сървърът също валидира това
  // (виж PUT handler-а в /api/admin/service/repair-protocols/[id]).
  const status = row?.status as "prepared" | "in_progress" | "signed" | undefined;
  const isFinished = status === "signed";
  const canContinue = !isFinished && !!status && (
    role === "master_admin" || role === "office_staff" || role === "service_staff"
  );
  const canEditFinished = isFinished && (role === "master_admin" || role === "office_staff");

  const statusBadge = status ? STATUS_BADGE[status] : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadErr(null);
      try {
        const res = await fetch(`/api/admin/service/repair-protocols/${protocolId}`, {
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

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-black/45 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-label="Преглед на сервизен протокол"
    >
      <div className="flex flex-1 flex-col bg-slate-100 w-full h-full md:max-w-3xl md:mx-auto md:my-3 md:rounded-2xl md:shadow-2xl md:max-h-[calc(100vh-1.5rem)] overflow-hidden border border-slate-200 md:border-0">
        {/* ── Лента ── */}
        <div className="border-b border-slate-200 bg-white shrink-0 safe-top">
          <div className="flex flex-wrap items-center gap-2 px-3 py-3 sm:px-4">
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              aria-label="Затвори"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0 basis-[min(100%,180px)]">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold text-slate-900 truncate">{protocolNumber}</p>
                {statusBadge && (() => {
                  const Icon = statusBadge.icon;
                  return (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${statusBadge.cls}`}>
                      <Icon className="w-3 h-3" />
                      {statusBadge.label}
                    </span>
                  );
                })()}
              </div>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {clientLabel || "—"} · {dateLabel}
              </p>
            </div>

            {/* PDF — само за завършени протоколи (на чернови няма смисъл) */}
            {isFinished && (
              <button
                type="button"
                onClick={() => void downloadPdf()}
                disabled={pdfBusy}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-white text-sm font-semibold hover:bg-slate-900 shrink-0 disabled:opacity-60"
              >
                {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                PDF
              </button>
            )}

            {/* „Довърши“ — primary action за незавършени протоколи. Видим е за
                всички роли (вкл. service_staff — те довършват на терен). */}
            {canContinue && (
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-brand-blue-700 text-white text-sm font-semibold hover:bg-brand-blue-800 shrink-0 shadow-sm"
              >
                <PlayCircle className="w-4 h-4" />
                Довърши
              </button>
            )}

            {/* „Редактирай“ — само за завършен протокол и само за
                master_admin/office_staff (рядка корекция). */}
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
        </div>

        {/* ── Съдържание ── */}
        <div className="flex-1 overflow-y-auto min-h-0 p-3 sm:p-4">
          {loading && (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 animate-spin text-brand-blue-700" />
            </div>
          )}
          {!loading && loadErr && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {loadErr}
            </div>
          )}
          {/* CTA банер за недовършени протоколи. Показва ясно на екипа на терен,
              че протоколът чака допълване и предлага бърз бутон „Довърши“. */}
          {!loading && !loadErr && row && canContinue && (
            <div className="max-w-[720px] mx-auto mb-3 rounded-xl border-2 border-brand-orange-300 bg-brand-orange-50 px-4 py-3 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-brand-orange-500 flex items-center justify-center shrink-0">
                <PlayCircle className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-brand-orange-900">
                  {status === "prepared"
                    ? "Протоколът чака сервизен екип"
                    : "Протоколът се попълва"}
                </p>
                <p className="text-xs text-brand-orange-800 leading-snug mt-0.5">
                  {status === "prepared"
                    ? "Протоколът е започнат. Натиснете „Довърши“, за да попълните клиент, сервизни данни и подпис на място."
                    : "Има въведени данни, но липсва подпис на сервизен техник. Натиснете „Довърши“, за да приключите попълването и да подпишете протокола."}
                </p>
              </div>
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-blue-700 hover:bg-brand-blue-800 text-white text-xs font-bold shadow-sm shrink-0"
              >
                <PlayCircle className="w-4 h-4" />
                Довърши
              </button>
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
                    СЕРВИЗЕН ПРОТОКОЛ
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
                <Section title="Тип сервиз">
                  <PreviewField
                    label="Тип"
                    value={SERVICE_KIND_LABEL[row.service_kind === "recycle" ? "recycle" : "client"]}
                  />
                </Section>

                {/* ── Клиент (само при клиентски сервиз) ── */}
                {row.service_kind !== "recycle" && (
                  <Section title="Клиент">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                      <PreviewField label="Име" value={row.client_name} />
                      <PreviewField label="Телефон" value={row.client_phone} />
                      <PreviewField label="Имейл" value={row.client_email} />
                      <PreviewField label="Адрес" value={row.address} />
                    </div>
                  </Section>
                )}

                {/* ── Климатик ── */}
                <Section title="Климатик">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    <PreviewField label="Марка" value={row.ac_brand} />
                    <PreviewField label="Модел" value={row.ac_model} />
                    {row.service_kind !== "recycle" && (
                      <PreviewField label="Сериен №" value={row.serial_number} />
                    )}
                    {row.service_kind === "recycle" && (
                      <>
                        <PreviewField label="Сериен № вътрешно тяло" value={row.indoor_unit_serial} />
                        <PreviewField label="Сериен № външно тяло" value={row.outdoor_unit_serial} />
                      </>
                    )}
                    <PreviewField label="Японски" value={row.is_japanese_brand === null ? "—" : boolLabel(row.is_japanese_brand)} />
                  </div>
                  {row.service_kind === "recycle" && (
                    <p className="text-[11px] mt-2">
                      {row.product_id && row.indoor_unit_serial && row.outdoor_unit_serial
                        ? (
                          <span className="text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1 inline-block">
                            Бройката е финализирана в склада с тези серийни номера.
                          </span>
                        ) : row.product_id ? (
                          <span className="text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 inline-block">
                            Бройка избрана — чака попълване на двата серийни номера, за да се финализира в склада.
                          </span>
                        ) : (
                          <span className="text-slate-500">Няма свързана бройка от склада.</span>
                        )}
                    </p>
                  )}
                </Section>

                {/* ── Профилактика ── */}
                <Section title="Профилактика">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    <PreviewField
                      label="Фреон / зареждане"
                      value={row.freon_charge_method ? FREON_CHARGE_LABEL[row.freon_charge_method] : "—"}
                    />
                    <PreviewField label="Вид хладилен агент" value={row.refrigerant_type} />
                    <PreviewField
                      label="Количество сложено"
                      value={row.refrigerant_amount_g != null ? `${row.refrigerant_amount_g} г` : "—"}
                    />
                    <PreviewField
                      label="Прахосмукачка"
                      value={boolLabel(row.vacuum_cleaning_done)}
                    />
                    <PreviewField label="Клапи" value={boolLabel(row.valves_ok)} />
                    <PreviewField label="Оригинално дистанционно" value={boolLabel(row.original_remote)} />
                    <PreviewField
                      label="Лагери на външно тяло"
                      value={row.outdoor_bearings_state ? BEARINGS_LABEL[row.outdoor_bearings_state] : "—"}
                    />
                    <PreviewField
                      label="Лагери на вътрешно тяло"
                      value={row.indoor_bearings_state ? BEARINGS_LABEL[row.indoor_bearings_state] : "—"}
                    />
                  </div>
                </Section>

                {/* ── Измервания ── */}
                <Section title="Измервания">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-2">
                    <PreviewField
                      label="Налягане (студен режим)"
                      value={row.pressure_cold_bar != null ? `${row.pressure_cold_bar} bar` : "—"}
                    />
                    <PreviewField
                      label="Налягане (топъл режим)"
                      value={row.pressure_hot_bar != null ? `${row.pressure_hot_bar} bar` : "—"}
                    />
                    <PreviewField
                      label="Консумация (студен режим)"
                      value={row.consumption_cold_kw != null ? `${row.consumption_cold_kw} kW` : "—"}
                    />
                    <PreviewField
                      label="Консумация (топъл режим)"
                      value={row.consumption_hot_kw != null ? `${row.consumption_hot_kw} kW` : "—"}
                    />
                  </div>
                  <div className="mt-2">
                    <PreviewField
                      label="Ниво на шум на външното тяло"
                      value={row.outdoor_noise_level ? NOISE_LABEL[row.outdoor_noise_level] : "—"}
                    />
                  </div>
                </Section>

                {/* ── Заварки и ремонти ── */}
                <Section title="Заварки и ремонти">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2">
                    <PreviewField label="Заварки на топлообменник (вътре)" value={boolLabel(row.welds_indoor_heat_exchanger)} />
                    <PreviewField label="Заварки на топлообменник (вънка)" value={boolLabel(row.welds_outdoor_heat_exchanger)} />
                    <PreviewField label="Заварки на тръби" value={boolLabel(row.welds_pipes)} />
                    <PreviewField label="Ремонт на механика (вътрешно тяло)" value={boolLabel(row.indoor_mechanism_repaired)} />
                    <PreviewField label="Счупена турбина" value={boolLabel(row.broken_turbine)} />
                  </div>
                </Section>

                {/* ── Оценка ── */}
                <Section title="Сервизна оценка">
                  {row.service_rating != null ? (
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star
                          key={n}
                          className={`w-7 h-7 ${
                            n <= (row.service_rating ?? 0)
                              ? "fill-brand-orange-500 text-brand-orange-500"
                              : "text-slate-300"
                          }`}
                        />
                      ))}
                      <span className="ml-2 text-sm font-bold text-slate-700">{row.service_rating}/5</span>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">—</p>
                  )}
                </Section>

                {/* ── Забележки ── */}
                <Section title="Забележки">
                  <div className="border border-slate-300 min-h-[72px] p-2 text-sm whitespace-pre-wrap rounded">
                    {row.notes?.trim() || "—"}
                  </div>
                </Section>

                {/* ── Подпис ── */}
                <div className="pt-2 max-w-md mx-auto">
                  <SigBlock title="Подпис на сервизен техник" src={row.signature_team} />
                </div>

                <p className="text-center text-[10px] text-slate-500 pt-4 border-t border-slate-200 leading-relaxed">
                  Смолян Клима ЕООД, ЕИК: BG 204223522 гр. Смолян ул. Елица № 36 Тел: 0878 58 16 16
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-brand-orange-500 pl-3">
      <p className="text-xs font-extrabold uppercase tracking-wider text-brand-blue-800 mb-1.5">
        {title}
      </p>
      {children}
    </div>
  );
}

function PreviewField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <span className="text-[11px] text-slate-500">{label}</span>
      <div className="border-b border-dotted border-slate-400 min-h-[22px] text-sm mt-0.5">
        {value?.toString().trim() || "—"}
      </div>
    </div>
  );
}

function SigBlock({ title, src }: { title: string; src: string | null }) {
  return (
    <div>
      <p className="text-xs font-semibold mb-2">{title}</p>
      <div className="border-b-2 border-black min-h-[56px] flex items-end justify-center pb-1 bg-slate-50/80">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="max-h-14 max-w-full object-contain" />
        ) : (
          <span className="text-[10px] text-slate-400">—</span>
        )}
      </div>
    </div>
  );
}
