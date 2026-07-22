/** Единен калкулатор за суми на оферта — админ, PDF, публична страница, snapshot в БД. */

export const TRADE_DISCOUNT_LABEL = "Търговска отстъпка";

export type OfferCalcLine = {
  quantity: number;
  unit_price: number;
  install_price?: number | null;
  trade_discount_percent?: number | null;
};

export type OfferCalcInput = {
  items: OfferCalcLine[];
  vatRate?: number;
  pricesIncludeVat?: boolean;
  discountTotal?: number;
};

export type OfferCalcResult = {
  subtotal: number;
  discount: number;
  base_excl_vat: number;
  vat_amount: number;
  total_incl_vat: number;
};

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function parseTradeDiscountPercent(v: number | null | undefined): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** Единична цена след ТО (монтажът не участва в търговската отстъпка). */
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

/** Сума на ТО за един ред (само върху единичната цена × брой, без монтаж). */
export function lineTradeDiscountAmount(line: OfferCalcLine): number {
  const qty = Number(line.quantity) || 0;
  const unit = Number(line.unit_price) || 0;
  const pct = parseTradeDiscountPercent(line.trade_discount_percent);
  if (pct <= 0 || qty <= 0 || unit <= 0) return 0;
  return round2(qty * unit * (pct / 100));
}

/** Обща търговска отстъпка (сума от всички редове с ТО). */
export function totalTradeDiscountAmount(items: OfferCalcLine[]): number {
  return round2((items ?? []).reduce((sum, line) => sum + lineTradeDiscountAmount(line), 0));
}

export function formatTradeDiscountWithAmount(
  pct: number | null | undefined,
  amount: number,
  currency = "EUR",
): string {
  const n = parseTradeDiscountPercent(pct);
  if (n <= 0) return "—";
  const pctLabel = Number.isInteger(n) ? String(n) : n.toLocaleString("bg-BG", { maximumFractionDigits: 2 });
  return `${pctLabel}% / ${formatOfferMoney(amount, currency)}`;
}

/**
 * BG стандарт: каталожните цени са с включено ДДС.
 * При pricesIncludeVat=true: total_incl = Σ lines − discount; base = total/(1+rate); vat = total − base.
 * При pricesIncludeVat=false: base = Σ lines − discount; vat = base*rate; total = base + vat.
 */
export function calcOfferTotals(input: OfferCalcInput): OfferCalcResult {
  const vatRate = Math.max(0, Number(input.vatRate ?? 20));
  const pricesIncludeVat = input.pricesIncludeVat !== false;
  const discount = Math.max(0, Number(input.discountTotal ?? 0));

  const rawSubtotal = (input.items ?? []).reduce((sum, line) => sum + lineTotal(line), 0);
  const subtotal = round2(rawSubtotal);
  const afterDiscount = Math.max(0, round2(subtotal - discount));

  if (pricesIncludeVat) {
    const total_incl_vat = afterDiscount;
    const base_excl_vat = round2(total_incl_vat / (1 + vatRate / 100));
    const vat_amount = round2(total_incl_vat - base_excl_vat);
    return {
      subtotal,
      discount: round2(discount),
      base_excl_vat,
      vat_amount,
      total_incl_vat,
    };
  }

  const base_excl_vat = afterDiscount;
  const vat_amount = round2(base_excl_vat * (vatRate / 100));
  const total_incl_vat = round2(base_excl_vat + vat_amount);
  return {
    subtotal,
    discount: round2(discount),
    base_excl_vat,
    vat_amount,
    total_incl_vat,
  };
}

export function formatOfferMoney(n: number | null | undefined, currency = "EUR"): string {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  const symbol = currency === "EUR" ? "€" : currency === "BGN" ? "лв." : `${currency} `;
  return `${symbol}${Number(n).toLocaleString("bg-BG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Фиксинг EUR→BGN за вторичен ред (информативно). */
export const EUR_TO_BGN = 1.95583;

export function eurToBgn(eur: number): number {
  return round2(eur * EUR_TO_BGN);
}

export function mapOfferItemsForCalc(
  items: Array<{
    quantity: number;
    unitPrice: number;
    installPrice?: number | null;
    tradeDiscountPercent?: number | null;
  }>,
): OfferCalcLine[] {
  return items.map((i) => ({
    quantity: i.quantity,
    unit_price: i.unitPrice,
    install_price: i.installPrice,
    trade_discount_percent: i.tradeDiscountPercent,
  }));
}
