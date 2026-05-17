"use client";

import { FilterX } from "lucide-react";

export type ActiveFilterChip = { key: string; label: string; onClear: () => void };

type Props = {
  filters: ActiveFilterChip[];
  onClearAll?: () => void;
  onBeforeClear?: () => void;
  compact?: boolean;
  className?: string;
};

/** Чипове с активни филтри — непосредствено над таблицата с резултати. */
export function ActiveFilterChipsBar({
  filters,
  onClearAll,
  onBeforeClear,
  compact = false,
  className = "",
}: Props) {
  if (filters.length === 0) return null;
  const shell = compact
    ? "gap-x-1.5 gap-y-1 py-0.5"
    : "gap-x-2 gap-y-1.5 px-2.5 py-2 md:px-3 md:py-2.5 rounded-lg md:rounded-xl border border-brand-blue-100 bg-brand-blue-50/50";
  return (
    <div className={`flex flex-wrap items-center ${shell} ${className}`}>
      <span className="text-[10px] md:text-[11px] font-bold uppercase tracking-wider text-slate-500 shrink-0">
        Активни филтри
      </span>
      <div className="flex flex-wrap gap-1 md:gap-1.5 min-w-0 flex-1">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              onBeforeClear?.();
              f.onClear();
            }}
            className="inline-flex items-center gap-1 max-w-full min-w-0 px-2 py-0.5 md:px-2.5 md:py-1 rounded-full text-[10px] md:text-xs font-semibold bg-white text-brand-blue-700 border border-brand-blue-200 hover:bg-brand-blue-100 hover:text-brand-blue-800 transition-colors shadow-sm"
            title="Премахни този филтър"
          >
            <span className="min-w-0 truncate">{f.label}</span>
            <span aria-hidden className="text-brand-blue-500 shrink-0">
              ×
            </span>
          </button>
        ))}
      </div>
      {onClearAll && filters.length > 1 ? (
        <button
          type="button"
          onClick={onClearAll}
          className="inline-flex items-center gap-1 text-[10px] md:text-xs font-semibold text-slate-500 hover:text-slate-800 shrink-0"
        >
          <FilterX className="w-3 h-3 md:w-3.5 md:h-3.5" />
          Изчисти всички
        </button>
      ) : null}
    </div>
  );
}
