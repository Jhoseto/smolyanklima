/** Минимален брой цифри, за да считаме низа за телефон за набиране. */
const MIN_DIAL_DIGITS = 8;

const PHONE_FIELD_LABEL_RE = /телефон|phone|мобилен|gsm|caller/i;
const EMAIL_FIELD_LABEL_RE = /имейл|e-?mail/i;

/**
 * Нормализира показан телефон до `tel:` href за мобилно набиране.
 * Поддържа +359, 0XXXXXXXXX и международни формати.
 */
export function toTelHref(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < MIN_DIAL_DIGITS) return null;

  if (trimmed.startsWith("+") || trimmed.replace(/\s/g, "").startsWith("00")) {
    return `tel:+${digits}`;
  }
  if (digits.startsWith("359") && digits.length >= 11) {
    return `tel:+${digits}`;
  }
  return `tel:${digits}`;
}

export function isPhoneFieldLabel(label: string): boolean {
  return PHONE_FIELD_LABEL_RE.test(label);
}

export function isEmailFieldLabel(label: string): boolean {
  return EMAIL_FIELD_LABEL_RE.test(label);
}

export function toMailtoHref(email: string | null | undefined): string | null {
  const trimmed = String(email ?? "").trim();
  if (!trimmed || !trimmed.includes("@")) return null;
  return `mailto:${trimmed}`;
}
