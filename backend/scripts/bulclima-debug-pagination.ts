import fs from "node:fs";
import { fetchBulclimaHtml, extractPaginationUrls, extractProductUrlsFromListing } from "../lib/import/bulclima/parseBulclimaHtml";

async function main() {
  if (process.env.BULCLIMA_TLS_INSECURE === "1") process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  const url = "https://bulclima.com/products/klimatici/stenni-klimatici";
  const html = await fetchBulclimaHtml(url);
  fs.writeFileSync(".tmp-stenni-listing.html", html);
  console.log("products page1", extractProductUrlsFromListing(html).length);
  console.log("pagination urls", extractPaginationUrls(html, url));
  const p2 = await fetchBulclimaHtml(url + "?page=2");
  console.log("page2 products", extractProductUrlsFromListing(p2).length);
  const ids = [...html.matchAll(/"productId":\s*(\d+)/g)].map((m) => m[1]);
  console.log("jsData productIds", ids.length, ids.slice(0, 5));
  for (const pat of ["pagination", "Следваща", "page=", "paged=", "/page/", "data-page", "currentPage"]) {
    const i = html.toLowerCase().indexOf(pat.toLowerCase());
    console.log(pat, i >= 0 ? `found@${i}` : "no");
  }
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]).filter((h) => /page|paged/i.test(h)).slice(0, 15);
  console.log("page hrefs", hrefs);
}

main();
