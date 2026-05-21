/** Договорена цена след отстъпка % от каталожната (надолу). */
export function agreedPriceAfterDiscount(catalogPrice: number, discountPercent: number): number {
  const catalog = Number(catalogPrice);
  const pct = Number(discountPercent);
  if (!Number.isFinite(catalog) || catalog < 0) return 0;
  if (!Number.isFinite(pct)) return catalog;
  const clamped = Math.min(100, Math.max(0, pct));
  const next = catalog * (1 - clamped / 100);
  return Math.round(next * 100) / 100;
}

export function formatAgreedPriceInput(value: number): string {
  if (!Number.isFinite(value)) return "";
  return value.toFixed(2);
}

/** Обратно: колко % отстъпка дава договорената цена спрямо каталога. */
export function discountPercentFromAgreedPrice(catalogPrice: number, agreedPrice: number): string {
  const catalog = Number(catalogPrice);
  const agreed = Number(agreedPrice);
  if (!Number.isFinite(catalog) || catalog <= 0 || !Number.isFinite(agreed)) return "";
  const pct = (1 - agreed / catalog) * 100;
  if (!Number.isFinite(pct)) return "";
  const clamped = Math.min(100, Math.max(0, pct));
  const rounded = Math.round(clamped * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function parseDecimalInput(raw: string): number {
  return Number(String(raw).replace(",", ".").trim());
}
