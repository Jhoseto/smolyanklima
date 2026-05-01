"use client";

import Link from "next/link";
import { useState } from "react";
import { X } from "lucide-react";
import { Card, Button } from "./ui";
import { ProductQuickViewButton } from "./ProductQuickView";

type DashboardDetail = {
  title: string;
  subtitle?: string;
  fields: Array<{ label: string; value?: string | number | null }>;
};

export type DashboardPanelItem = {
  title: string;
  meta?: string;
  detail: DashboardDetail;
  productId?: string | null;
};

export function DashboardPanel({
  title,
  description,
  href,
  empty,
  badge,
  items,
  tone = "neutral",
}: {
  title: string;
  description: string;
  href: string;
  empty: string;
  badge: number;
  items: DashboardPanelItem[];
  tone?: "neutral" | "info" | "warning" | "danger";
}) {
  const [selected, setSelected] = useState<DashboardDetail | null>(null);
  const badgeClass = {
    neutral: "bg-slate-100 text-slate-700 border-slate-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
    warning: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
  }[tone];

  return (
    <>
      <Card className="p-4 min-h-[220px]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-bold text-slate-900">{title}</div>
            <div className="mt-1 text-xs leading-5 text-slate-500">{description}</div>
          </div>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${badgeClass}`}>{badge}</span>
        </div>
        <div className="mt-3 grid gap-2">
          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">{empty}</div>
          ) : (
            items.map((item, idx) => (
              <div
                key={`${item.title}-${idx}`}
                className="group rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2 text-left transition-all hover:border-sky-200 hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-900">
                      {item.productId ? (
                        <ProductQuickViewButton productId={item.productId} productName={item.title} />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelected(item.detail)}
                          className="truncate text-left font-semibold text-slate-900 transition-colors hover:text-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-200 rounded"
                        >
                          {item.title}
                        </button>
                      )}
                    </div>
                    {item.meta && <div className="mt-0.5 truncate text-xs text-slate-500">{item.meta}</div>}
                  </div>
                  {!item.productId && (
                    <button
                      type="button"
                      onClick={() => setSelected(item.detail)}
                      className="shrink-0 text-[11px] font-bold text-sky-700 opacity-80 group-hover:opacity-100"
                    >
                      Детайли
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
        <Link href={href} className="mt-3 inline-flex text-xs font-semibold text-sky-700 hover:text-sky-800">
          Отвори всички →
        </Link>
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
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-200"
                aria-label="Затвори детайли"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="pr-10">
                <div className="text-xs font-bold uppercase tracking-[0.24em] text-sky-700">Оперативни детайли</div>
                <div className="mt-1 text-2xl font-black leading-tight text-slate-950">{selected.title}</div>
                {selected.subtitle && <div className="mt-1 text-sm font-medium text-slate-500">{selected.subtitle}</div>}
              </div>
            </div>

            <div className="grid gap-3 p-6">
              {selected.fields
                .filter((field) => field.value !== undefined && field.value !== null && String(field.value).trim() !== "")
                .map((field) => (
                  <div key={field.label} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{field.label}</div>
                    <div className="mt-1 whitespace-pre-wrap text-sm font-semibold leading-6 text-slate-900">{field.value}</div>
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
