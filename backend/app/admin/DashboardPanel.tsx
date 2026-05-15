"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ChevronRight, X } from "lucide-react";
import { Card, Button, HoverTip } from "./ui";
import { ProductQuickViewButton } from "./ProductQuickView";

type DashboardDetail = {
  title: string;
  subtitle?: string;
  fields: Array<{ label: string; value?: string | number | null }>;
};

export type FollowUpStatusKind = "waiting" | "done";

const PANEL_TIPS = {
  openInquiry: "Отвори запитването в пълния списък",
  completeConsultation: "Маркирай консултацията като завършена",
  viewDetails: "Виж подробности за обаждането",
  openAll: "Отвори пълния списък в CRM",
  close: "Затвори",
} as const;

export type DashboardPanelItem = {
  id?: string;
  title: string;
  meta?: string;
  /** Badge „Чака“ / „Завършено“ в панела за обаждания. */
  statusKind?: FollowUpStatusKind;
  /** Ново клиентско запитване — отваря /admin/inquiries?id=… */
  inquiryId?: string;
  /** Чакаща консултация — бутон „Завърши“ в CRM панела. */
  consultationWorkItemId?: string;
  consultationDueDate?: string | null;
  consultationCustomerName?: string | null;
  consultationCustomerPhone?: string | null;
  detail: DashboardDetail;
  productId?: string | null;
};

export function FollowUpStatusBadge({ kind }: { kind: FollowUpStatusKind }) {
  const base = "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide";
  if (kind === "done") {
    return <span className={`${base} border-green-300 bg-green-100 text-green-800`}>Завършено</span>;
  }
  return <span className={`${base} border-amber-300 bg-amber-100 text-amber-900`}>Чака</span>;
}

const TONE_STYLES = {
  neutral: {
    accent: "border-l-slate-400",
    header: "bg-slate-50/80",
    badge: "bg-slate-100 text-slate-700 border-slate-200",
    itemHover: "hover:border-slate-300 hover:bg-white",
  },
  info: {
    accent: "border-l-brand-blue-500",
    header: "bg-brand-blue-50/50",
    badge: "bg-brand-blue-50 text-brand-blue-800 border-brand-blue-200",
    itemHover: "hover:border-brand-blue-200 hover:bg-brand-blue-50/30",
  },
  warning: {
    accent: "border-l-amber-500",
    header: "bg-amber-50/60",
    badge: "bg-amber-50 text-amber-900 border-amber-200",
    itemHover: "hover:border-amber-300 hover:bg-amber-50/40",
  },
  danger: {
    accent: "border-l-red-500",
    header: "bg-red-50/50",
    badge: "bg-red-50 text-red-800 border-red-200",
    itemHover: "hover:border-red-300 hover:bg-red-50/40",
  },
} as const;

export function DashboardPanel({
  title,
  description,
  href,
  empty,
  badge,
  items,
  tone = "neutral",
  readOnly = false,
  onRequestCompleteConsultation,
  completingConsultationId = null,
  onOpenInquiry,
}: {
  title: string;
  description: string;
  href: string;
  empty: string;
  badge: number;
  items: DashboardPanelItem[];
  tone?: "neutral" | "info" | "warning" | "danger";
  readOnly?: boolean;
  onRequestCompleteConsultation?: (item: DashboardPanelItem) => void;
  completingConsultationId?: string | null;
  onOpenInquiry?: (inquiryId: string) => void;
}) {
  const [selected, setSelected] = useState<DashboardDetail | null>(null);
  const styles = TONE_STYLES[tone];

  return (
    <>
      <Card
        className={`flex h-full min-h-[280px] flex-col overflow-hidden border-l-4 p-0 shadow-sm ring-1 ring-slate-200/70 ${styles.accent}`}
      >
        <div className={`shrink-0 border-b border-slate-100 px-4 py-3 ${styles.header}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-900">{title}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">{description}</p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-bold tabular-nums ${styles.badge}`}
            >
              {badge}
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
          <div className="min-h-0 flex-1 space-y-2">
            {items.length === 0 ? (
              <div className="flex h-full min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center text-sm text-slate-500">
                {empty}
              </div>
            ) : (
              items.map((item, idx) => (
                <div
                  key={item.id ?? `${item.title}-${idx}`}
                  className={`rounded-xl border shadow-sm transition-colors ${
                    item.statusKind === "done"
                      ? "border-green-200/90 bg-green-50/60 hover:border-green-300 hover:bg-green-50"
                      : `border-slate-200/80 bg-white ${styles.itemHover}`
                  }`}
                >
                  {item.productId && !readOnly ? (
                    <div className="px-3 py-2.5">
                      <div className="min-w-0">
                        <ProductQuickViewButton
                          productId={item.productId}
                          productName={item.title}
                          className="line-clamp-2 text-sm leading-snug"
                        />
                      </div>
                      {item.meta && (
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-3">{item.meta}</p>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelected(item.detail)}
                        className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand-blue-700 hover:text-brand-blue-800"
                      >
                        Оперативни детайли
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  ) : item.inquiryId && onOpenInquiry ? (
                    <button
                      type="button"
                      title={PANEL_TIPS.openInquiry}
                      onClick={() => onOpenInquiry(item.inquiryId!)}
                      className="w-full px-3 py-2.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-200 focus-visible:ring-offset-1 rounded-xl"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900 line-clamp-2">{item.title}</p>
                        {item.statusKind ? <FollowUpStatusBadge kind={item.statusKind} /> : null}
                      </div>
                      {item.meta && (
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-3">{item.meta}</p>
                      )}
                      <span className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand-blue-700">
                        Отвори запитване
                        <ChevronRight className="h-3 w-3" />
                      </span>
                    </button>
                  ) : (
                    <div className="px-3 py-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-sm font-semibold leading-snug text-slate-900 line-clamp-2">{item.title}</p>
                        {item.statusKind ? <FollowUpStatusBadge kind={item.statusKind} /> : null}
                      </div>
                      {item.meta && (
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-3">{item.meta}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {item.consultationWorkItemId &&
                          item.statusKind === "waiting" &&
                          !readOnly &&
                          onRequestCompleteConsultation && (
                            <HoverTip tip={PANEL_TIPS.completeConsultation}>
                              <button
                                type="button"
                                aria-label={PANEL_TIPS.completeConsultation}
                                onClick={() => onRequestCompleteConsultation(item)}
                                disabled={completingConsultationId === item.consultationWorkItemId}
                                className="inline-flex items-center gap-1 rounded-lg border border-green-700 bg-green-600 px-2.5 py-1 text-[10px] font-bold text-white hover:bg-green-700 disabled:opacity-50"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {completingConsultationId === item.consultationWorkItemId ? "Запис..." : "Завърши"}
                              </button>
                            </HoverTip>
                          )}
                        <HoverTip tip={PANEL_TIPS.viewDetails}>
                          <button
                            type="button"
                            aria-label={PANEL_TIPS.viewDetails}
                            onClick={() => setSelected(item.detail)}
                            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-brand-blue-700 hover:text-brand-blue-800"
                          >
                            Виж детайли
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </HoverTip>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="mt-3 shrink-0 border-t border-slate-100 pt-3">
            {readOnly ? (
              <p className="text-xs text-slate-400">Пълният списък е достъпен за офис и администратор.</p>
            ) : (
              <Link
                href={href}
                title={PANEL_TIPS.openAll}
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue-700 hover:text-brand-blue-800"
              >
                Отвори всички
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </Card>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-md"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.35)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,#ffffff_42%,#f8fafc_100%)] px-6 py-5">
              <HoverTip tip={PANEL_TIPS.close}>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue-200"
                aria-label={PANEL_TIPS.close}
              >
                <X className="h-4 w-4" />
              </button>
              </HoverTip>
              <div className="pr-10">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-brand-blue-700">
                  Оперативни детайли
                </div>
                <div className="mt-1 text-2xl font-black leading-tight text-slate-950">{selected.title}</div>
                {selected.subtitle && (
                  <div className="mt-1 text-sm font-medium text-slate-500">{selected.subtitle}</div>
                )}
              </div>
            </div>

            <div className="grid gap-3 p-6">
              {selected.fields
                .filter((field) => field.value !== undefined && field.value !== null && String(field.value).trim() !== "")
                .map((field) => (
                  <div key={field.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{field.label}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-900">
                      {field.value}
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-6 py-4">
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Затвори
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
