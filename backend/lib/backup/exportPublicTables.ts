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

export function backupFilename(exportedAt: string, ext: "json" | "xlsx"): string {
  const stamp = exportedAt.replace(/[:]/g, "-").replace(/\./g, "-");
  if (ext === "xlsx") return `smolyanklima-prodazhbi-stoka-${stamp}.xml`;
  return `smolyanklima-backup-${stamp}.json`;
}
