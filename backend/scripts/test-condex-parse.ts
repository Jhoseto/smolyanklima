/**
 * Тест на парсване на condex продукт (live URL).
 * Usage: CONDEX_TLS_INSECURE=1 npx tsx scripts/test-condex-parse.ts [url]
 */
import { fetchCondexHtml, parseCondexProductPage } from "../lib/import/condex/parseCondexProduct";

async function main() {
  if (process.env.CONDEX_TLS_INSECURE === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }
  const url = process.argv[2] ?? "https://condex.bg/product-details/srk-src-25-zsp-w/";
  const html = await fetchCondexHtml(url);
  const parsed = parseCondexProductPage(html, url, "/products/seria-standart-zsp/");
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
