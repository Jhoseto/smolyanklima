import { sanitizeIlikeTerm } from "@/lib/security/sanitizeSearchTerm";

export function phoneDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** ILIKE шаблон: същите цифри подред, с произволни интервали/тирета/+359/0. */
export function phoneFlexibleIlikePattern(raw: string): string | null {
  const digits = phoneDigitsOnly(raw);
  if (digits.length < 3) return null;
  return `%${digits.split("").join("%")}%`;
}

export type AdminSearchFields = {
  textFields: string[];
  phoneFields?: string[];
};

/** PostgREST `.or(...)` — текст + гъвкаво търсене по телефон. */
export function buildAdminSearchOrFilter(rawQ: string, fields: AdminSearchFields): string | null {
  const term = sanitizeIlikeTerm(rawQ);
  const parts: string[] = [];

  if (term) {
    for (const field of fields.textFields) {
      parts.push(`${field}.ilike.%${term}%`);
    }
  }

  const phonePattern = phoneFlexibleIlikePattern(rawQ);
  if (phonePattern && fields.phoneFields?.length) {
    for (const field of fields.phoneFields) {
      parts.push(`${field}.ilike.${phonePattern}`);
    }
  }

  return parts.length ? parts.join(",") : null;
}
