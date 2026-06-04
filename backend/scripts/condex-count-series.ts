/**
 * Count products for the 6 RAC wall series only.
 */
import {
  extractPaginationUrls,
  extractProductUrlsFromListing,
  stripListingPaginationPath,
} from "../lib/import/condex/collectCondexProducts";
import { fetchCondexHtml } from "../lib/import/condex/parseCondexProduct";

const SERIES = [
  "https://condex.bg/products/seria-diamond-zsx-zmx/",
  "https://condex.bg/products/seria-diamond-zr/",
  "https://condex.bg/products/seria-premium-pro-bg/",
  "https://condex.bg/products/seria-premium-zs/",
  "https://condex.bg/products/smart-plus/",
  "https://condex.bg/products/seria-standart-zsp/",
] as const;

async function crawlSeries(rootUrl: string): Promise<string[]> {
  const root = new URL(rootUrl);
  const listingRootPath = stripListingPaginationPath(root.pathname);
  const listingRootUrl = `${root.origin}${listingRootPath}/`;
  const seed = await fetchCondexHtml(listingRootUrl);
  const pages = [listingRootUrl, ...extractPaginationUrls(seed, listingRootUrl)];
  const urls = new Set<string>();
  for (let i = 0; i < pages.length; i++) {
    const pageUrl = pages[i]!;
    const html = i === 0 ? seed : await fetchCondexHtml(pageUrl);
    for (const u of extractProductUrlsFromListing(html)) urls.add(u);
  }
  return [...urls];
}

async function main() {
  let total = 0;
  for (const s of SERIES) {
    const urls = await crawlSeries(s);
    total += urls.length;
    const root = new URL(s);
    const listingRootUrl = `${root.origin}${stripListingPaginationPath(root.pathname)}/`;
    const seed = await fetchCondexHtml(listingRootUrl);
    const pageCount = 1 + extractPaginationUrls(seed, listingRootUrl).length;
    console.log(new URL(s).pathname, urls.length, `(${pageCount} pages)`);
  }
  console.log("TOTAL", total);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
