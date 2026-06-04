/**
 * Проверка дали condex.bg блокира/лимитира обхождане (не наш код).
 */
import { collectCondexProductUrls, CONDEX_LISTING_ROOTS } from "../lib/import/condex/collectCondexProducts";
import { fetchCondexHtml } from "../lib/import/condex/parseCondexProduct";

async function probeRobotsAndHeaders() {
  const res = await fetch("https://condex.bg/robots.txt", {
    headers: { "User-Agent": "SmolyanKlimaCatalogSync/1.0 (+https://smolyanklima.com)" },
  });
  console.log("robots.txt", res.status);
  const text = await res.text();
  console.log(text.slice(0, 600));
  const sample = await fetch("https://condex.bg/products/seria-standart-zsp/", {
    headers: { "User-Agent": "SmolyanKlimaCatalogSync/1.0 (+https://smolyanklima.com)" },
  });
  console.log("\nlisting headers:");
  for (const k of ["server", "cf-ray", "x-ratelimit-limit", "retry-after", "x-cache"]) {
    const v = sample.headers.get(k);
    if (v) console.log(`  ${k}: ${v}`);
  }
  console.log("  status:", sample.status, "length:", (await sample.text()).length);
}

async function burstFetch(n: number) {
  let ok = 0;
  let blocked = 0;
  for (let i = 0; i < n; i++) {
    const url = `https://condex.bg/product-details/srk-src-${20 + (i % 5)}-zsp-w/`;
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "SmolyanKlimaCatalogSync/1.0 (+https://smolyanklima.com)" },
      });
      if (r.ok) ok++;
      else {
        blocked++;
        if (blocked <= 3) console.log("HTTP", r.status, url);
      }
    } catch (e) {
      blocked++;
      if (blocked <= 3) console.log("ERR", url, e);
    }
  }
  console.log(`\nburst ${n} product pages: ${ok} ok, ${blocked} fail`);
}

async function countFullHub() {
  const entries = await collectCondexProductUrls({ listingUrls: CONDEX_LISTING_ROOTS });
  console.log("\nfull CONDEX_LISTING_ROOTS (no hub):", entries.length, "unique URLs");
}

async function main() {
  await probeRobotsAndHeaders();
  await burstFetch(25);
  await countFullHub();
}

main().catch(console.error);
