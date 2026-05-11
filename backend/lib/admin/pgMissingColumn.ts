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
  if (code === "42703") return true;
  return false;
}
