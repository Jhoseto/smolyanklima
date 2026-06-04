import {
  extractPaginationUrls,
  extractProductUrlsFromListing,
} from "../lib/import/condex/collectCondexProducts";
import { fetchCondexHtml } from "../lib/import/condex/parseCondexProduct";

const url = process.argv[2] ?? "https://condex.bg/products/seria-diamond-zsx-zmx/";

async function main() {
  const html = await fetchCondexHtml(url);
  const products = extractProductUrlsFromListing(html);
  const pages = extractPaginationUrls(html, url);
  console.log("URL:", url);
  console.log("Products on page 1:", products.length);
  console.log("Pagination pages:", pages.length, pages.slice(0, 5));
  console.log("Sample URLs:", products.slice(0, 5));
  const page2 = pages[0];
  if (page2) {
    const html2 = await fetchCondexHtml(page2);
    const p2 = extractProductUrlsFromListing(html2);
    console.log("\nPage 2:", page2);
    console.log("Products on page 2:", p2.length);
  }
}

main().catch(console.error);
