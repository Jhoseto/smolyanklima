import type { SupabaseClient } from "@supabase/supabase-js";
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

function digitsToFlexibleSqlPattern(digits: string): string {
  return `%${digits.split("").join("%")}%`;
}

/** SQL ILIKE (%…) → PostgREST filter (*…). */
function sqlIlikeToPostgrest(pattern: string): string {
  return pattern.replace(/%/g, "*");
}

/** PostgREST стойност за ilike — * вместо %; кавички при reserved chars. */
export function formatPostgrestIlikeValue(pattern: string): string {
  const postgrest = sqlIlikeToPostgrest(pattern);
  const needsQuotes = /[*",()\s]/.test(postgrest);
  if (!needsQuotes) return postgrest;
  return `"${postgrest.replace(/"/g, '""')}"`;
}

function containsIlikePattern(term: string): string {
  return formatPostgrestIlikeValue(`%${term}%`);
}

/** Компактен сериен № — само букви/цифри, без телефонни flexible шаблони. */
export function serialCompactIlikePatterns(raw: string): string[] {
  const compact = raw.replace(/[^a-zA-Z0-9]/g, "");
  if (compact.length < 3) return [];
  return [containsIlikePattern(compact)];
}

/** Търсене прилича на телефон (само цифри/+, интервали), не сериен № с букви. */
export function queryLooksLikePhone(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed || /[a-zA-Z]/.test(trimmed)) return false;
  return phoneDigitsOnly(trimmed).length >= 6;
}

/** SQL ILIKE шаблон: същите цифри подред, с произволни интервали/тирета/+359/0. */
export function phoneFlexibleIlikePattern(raw: string): string | null {
  const patterns = phoneFlexibleIlikePatterns(raw);
  return patterns[0] ?? null;
}

/** Всички SQL ILIKE варианти (0… и 359…) — за директни Supabase `.ilike()` заявки. */
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
    const p = digitsToFlexibleSqlPattern(v);
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

/** PostgREST `.or(...)` части — текст + гъвкаво търсене по телефон (0 / +359). */
export function buildAdminSearchOrParts(rawQ: string, fields: AdminSearchFields): string[] {
  const term = sanitizeIlikeTerm(rawQ);
  const parts: string[] = [];
  const phoneFieldSet = new Set(fields.phoneFields ?? []);

  if (term) {
    for (const field of fields.textFields) {
      if (phoneFieldSet.has(field)) continue;
      parts.push(`${field}.ilike.${containsIlikePattern(term)}`);
    }
  }

  const phonePatterns = queryLooksLikePhone(rawQ) ? phoneFlexibleIlikePatterns(rawQ) : [];
  if (phonePatterns.length && fields.phoneFields?.length) {
    for (const field of fields.phoneFields) {
      for (const pattern of phonePatterns) {
        parts.push(`${field}.ilike.${formatPostgrestIlikeValue(pattern)}`);
      }
    }
  }

  return parts;
}

/** PostgREST `.or(...)` — текст + гъвкаво търсене по телефон (0 / +359, без значение на интервалите). */
export function buildAdminSearchOrFilter(rawQ: string, fields: AdminSearchFields): string | null {
  const parts = buildAdminSearchOrParts(rawQ, fields);
  return parts.length ? parts.join(",") : null;
}

/** Продукти по име/модел/серийни № — отделна заявка (не в `.or()` на work_items). */
export async function findProductIdsForSaleSearch(
  supabase: SupabaseClient,
  rawQ: string,
): Promise<string[]> {
  const term = sanitizeIlikeTerm(rawQ);
  const parts: string[] = [];

  if (term) {
    parts.push(`name.ilike.${containsIlikePattern(term)}`);
    parts.push(`model_code.ilike.${containsIlikePattern(term)}`);
  }
  for (const pattern of serialCompactIlikePatterns(rawQ)) {
    parts.push(`indoor_unit_serial.ilike.${pattern}`);
    parts.push(`outdoor_unit_serial.ilike.${pattern}`);
  }
  if (!parts.length) return [];

  const { data, error } = await supabase.from("products").select("id").or(parts.join(",")).limit(300);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((row) => String(row.id)))];
}

/** Продажби: work_items колони + product_id от съвпадащи продукти. */
export async function buildSaleWorkItemSearchOrFilter(
  supabase: SupabaseClient,
  rawQ: string,
  fields: AdminSearchFields,
): Promise<string | null> {
  const parts = buildAdminSearchOrParts(rawQ, fields);
  const productIds = await findProductIdsForSaleSearch(supabase, rawQ);
  if (productIds.length > 0) {
    parts.push(`product_id.in.(${productIds.join(",")})`);
  }
  return parts.length ? parts.join(",") : null;
}
