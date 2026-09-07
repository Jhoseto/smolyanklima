import { z } from "zod";

/** Само цифри, типичен BG мобилен (без интервали и +359 в полето). */
export const PROTOCOL_PHONE_REGEX = /^\d{6,15}$/;

export const optionalProtocolPhone = z
  .string()
  .max(20)
  .optional()
  .nullable()
  .transform((v) => (v?.trim() ? v.trim() : null))
  .refine((v) => v === null || PROTOCOL_PHONE_REGEX.test(v), {
    message: "Телефонът трябва да съдържа само цифри (6–15)",
  });

export const optionalProtocolEmail = z
  .string()
  .max(200)
  .optional()
  .nullable()
  .transform((v) => (v?.trim() ? v.trim() : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: "Невалиден имейл адрес",
  });

export const optionalUnitSerial = z.string().max(100).optional().nullable().transform((v) => v?.trim() || null);

/** Обратна съвместимост за търсене/стари PDF редове. */
export function combineUnitSerials(
  indoor: string | null | undefined,
  outdoor: string | null | undefined,
): string | null {
  const parts = [indoor?.trim(), outdoor?.trim()].filter(Boolean) as string[];
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  return `Вътр.: ${parts[0]} / Външ.: ${parts[1]}`;
}

/** Legacy формат в service_repair_protocols.serial_number — „ABC / DEF“. */
export function combineLegacySerialField(
  indoor: string | null | undefined,
  outdoor: string | null | undefined,
): string | null {
  const i = indoor?.trim();
  const o = outdoor?.trim();
  if (!i && !o) return null;
  if (i && o) return `${i} / ${o}`;
  return i ?? o ?? null;
}
