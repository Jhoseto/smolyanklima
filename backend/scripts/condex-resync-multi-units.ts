/**
 * Повторен импорт само на multi-split вътрешни/външни тела от Condex.
 * Usage: CONDEX_TLS_INSECURE=1 npx tsx scripts/condex-resync-multi-units.ts
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { runCondexCatalogSync } from "../lib/import/condex/syncCondexCatalog";
import { CONDEX_DEFAULT_SYNC_LISTING_URLS } from "../lib/import/condex/collectCondexProducts";

const MULTI_ONLY = CONDEX_DEFAULT_SYNC_LISTING_URLS.filter((u) =>
  /vatreshni|vanshni|diamond-srk|vatreshni-tela-/i.test(u),
);

async function main() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
  if (process.env.CONDEX_TLS_INSECURE === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Липсват SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env.local");
    process.exit(1);
  }
  const supabase = createClient(url, key);
  console.log("Листинги:", MULTI_ONLY.length);
  const summary = await runCondexCatalogSync(supabase, {
    listingUrls: MULTI_ONLY,
    onProgress: (ev) => {
      if (ev.message) console.log(ev.message);
    },
  });
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
