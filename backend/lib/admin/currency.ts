/** Официален фиксиран курс BGN → EUR (БНБ / евроизпълнение). */
export const BGN_PER_EUR = 1.95583;

/** Продажби с дата на сделката до 31.01.2026 включително са записани в лева (BGN). */
export const SALES_BGN_SALE_DATE_CUTOFF = "2026-02-01";

export function convertBgnToEur(amount: number): number {
  if (!Number.isFinite(amount)) return amount;
  return Math.round((amount / BGN_PER_EUR) * 100) / 100;
}

export function isSaleDateInBgnLegacy(saleDateIso: string | null | undefined): boolean {
  if (!saleDateIso?.trim()) return false;
  const d = saleDateIso.trim().slice(0, 10);
  return d < SALES_BGN_SALE_DATE_CUTOFF;
}
