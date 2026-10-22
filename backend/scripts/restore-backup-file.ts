/**
 * Restore public tables from a local JSON backup file.
 * Usage: npx tsx scripts/restore-backup-file.ts <path> [--mode merge|replace]
 */
import fs from "node:fs";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { importPublicTablesBackup, parseBackupFile } from "../lib/backup/importPublicTablesBackup";
import { listPublicTablesForBackup } from "../lib/backup/listPublicTables";

dotenv.config({ path: ".env.local", override: true });

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  const file = process.argv[2];
  const modeArg = process.argv.find((a) => a.startsWith("--mode="))?.split("=")[1];
  const mode = modeArg === "merge" ? "merge" : "replace";

  if (!file) {
    console.error("Usage: npx tsx scripts/restore-backup-file.ts <backup.json> [--mode=replace|merge]");
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const payload = parseBackupFile(raw);

  console.log(`Restoring ${file}`);
  console.log(`Exported: ${payload.manifest.exportedAt}, tables: ${payload.manifest.tables.length}, mode: ${mode}`);

  const sb = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const currentTables = mode === "replace" ? await listPublicTablesForBackup(sb) : undefined;
  const result = await importPublicTablesBackup(sb, payload, mode, { currentTables });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
