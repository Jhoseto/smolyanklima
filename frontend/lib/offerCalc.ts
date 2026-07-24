/** Огледало на backend/lib/offers/calcTotals.ts — редове на оферта. */

export const TRADE_DISCOUNT_LABEL = "Търговска отстъпка";
export const OFFER_INSTALL_LABEL = "Стандартен монтаж";

export type OfferCalcLine = {
  quantity: number;
  unit_price: number;
  install_price?: number | null;
  trade_discount_percent?: number | null;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseTradeDiscountPercent(v: number | null | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

export function effectiveUnitPrice(line: OfferCalcLine): number {
  const unit = Number(line.unit_price) || 0;
  const pct = parseTradeDiscountPercent(line.trade_discount_percent);
  return round2(unit * (1 - pct / 100));
}

export function lineTotal(line: OfferCalcLine): number {
  const qty = Number(line.quantity) || 0;
  const unit = effectiveUnitPrice(line);
  const install = Number(line.install_price) || 0;
  return round2(qty * (unit + install));
}

export function formatTradeDiscountPercent(pct: number | null | undefined): string {
  const n = parseTradeDiscountPercent(pct);
  if (n <= 0) return "—";
  const label = Number.isInteger(n) ? String(n) : n.toLocaleString("bg-BG", { maximumFractionDigits: 2 });
  return `${label}%`;
}
