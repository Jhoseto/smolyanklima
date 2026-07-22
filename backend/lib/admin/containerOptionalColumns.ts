/**
 * Полета на `containers`, добавени с миграции 0098/0099, които все още може
 * да не са приложени във всяка среда. GET/POST/PATCH за контейнери се
 * опитват с всички колони и „свиват“ селекта/payload-а при липсваща колона,
 * вместо да гърмят с 500 — по същия модел като `container_id` в products.
 */
export const CONTAINER_BASE_SELECT =
  "id,name,year,sequence_in_year,arrival_date,notes,created_at,updated_at";

export const CONTAINER_OPTIONAL_COLUMNS = [
  "supplier_name",
  "departure_date",
  "customs_duty",
  "vat_amount",
  "japan_price",
  "transport_to_bulgaria",
  "transport_to_smolyan",
] as const;

export function buildContainerSelect(columns: readonly string[]): string {
  return [CONTAINER_BASE_SELECT, ...columns].join(",");
}

/** Форма на реда, връщан от dynamic select-а по-горе (не литерален string, затова supabase-js не може да го изведе сам). */
export type ContainerDbRow = {
  id: string;
  name: string;
  year: number;
  sequence_in_year: number;
  arrival_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier_name?: string | null;
  departure_date?: string | null;
  customs_duty?: number | null;
  vat_amount?: number | null;
  japan_price?: number | null;
  transport_to_bulgaria?: number | null;
  transport_to_smolyan?: number | null;
};

export type PgError = { message?: string; code?: string; details?: string } | null;
