import {
  CONDEX_DEFAULT_SYNC_LISTING_URLS,
  collectCondexProductUrls,
  extractPaginationUrls,
  extractProductUrlsFromListing,
  stripListingPaginationPath,
} from "../lib/import/condex/collectCondexProducts";
import { fetchCondexHtml } from "../lib/import/condex/parseCondexProduct";

async function seriesUrls(root: string): Promise<Set<string>> {
  const r = new URL(root);
  const listingRootUrl = `${r.origin}${stripListingPaginationPath(r.pathname)}/`;
  const seed = await fetchCondexHtml(listingRootUrl);
  const pages = [listingRootUrl, ...extractPaginationUrls(seed, listingRootUrl)];
  const out = new Set<string>();
  for (let i = 0; i < pages.length; i++) {
    const html = i === 0 ? seed : await fetchCondexHtml(pages[i]!);
    for (const u of extractProductUrlsFromListing(html)) out.add(u);
  }
  return out;
}

async function main() {
  const collected = await collectCondexProductUrls({ listingUrls: CONDEX_DEFAULT_SYNC_LISTING_URLS });
  const zsPath = "/products/seria-premium-zs";
  const fromCollect = new Set(
    collected.filter((e) => e.listingCategoryPath === zsPath).map((e) => e.url),
  );
  const fromDirect = await seriesUrls("https://condex.bg/products/seria-premium-zs/");
  console.log("collect", fromCollect.size, "direct", fromDirect.size);
  for (const u of fromDirect) {
    if (!fromCollect.has(u)) console.log("only direct", u);
  }
  for (const u of fromCollect) {
    if (!fromDirect.has(u)) console.log("only collect", u);
  }
  const wrongPath = collected.filter((e) => e.url.includes("zs-w") && e.listingCategoryPath !== zsPath);
  console.log("zs products with other path", wrongPath.length);
  wrongPath.slice(0, 5).forEach((e) => console.log(e.listingCategoryPath, e.url));
}

main().catch(console.error);
