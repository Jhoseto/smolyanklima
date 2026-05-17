/**
 * CLI: синхронизация на каталог от condex.bg (RAC + multi-split)
 * Usage: npm run import:condex [-- --limit=20]
 * При TLS грешка на Windows: CONDEX_TLS_INSECURE=1 npm run import:condex
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { runCondexCatalogSync } from "../lib/import/condex/syncCondexCatalog";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  const supabase = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));

  console.log("[condex] Старт на sync…");
  const summary = await runCondexCatalogSync(supabase, {
    limit,
    onProgress: (ev) => console.log(`[${ev.phase}] ${ev.message}`),
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
