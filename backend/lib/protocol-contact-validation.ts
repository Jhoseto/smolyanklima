import { PROTOCOL_PHONE_REGEX } from "@/lib/protocol-contact-fields";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function digitsOnlyPhoneInput(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 15);
}

export function validateProtocolPhone(phone: string): string | null {
  const t = phone.trim();
  if (!t) return null;
  if (!PROTOCOL_PHONE_REGEX.test(t)) {
    return "Телефонът трябва да съдържа само цифри (6–15)";
  }
  return null;
}

export function validateProtocolEmail(email: string): string | null {
  const t = email.trim();
  if (!t) return null;
  if (!EMAIL_REGEX.test(t)) {
    return "Въведете валиден имейл адрес";
  }
  return null;
}
