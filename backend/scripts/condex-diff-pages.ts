import {
  buildCondexListingPageUrls,
  extractPaginationUrls,
  extractProductUrlsFromListing,
  stripListingPaginationPath,
} from "../lib/import/condex/collectCondexProducts";
import { fetchCondexHtml } from "../lib/import/condex/parseCondexProduct";

async function main() {
  const url = "https://condex.bg/products/seria-premium-zs/";
  const root = new URL(url);
  const path = stripListingPaginationPath(root.pathname);
  const listingRootUrl = `${root.origin}${path}/`;
  const seed = await fetchCondexHtml(listingRootUrl);
  const build = buildCondexListingPageUrls(listingRootUrl, seed);
  const pag = [listingRootUrl, ...extractPaginationUrls(seed, listingRootUrl)];
  console.log("build", build.length, build);
  console.log("pag", pag.length, pag);
  const missing = pag.filter((p) => !build.includes(p));
  const extra = build.filter((p) => !pag.includes(p));
  console.log("missing from build", missing);
  console.log("extra in build", extra);
}

main().catch(console.error);
