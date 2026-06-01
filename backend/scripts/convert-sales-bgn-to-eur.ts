/**
 * Преглед / ръчно прилагане на BGN→EUR за исторически продажби.
 *
 * Usage:
 *   cd backend && npx tsx scripts/convert-sales-bgn-to-eur.ts
 *   cd backend && npx tsx scripts/convert-sales-bgn-to-eur.ts --apply
 */
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { applySalesBgnToEur, previewSalesBgnToEur } from "../lib/admin/convertSalesBgnToEur";
import { BGN_PER_EUR, SALES_BGN_SALE_DATE_CUTOFF } from "../lib/admin/currency";

dotenv.config({ path: ".env.local", override: true });

const apply = process.argv.includes("--apply");

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  const sb = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log(
    `BGN→EUR conversion | sale date <= 2026-01-31 (cutoff ${SALES_BGN_SALE_DATE_CUTOFF}) | rate ${BGN_PER_EUR}`,
  );
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}\n`);

  if (!apply) {
    const preview = await previewSalesBgnToEur(sb);
    console.log(JSON.stringify(preview, null, 2));
    console.log("\nRun with --apply to update database.");
    return;
  }

  const result = await applySalesBgnToEur(sb);
  console.log("Done:", result);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
