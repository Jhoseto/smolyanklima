/**
 * Брой продуктови URL от stenni + multi-split (без запис в БД).
 * Usage: BULCLIMA_TLS_INSECURE=1 npx tsx scripts/bulclima-count-urls.ts
 */
import {
  BULCLIMA_DEFAULT_SYNC_LISTING_URLS,
  collectBulclimaProductUrls,
} from "../lib/import/bulclima/parseBulclimaHtml";

async function main() {
  if (process.env.BULCLIMA_TLS_INSECURE === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  const entries = await collectBulclimaProductUrls(
    { listingUrls: BULCLIMA_DEFAULT_SYNC_LISTING_URLS },
    (m) => console.log(m),
  );
  const byCat = new Map<string, number>();
  for (const e of entries) {
    const p = e.listingCategoryPath ?? "?";
    byCat.set(p, (byCat.get(p) ?? 0) + 1);
  }
  console.log("\nTOTAL", entries.length);
  for (const [k, v] of byCat) console.log(k, v);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
