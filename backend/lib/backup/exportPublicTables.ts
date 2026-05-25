import type { SupabaseClient } from "@supabase/supabase-js";
import { listPublicTablesForBackup } from "./listPublicTables";

const PAGE = 2000;

export type BackupExportResult = {
  exportedAt: string;
  names: string[];
  data: Record<string, Record<string, unknown>[]>;
  tableErrors: Record<string, string>;
};

export async function exportAllPublicTables(supabase: SupabaseClient): Promise<BackupExportResult> {
  const names = await listPublicTablesForBackup(supabase);
  const exportedAt = new Date().toISOString();
  const data: Record<string, Record<string, unknown>[]> = {};
  const tableErrors: Record<string, string> = {};

  for (const table of names) {
    const rows: Record<string, unknown>[] = [];
    let offset = 0;
    let errMsg: string | null = null;
    for (;;) {
      const { data: chunk, error } = await supabase.from(table).select("*").range(offset, offset + PAGE - 1);
      if (error) {
        errMsg = error.message;
        break;
      }
      const part = (chunk ?? []) as Record<string, unknown>[];
      rows.push(...part);
      if (part.length < PAGE) break;
      offset += PAGE;
    }
    if (errMsg) tableErrors[table] = errMsg;
    else data[table] = rows;
  }

  return { exportedAt, names, data, tableErrors };
}

/** Име на файл с локална дата/час (Europe/Sofia). */
export function backupFilename(exportedAt: string, ext: "json" | "xlsx"): string {
  const d = new Date(exportedAt);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value?.padStart(2, "0") ?? "00";
  const stamp = `${pick("year")}-${pick("month")}-${pick("day")}_${pick("hour")}-${pick("minute")}-${pick("second")}`;
  if (ext === "xlsx") return `smolyanklima-prodazhbi-stoka-${stamp}.xml`;
  return `smolyanklima-backup-${stamp}.json`;
}
