/**
 * Burst-fetch all Condex product URLs to detect blocking (403/429).
 * Usage: npx tsx scripts/condex-burst-fetch.ts
 */
import {
  CONDEX_DEFAULT_SYNC_LISTING_URLS,
  collectCondexProductUrls,
} from "../lib/import/condex/collectCondexProducts";

async function main() {
  const entries = await collectCondexProductUrls(
    { listingUrls: CONDEX_DEFAULT_SYNC_LISTING_URLS },
    (p) => {
      if (p.message.includes("Серия") || p.message.includes("приключи")) {
        console.log(p.message);
      }
    },
  );
  console.log("urls to fetch", entries.length);

  let ok = 0;
  let e403 = 0;
  let e429 = 0;
  let e404 = 0;
  let other = 0;
  const t0 = Date.now();

  for (const { url } of entries) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "SmolyanKlimaCatalogSync/1.0 (+https://smolyanklima.com)" },
      });
      if (r.ok) ok++;
      else if (r.status === 403) e403++;
      else if (r.status === 429) e429++;
      else if (r.status === 404) e404++;
      else other++;
    } catch {
      other++;
    }
  }

  console.log({ ok, e403, e429, e404, other, sec: Math.round((Date.now() - t0) / 1000) });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
