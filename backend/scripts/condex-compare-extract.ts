import { extractProductUrlsFromListing } from "../lib/import/condex/collectCondexProducts";
import { fetchCondexHtml } from "../lib/import/condex/parseCondexProduct";

function extractPerCard(html: string): string[] {
  const urls: string[] = [];
  const re = /class=["']col product_item_holder[\s\S]*?(?=class=["']col product_item_holder|<div class=["']row clearfix)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const block = m[0];
    const detail =
      block.match(/class=["'][^"']*details[^"']*["'][^>]*href=["']([^"']+product-details\/[^"']+)["']/i)?.[1] ??
      block.match(/class=["']clean_heading["'][\s\S]*?href=["']([^"']+product-details\/[^"']+)["']/i)?.[1] ??
      block.match(/href=["']([^"']+product-details\/[^"']+)["']/i)?.[1];
    if (detail) {
      const norm = detail.startsWith("http") ? detail : `https://condex.bg${detail}`;
      urls.push(norm.replace(/\/$/, "") + "/");
    }
  }
  return urls;
}

async function main() {
  for (const url of [
    "https://condex.bg/products/seria-premium-zs/",
    "https://condex.bg/products/seria-diamond-zsx-zmx/",
  ]) {
    const html = await fetchCondexHtml(url);
    const flat = extractProductUrlsFromListing(html);
    const cards = extractPerCard(html);
    console.log("\n", url);
    console.log("flat", flat.length, "cards", cards.length);
    const cardSet = new Set(cards);
    const flatSet = new Set(flat);
    console.log("unique flat", flatSet.size, "unique cards", cardSet.size);
    for (const u of cards) {
      if (!flatSet.has(u.replace(/\/$/, "") + "/") && !flatSet.has(u)) console.log("only in cards", u);
    }
  }
}

main().catch(console.error);
