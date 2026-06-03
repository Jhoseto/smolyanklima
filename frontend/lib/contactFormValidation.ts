/** Букви, интервал, тире, апостроф — без цифри и спец. символи. */
export function sanitizeContactName(value: string): string {
  return value.replace(/[^\p{L}\s'-]/gu, '').slice(0, 80);
}

/** Телефон: опционален „+“ в началото, след това само цифри (без интервали). */
export function sanitizePhoneInput(value: string): string {
  const stripped = value.replace(/[^\d+]/g, '');
  if (!stripped) return '';

  const hasPlus = stripped.includes('+');
  const digits = stripped.replace(/\+/g, '');

  if (hasPlus) {
    return `+${digits.slice(0, 15)}`;
  }
  return digits.slice(0, 15);
}

/** @deprecated Използвайте sanitizePhoneInput */
export const sanitizePhoneDigits = sanitizePhoneInput;

/** Име: букви, интервал, тире; поне 2 думи по 2+ букви или една дума 3+ букви. */
export function isValidContactName(name: string): boolean {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (normalized.length < 3) return false;
  if (!/^[\p{L}][\p{L}\s'-]*$/u.test(normalized)) return false;

  const parts = normalized.split(' ').filter(Boolean);
  if (parts.length >= 2) {
    return parts.every((part) => part.length >= 2);
  }
  return parts[0].length >= 3;
}

/** BG локален или международен (+код държава). */
export function isValidContactPhone(phone: string): boolean {
  const t = phone.trim();
  if (!t) return false;

  if (t.startsWith('+')) {
    const digits = t.slice(1);
    return /^\d{8,15}$/.test(digits);
  }

  if (!/^\d{9,10}$/.test(t)) return false;
  if (t.length === 10) return /^0[2-9]\d{8}$/.test(t);
  return /^[89]\d{8}$/.test(t);
}

export function contactNameErrorMessage(name: string): string | null {
  if (!name.trim()) return 'Моля, въведете име.';
  if (!isValidContactName(name)) {
    return 'Въведете име и фамилия (само букви, напр. Иван Иванов).';
  }
  return null;
}

export function contactPhoneErrorMessage(phone: string): string | null {
  if (!phone.trim()) return 'Моля, въведете телефон.';
  if (!isValidContactPhone(phone)) {
    return 'Въведете валиден телефон (напр. 0888585816 или +359888585816).';
  }
  return null;
}
