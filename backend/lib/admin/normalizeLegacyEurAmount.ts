import { convertBgnToEur, isSaleDateInBgnLegacy } from "@/lib/admin/currency";

export type LegacyEurContext = {
  /** work_items.amounts_converted_from_bgn_at или products.amounts_converted_from_bgn_at */
  convertedAt?: string | null;
  /** due_date / purchased_at / created_at — за записи преди 01.02.2026 (BGN). */
  legacyDate?: string | null;
};

function pickLegacyDate(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (c?.trim()) return c.trim().slice(0, 10);
  }
  return null;
}

/** Сума/цена: ако още не е конвертирана и датата е преди еврото → BGN→EUR. */
export function amountAsEur(
  amount: number | null | undefined,
  ctx: LegacyEurContext,
): number | null {
  if (amount == null) return null;
  const n = Number(amount);
  if (!Number.isFinite(n)) return null;
  if (ctx.convertedAt) return n;
  const legacyDate = pickLegacyDate(ctx.legacyDate);
  if (legacyDate && isSaleDateInBgnLegacy(legacyDate)) return convertBgnToEur(n);
  return n;
}

export function workItemAmountAsEur(row: {
  total_amount?: number | null;
  unit_price?: number | null;
  due_date?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  amounts_converted_from_bgn_at?: string | null;
}): number | null {
  const raw = row.total_amount ?? row.unit_price ?? null;
  return amountAsEur(raw, {
    convertedAt: row.amounts_converted_from_bgn_at,
    legacyDate: pickLegacyDate(row.due_date, row.completed_at, row.created_at),
  });
}

export function productPricesAsEur(product: {
  price?: number | null;
  purchase_price?: number | null;
  purchased_at?: string | null;
  created_at?: string | null;
  amounts_converted_from_bgn_at?: string | null;
}): { price: number | null; purchase_price: number | null } {
  const ctx: LegacyEurContext = {
    convertedAt: product.amounts_converted_from_bgn_at,
    legacyDate: pickLegacyDate(product.purchased_at, product.created_at),
  };
  return {
    price: amountAsEur(product.price, ctx),
    purchase_price: amountAsEur(product.purchase_price, ctx),
  };
}
