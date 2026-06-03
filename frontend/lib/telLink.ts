/** Минимален брой цифри за валиден tel: линк. */
const MIN_DIAL_DIGITS = 8;

/**
 * Нормализира телефон до `tel:` href за мобилно набиране (+359, 0…, интервали).
 */
export function toTelHref(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < MIN_DIAL_DIGITS) return null;

  if (trimmed.startsWith('+') || trimmed.replace(/\s/g, '').startsWith('00')) {
    return `tel:+${digits}`;
  }
  if (digits.startsWith('359') && digits.length >= 11) {
    return `tel:+${digits}`;
  }
  return `tel:${digits}`;
}
