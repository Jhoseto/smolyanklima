"use client";

import { useState } from "react";
import { ChevronRight, Wind } from "lucide-react";
import { ProductQuickViewModal } from "../ProductQuickView";

export type InquiryProductCardItem = {
  id: string;
  product_id: string | null;
  product_slug: string | null;
  product_name: string;
  image_url?: string | null;
  price?: number | null;
  price_with_mount?: number | null;
  brand_name?: string | null;
};

export function InquiryProductCards({
  products,
  compact = false,
}: {
  products: InquiryProductCardItem[];
  compact?: boolean;
}) {
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const list = products ?? [];

  if (!list.length) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <>
      <div className={compact ? "flex flex-wrap gap-2" : "grid grid-cols-1 gap-4 sm:grid-cols-2"}>
        {list.map((p) => {
          const clickable = Boolean(p.product_id);
          const price = p.price != null ? Number(p.price) : null;
          const priceMount = p.price_with_mount != null ? Number(p.price_with_mount) : null;

          if (compact) {
            return (
              <button
                key={p.id}
                type="button"
                disabled={!clickable}
                onClick={() => clickable && setQuickViewId(p.product_id!)}
                className={`group flex max-w-[240px] items-center gap-2 rounded-xl border bg-white p-2 text-left transition-all ${
                  clickable
                    ? "border-slate-200 hover:border-[#00B4D8] hover:shadow-md cursor-pointer"
                    : "border-slate-100 opacity-85 cursor-default"
                }`}
                title={clickable ? "Подробен преглед" : p.product_name}
              >
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
                  {p.image_url ? (
                    <img src={p.image_url} alt="" className="h-full w-full object-contain p-0.5" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#00B4D8]">
                      <Wind className="h-4 w-4" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {p.brand_name && (
                    <p className="truncate text-[9px] font-bold uppercase tracking-wide text-[#00B4D8]">
                      {p.brand_name}
                    </p>
                  )}
                  <p className="line-clamp-2 text-[11px] font-bold leading-snug text-slate-900">
                    {p.product_name}
                  </p>
                  {price != null && (
                    <p className="text-[10px] font-bold text-[#FF4D00]">€{price.toLocaleString()}</p>
                  )}
                </div>
              </button>
            );
          }

          return (
            <button
              key={p.id}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && setQuickViewId(p.product_id!)}
              className={`group flex flex-col overflow-hidden rounded-[1.25rem] border bg-white text-left shadow-sm transition-all duration-300 ${
                clickable
                  ? "border-slate-200 hover:-translate-y-0.5 hover:border-[#00B4D8]/40 hover:shadow-lg cursor-pointer"
                  : "border-slate-100 opacity-90 cursor-default"
              }`}
              title={clickable ? "Подробен преглед на продукта" : p.product_name}
            >
              <div className="relative h-36 w-full overflow-hidden bg-gradient-to-b from-slate-50 to-white">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt=""
                    className="h-full w-full object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[#00B4D8]/50">
                    <Wind className="h-10 w-10" />
                  </div>
                )}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
              </div>
              <div className="flex flex-1 flex-col p-3.5">
                {p.brand_name && (
                  <p className="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-[#00B4D8]">
                    {p.brand_name}
                  </p>
                )}
                <p className="line-clamp-2 text-sm font-bold leading-snug text-slate-900">
                  {p.product_name}
                </p>
                {price != null && (
                  <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-base font-black text-[#FF4D00]">
                      €{price.toLocaleString()}
                    </span>
                    {priceMount != null && priceMount > price && (
                      <span className="text-[11px] font-semibold text-slate-500">
                        с монтаж €{priceMount.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
                {clickable && (
                  <span className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#0077B6] group-hover:underline">
                    Подробен преглед
                    <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {quickViewId && (
        <ProductQuickViewModal productId={quickViewId} onClose={() => setQuickViewId(null)} />
      )}
    </>
  );
}
