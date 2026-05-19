"use client";

import { useEffect, useState } from "react";
import { Input } from "../ui";

export const ADMIN_PRICE_FILTER_MIN = 0;
export const ADMIN_PRICE_FILTER_MAX = 20000;
export const ADMIN_PRICE_FILTER_STEP = 50;

export function isAdminPriceFilterActive(range: [number, number]) {
  return range[0] > ADMIN_PRICE_FILTER_MIN || range[1] < ADMIN_PRICE_FILTER_MAX;
}

export function formatAdminPriceEuro(n: number) {
  return n.toLocaleString("bg-BG");
}

function parsePriceInput(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

function clampPriceRange(
  lo: number,
  hi: number,
  boundsMin: number,
  boundsMax: number,
): [number, number] {
  let a = Math.max(boundsMin, Math.min(lo, boundsMax));
  let b = Math.max(boundsMin, Math.min(hi, boundsMax));
  if (a > b) [a, b] = [b, a];
  return [a, b];
}

type PriceRangeSliderProps = {
  value: [number, number];
  onChange: (value: [number, number]) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
};

export function PriceRangeSlider({
  value,
  onChange,
  min = ADMIN_PRICE_FILTER_MIN,
  max = ADMIN_PRICE_FILTER_MAX,
  step = ADMIN_PRICE_FILTER_STEP,
  className = "",
}: PriceRangeSliderProps) {
  const [lo, hi] = value;
  const minGap = step;

  const [minDraft, setMinDraft] = useState(String(lo));
  const [maxDraft, setMaxDraft] = useState(String(hi));

  useEffect(() => {
    setMinDraft(String(lo));
    setMaxDraft(String(hi));
  }, [lo, hi]);

  function handleMinChange(nextLo: number) {
    const clamped = Math.max(min, Math.min(nextLo, hi - minGap));
    onChange([clamped, hi]);
  }

  function handleMaxChange(nextHi: number) {
    const clamped = Math.min(max, Math.max(nextHi, lo + minGap));
    onChange([lo, clamped]);
  }

  function commitMinInput() {
    const parsed = parsePriceInput(minDraft);
    const nextLo = parsed ?? min;
    onChange(clampPriceRange(nextLo, hi, min, max));
  }

  function commitMaxInput() {
    const parsed = parsePriceInput(maxDraft);
    const nextHi = parsed ?? max;
    onChange(clampPriceRange(lo, nextHi, min, max));
  }

  const rangeClass =
    "w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-brand-blue-600";

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white px-2.5 py-2 md:px-3 md:py-2.5 space-y-2 ${className}`}
    >
      <div className="grid grid-cols-2 gap-1.5 md:gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          step={1}
          value={minDraft}
          onChange={(e) => setMinDraft(e.target.value)}
          onBlur={commitMinInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          placeholder="Цена от (€)"
          className="!text-xs md:!text-sm !py-1.5 md:!py-2"
          aria-label="Цена от"
        />
        <Input
          type="number"
          min={min}
          max={max}
          step={1}
          value={maxDraft}
          onChange={(e) => setMaxDraft(e.target.value)}
          onBlur={commitMaxInput}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            }
          }}
          placeholder="Цена до (€)"
          className="!text-xs md:!text-sm !py-1.5 md:!py-2"
          aria-label="Цена до"
        />
      </div>
      <div className="space-y-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={lo}
          onChange={(e) => handleMinChange(Number(e.target.value))}
          aria-label="Минимална цена — плъзгач"
          className={rangeClass}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={hi}
          onChange={(e) => handleMaxChange(Number(e.target.value))}
          aria-label="Максимална цена — плъзгач"
          className={rangeClass}
        />
      </div>
    </div>
  );
}
