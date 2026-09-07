import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { sanitizeIlikeTerm, tokenizeSearchQuery, tokenizeFlexibleSearchQuery } from "@/lib/security/sanitizeSearchTerm";
import {
  alphanumericFlexibleIlikePattern,
  formatPostgrestIlikeValue,
  phoneFlexibleIlikePatterns,
  queryLooksLikePhone,
} from "@/lib/admin/phoneSearchPattern";

function ilikeOrClause(fields: string[], term: string): string {
  return fields.map((f) => `${f}.ilike.%${term}%`).join(",");
}

/**
 * Всяка дума/част → отделен `.or()` (PostgREST ги комбинира с AND).
 * Редът в заглавието не е важен; „AP 35VG Mitsubishi“ намира „Mitsubishi … AP-35VG“.
 */
export function applyAdminTextSearchFilter<T extends PostgrestFilterBuilder<any, any, any, any, any>>(
  query: T,
  q: string,
  fields: string[],
): T {
  const full = sanitizeIlikeTerm(q);
  if (!full || fields.length === 0) return query;

  const tokens = tokenizeSearchQuery(q);
  const terms = tokens.length > 0 ? tokens : [full];

  let next = query;
  for (const term of terms) {
    next = next.or(ilikeOrClause(fields, term)) as T;
  }
  return next;
}

export const ADMIN_PRODUCT_SEARCH_FIELDS_FULL = [
  "name",
  "slug",
  "model_code",
  "indoor_unit_serial",
  "outdoor_unit_serial",
  "supplier_invoice_number",
] as const;

export const ADMIN_PRODUCT_SEARCH_FIELDS_BASIC = ["name", "slug", "model_code"] as const;

export const ADMIN_ACCESSORY_SEARCH_FIELDS = ["name", "slug", "description"] as const;

export function applyAdminProductSearchFilter<T extends PostgrestFilterBuilder<any, any, any, any, any>>(
  query: T,
  q: string,
  applySupplyFields: boolean,
): T {
  const fields = applySupplyFields
    ? [...ADMIN_PRODUCT_SEARCH_FIELDS_FULL]
    : [...ADMIN_PRODUCT_SEARCH_FIELDS_BASIC];
  return applyAdminTextSearchFilter(query, q, fields);
}

export function applyAdminAccessorySearchFilter<T extends PostgrestFilterBuilder<any, any, any, any, any>>(
  query: T,
  q: string,
): T {
  return applyAdminTextSearchFilter(query, q, [...ADMIN_ACCESSORY_SEARCH_FIELDS]);
}

/**
 * Търсене без значение от главни/малки букви, интервали и символи между частите.
 * Всяка дума → гъвкав ILIKE (*б*у*к*в*и*); думите се комбинират с AND, редът не е важен.
 */
export function applyAdminFlexibleTextSearchFilter<T extends PostgrestFilterBuilder<any, any, any, any, any>>(
  query: T,
  q: string,
  fields: string[],
): T {
  if (fields.length === 0) return query;

  const tokens = tokenizeFlexibleSearchQuery(q);
  const fallbackCompact = alphanumericFlexibleIlikePattern(q);
  const terms =
    tokens.length > 0
      ? tokens
      : fallbackCompact
        ? [q.replace(/[^a-zA-Z0-9\u0400-\u04FF]/gi, "")]
        : [];

  if (terms.length === 0) return query;

  let next = query;
  for (const term of terms) {
    const pattern = alphanumericFlexibleIlikePattern(term);
    if (!pattern) continue;
    next = next.or(flexibleOrClause(fields, pattern)) as T;
  }
  return next;
}

function flexibleOrClause(fields: string[], pattern: string): string {
  return fields.map((f) => `${f}.ilike.${pattern}`).join(",");
}

/** Сервизни протоколи — токенизирано търсене по думи + телефон + серийни №. */
export function applyAdminRepairProtocolSearchFilter<T extends PostgrestFilterBuilder<any, any, any, any, any>>(
  query: T,
  q: string,
  opts?: { includeBrand?: boolean; includeRecycleSerials?: boolean },
): T {
  const trimmed = q.trim();
  if (!trimmed) return query;

  // Само телефон (0887…, +359…) — без допълнителни AND филтри по серийни/текст.
  if (queryLooksLikePhone(trimmed)) {
    let next = query;
    for (const pattern of phoneFlexibleIlikePatterns(trimmed)) {
      next = next.or(`client_phone.ilike.${formatPostgrestIlikeValue(pattern)}`) as T;
    }
    return next;
  }

  const fields = [
    "client_name",
    "client_phone",
    "protocol_number",
    "ac_model",
    "address",
    "serial_number",
  ];
  if (opts?.includeBrand !== false) fields.push("ac_brand");
  if (opts?.includeRecycleSerials) {
    fields.push("indoor_unit_serial", "outdoor_unit_serial");
  }

  // Гъвкаво: игнорира case, интервали и символи (/ - .) в записа.
  return applyAdminFlexibleTextSearchFilter(query, q, fields);
}
