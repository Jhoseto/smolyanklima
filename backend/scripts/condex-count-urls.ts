/**
 * Count Condex product URLs from default RAC series listings.
 * Usage: npx tsx scripts/condex-count-urls.ts
 */
import {
  CONDEX_DEFAULT_SYNC_LISTING_URLS,
  collectCondexProductUrls,
} from "../lib/import/condex/collectCondexProducts";

async function main() {
  const all = await collectCondexProductUrls(
    { listingUrls: CONDEX_DEFAULT_SYNC_LISTING_URLS },
    (p) => {
      if (p.message.includes("Серия") || p.message.includes("приключи")) {
        console.log(p.message);
      }
    },
  );
  console.log("\nTOTAL (6 series):", all.length);

  for (const root of CONDEX_DEFAULT_SYNC_LISTING_URLS) {
    const path = new URL(root).pathname.replace(/\/$/, "");
    const subset = all.filter((e) => e.listingCategoryPath === path);
    console.log(path, subset.length);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
