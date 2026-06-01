import { canonicalPhoneDigits, phoneDigitsOnly } from "@/lib/admin/phoneSearchPattern";

/** BG номер → E.164 (+359…). */
export function phoneToBulgarianE164(raw: string | null | undefined): string | null {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return null;

  const canonical = canonicalPhoneDigits(trimmed);
  if (canonical.length === 10 && canonical.startsWith("0")) {
    return `+359${canonical.slice(1)}`;
  }

  const digits = phoneDigitsOnly(trimmed);
  if (digits.startsWith("359") && digits.length >= 11) {
    return `+${digits.slice(0, 12)}`;
  }
  if (digits.length === 9) {
    return `+359${digits}`;
  }

  return null;
}

/**
 * Viber deep link — отваря чат с номера (от там: обаждане през Viber).
 * Формат като на сайта: viber://chat?number=%2B359…
 */
export function viberChatUrl(raw: string | null | undefined): string | null {
  const e164 = phoneToBulgarianE164(raw);
  if (!e164) return null;
  return `viber://chat?number=${encodeURIComponent(e164)}`;
}
