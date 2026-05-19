#!/usr/bin/env npx ts-node --project tsconfig.json
/**
 * Quick sanity-check for the Bittel parser.
 * Usage:  npx ts-node scripts/test-bittel-parse.ts [URL]
 *
 * Default URL: Daikin Sensira product page
 */

import { fetchBittelHtml, parseBittelProductPage, extractBittelProductSpecs, extractBittelPriceEur, extractBittelModelCode } from "../lib/import/bittel/parseBittelProduct";

const DEFAULT_URL = "https://www.bittel.bg/invertoren-klimatik-daikin-sensira-ftxf35-f-rxf35-f";

async function main() {
  const url = process.argv[2] ?? DEFAULT_URL;
  console.log(`Fetching: ${url}\n`);

  const html = await fetchBittelHtml(url);
  console.log(`HTML size: ${html.length} bytes`);

  const price = extractBittelPriceEur(html);
  console.log(`Price (EUR): ${price}`);

  const parsed = parseBittelProductPage(html, url);
  if (!parsed) {
    console.error("Parser returned null — no price or name found.");
    process.exit(1);
  }

  console.log("\n=== Parsed product ===");
  console.log(`Name:       ${parsed.name}`);
  console.log(`Brand:      ${parsed.brandName}`);
  console.log(`Model:      ${parsed.modelCode}`);
  console.log(`Price EUR:  ${parsed.priceEur}`);
  console.log(`Price+mnt:  ${parsed.priceWithMountEur}`);
  console.log(`Category:   ${parsed.categorySlug}`);
  console.log(`TypeHint:   ${parsed.typeHint}`);
  console.log(`Images:     ${parsed.imageUrls.length}`, parsed.imageUrls);
  console.log(`Features:   ${parsed.featureLabels.length}`, parsed.featureLabels.slice(0, 5));
  console.log("\n=== Specs ===");
  console.log(JSON.stringify(parsed.specs, null, 2));
  console.log("\n=== Description ===");
  console.log(parsed.description?.slice(0, 300));
}

main().catch((e) => { console.error(e); process.exit(1); });
