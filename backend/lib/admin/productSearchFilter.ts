import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";
import { sanitizeIlikeTerm, tokenizeSearchQuery } from "@/lib/security/sanitizeSearchTerm";

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
