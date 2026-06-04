import {
  extractPaginationUrls,
  extractProductUrlsFromListing,
  stripListingPaginationPath,
} from "../lib/import/condex/collectCondexProducts";
import { fetchCondexHtml } from "../lib/import/condex/parseCondexProduct";

async function main() {
  const base = "https://condex.bg/products/seria-diamond-zsx-zmx/";
  const root = new URL(base);
  const path = stripListingPaginationPath(root.pathname);
  const listingRootUrl = `${root.origin}${path}/`;
  const seed = await fetchCondexHtml(listingRootUrl);
  const pages = [listingRootUrl, ...extractPaginationUrls(seed, listingRootUrl)];
  const byPage: string[][] = [];
  for (let i = 0; i < pages.length; i++) {
    const html = i === 0 ? seed : await fetchCondexHtml(pages[i]!);
    byPage.push(extractProductUrlsFromListing(html));
  }
  const all = new Set(byPage.flat());
  console.log("pages", pages.length);
  byPage.forEach((u, i) =>
    console.log(`page ${i + 1}:`, u.length, u.map((x) => x.split("/").slice(-2, -1)[0]).join(", ")),
  );
  console.log("total unique", all.size);
}
main().catch(console.error);
