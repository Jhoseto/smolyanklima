/** Нормализира телефон за сравнение (BG: последните 9 цифри). */
export function normalizeInquiryPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 9) return digits;
  return digits.slice(-9);
}

export function phonesMatch(a: string, b: string): boolean {
  const na = normalizeInquiryPhone(a);
  const nb = normalizeInquiryPhone(b);
  return na.length >= 8 && nb.length >= 8 && na === nb;
}
