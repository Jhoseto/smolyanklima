/** Единен калкулатор за суми на оферта — админ, PDF, публична страница, snapshot в БД. */

export type OfferCalcLine = {
  quantity: number;
  unit_price: number;
  install_price?: number | null;
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

export function lineTotal(line: OfferCalcLine): number {
  const qty = Number(line.quantity) || 0;
  const unit = Number(line.unit_price) || 0;
  const install = Number(line.install_price) || 0;
  return qty * (unit + install);
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
