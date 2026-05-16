/** PostgREST / Postgres: липсваща колона (преди миграция или различна схема). */
export function isPostgrestMissingColumn(
  error: { code?: string; message?: string; details?: string } | null | undefined,
  columnName: string,
): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const msg = String(error.message ?? "").toLowerCase();
  const col = columnName.toLowerCase();
  if (!msg.includes(col)) return false;
  if (msg.includes("does not exist")) return true;
  if (msg.includes("undefined column")) return true;
  if (msg.includes("schema cache") && msg.includes("could not find")) return true;
  if (msg.includes("could not find") && msg.includes(col)) return true;
  if (code === "42703") return true;
  if (code === "PGRST204") return true;
  return false;
}

/** PostgREST / Postgres: липсваща таблица (преди миграция). */
export function isPostgrestMissingRelation(
  error: { code?: string; message?: string; details?: string } | null | undefined,
  relationName: string,
): boolean {
  if (!error) return false;
  const code = String(error.code ?? "");
  const msg = String(error.message ?? "").toLowerCase();
  const rel = relationName.toLowerCase();
  if (!msg.includes(rel)) return false;
  if (msg.includes("does not exist")) return true;
  if (msg.includes("could not find")) return true;
  if (msg.includes("schema cache")) return true;
  if (code === "42P01") return true;
  if (code === "PGRST205") return true;
  return false;
}
