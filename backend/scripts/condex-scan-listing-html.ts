import { fetchCondexHtml } from "../lib/import/condex/parseCondexProduct";

const url = process.argv[2] ?? "https://condex.bg/products/seria-premium-zs/";

async function main() {
  const html = await fetchCondexHtml(url);
  const details = [...html.matchAll(/product-details\/[^"'#?\s]+/gi)].map((m) => m[0]);
  const detailsUnique = new Set(details);
  const detailsLinks = [...html.matchAll(/href=["']([^"']*Details[^"']*)["']/gi)].map((m) => m[1]);
  const h5 = [...html.matchAll(/<h5[^>]*>([\s\S]*?)<\/h5>/gi)].map((m) => m[1]!.replace(/<[^>]+>/g, "").trim());
  console.log("URL", url);
  console.log("product-details slugs", detailsUnique.size);
  console.log("h5 cards", h5.length);
  console.log("Details hrefs", detailsLinks.length, detailsLinks.slice(0, 5));
  if (h5.length > detailsUnique.size) {
    console.log("h5 sample", h5.slice(0, 12));
  }
}

main().catch(console.error);
