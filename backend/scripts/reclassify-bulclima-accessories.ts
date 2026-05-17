/**
 * CLI: преместване на грешно внесени аксесоари от products → accessories
 * Usage: npm run reclassify:accessories [-- --dry-run]
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { reclassifyMisplacedProductsToAccessories } from "../lib/import/bulclima/reclassifyMisplacedToAccessories";

function requiredEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

  const dryRun = process.argv.includes("--dry-run");
  const supabase = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));

  console.log(`[reclassify] ${dryRun ? "Преглед (dry-run)" : "Преместване"}…`);
  const summary = await reclassifyMisplacedProductsToAccessories(supabase, { dryRun });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
