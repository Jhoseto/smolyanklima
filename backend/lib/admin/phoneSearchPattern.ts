import { sanitizeIlikeTerm } from "@/lib/security/sanitizeSearchTerm";

export function phoneDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * Канонични цифри за сравнение: BG 0XXXXXXXXX (10 цифри).
 * +359887… и 0887… → един и същ ключ.
 */
export function canonicalPhoneDigits(raw: string | null | undefined): string {
  const digits = phoneDigitsOnly(String(raw ?? ""));
  if (!digits) return "";

  if (digits.startsWith("359") && digits.length >= 12) {
    return `0${digits.slice(3, 12)}`;
  }
  if (digits.startsWith("359") && digits.length > 3) {
    const rest = digits.slice(3);
    return rest.length >= 9 ? `0${rest.slice(0, 9)}` : `0${rest}`;
  }
  if (digits.startsWith("0") && digits.length >= 10) {
    return digits.slice(0, 10);
  }
  if (digits.length === 9 && digits[0] !== "0") {
    return `0${digits}`;
  }
  return digits;
}

/** Варианти на цифров низ за ILIKE — 0… и 359… за BG номера. */
export function bgPhoneSearchDigitVariants(raw: string): string[] {
  const digits = phoneDigitsOnly(raw);
  if (digits.length < 3) return [];

  const out = new Set<string>();
  out.add(digits);

  if (digits.startsWith("359") && digits.length > 3) {
    const after = digits.slice(3);
    if (after.length >= 9) {
      const sub9 = after.slice(0, 9);
      out.add(`0${sub9}`);
      out.add(`359${sub9}`);
    }
    if (after.length >= 3) out.add(`0${after}`);
  } else if (digits.startsWith("0") && digits.length > 1) {
    const after = digits.slice(1);
    if (after.length >= 9) {
      const sub9 = after.slice(0, 9);
      out.add(`0${sub9}`);
      out.add(`359${sub9}`);
    }
    if (digits.length >= 10) {
      out.add(`359${digits.slice(1, 10)}`);
    }
  } else if (digits.length === 9) {
    out.add(`0${digits}`);
    out.add(`359${digits}`);
  }

  return [...out].filter((v) => v.length >= 3);
}

function digitsToFlexiblePattern(digits: string): string {
  return `%${digits.split("").join("%")}%`;
}

/** PostgREST стойност за ilike — кавички при интервали/запетаи, за да не се чупи `.or()`. */
export function formatPostgrestIlikeValue(pattern: string): string {
  const needsQuotes = /[\s,()]/.test(pattern);
  if (!needsQuotes) return pattern;
  return `"${pattern.replace(/"/g, '""')}"`;
}

/** ILIKE шаблон: същите цифри подред, с произволни интервали/тирета/+359/0. */
export function phoneFlexibleIlikePattern(raw: string): string | null {
  const patterns = phoneFlexibleIlikePatterns(raw);
  return patterns[0] ?? null;
}

/** Всички ILIKE варианти (0… и 359…) — за OR търсене. */
export function phoneFlexibleIlikePatterns(raw: string): string[] {
  const variants = bgPhoneSearchDigitVariants(raw);
  if (!variants.length) return [];

  const ordered = [
    ...variants.filter((v) => v.startsWith("0") && v.length >= 10),
    ...variants.filter((v) => v.startsWith("0") && v.length < 10),
    ...variants.filter((v) => v.startsWith("359")),
    ...variants.filter((v) => !v.startsWith("0") && !v.startsWith("359")),
  ];

  const seen = new Set<string>();
  const patterns: string[] = [];
  for (const v of ordered) {
    const p = digitsToFlexiblePattern(v);
    if (!seen.has(p)) {
      seen.add(p);
      patterns.push(p);
    }
  }
  return patterns;
}

export type AdminSearchFields = {
  textFields: string[];
  phoneFields?: string[];
};

/** PostgREST `.or(...)` — текст + гъвкаво търсене по телефон (0 / +359, без значение на интервалите). */
export function buildAdminSearchOrFilter(rawQ: string, fields: AdminSearchFields): string | null {
  const term = sanitizeIlikeTerm(rawQ);
  const parts: string[] = [];
  const phoneFieldSet = new Set(fields.phoneFields ?? []);

  if (term) {
    for (const field of fields.textFields) {
      // Телефоните се търсят само с гъвкав ILIKE (%цифра%цифра%), не буквално с интервали.
      if (phoneFieldSet.has(field)) continue;
      parts.push(`${field}.ilike.${formatPostgrestIlikeValue(`%${term}%`)}`);
    }
  }

  const phonePatterns = phoneFlexibleIlikePatterns(rawQ);
  if (phonePatterns.length && fields.phoneFields?.length) {
    for (const field of fields.phoneFields) {
      for (const pattern of phonePatterns) {
        parts.push(`${field}.ilike.${formatPostgrestIlikeValue(pattern)}`);
      }
    }
  }

  return parts.length ? parts.join(",") : null;
}
