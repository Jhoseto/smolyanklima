/**
 * Тест на парсване на bulclima продукт (локален HTML или live URL).
 * Usage: npx tsx scripts/test-bulclima-parse.ts [url|path-to.html]
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fetchBulclimaHtml, parseBulclimaProductPage } from "../lib/import/bulclima/parseBulclimaHtml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const arg = process.argv[2];
  let html: string;
  let sourceUrl = "https://bulclima.com/product/test/";

  if (arg && fs.existsSync(arg)) {
    html = fs.readFileSync(arg, "utf8");
    sourceUrl = "https://bulclima.com/product/local-fixture/";
  } else if (arg?.startsWith("http")) {
    if (process.env.BULCLIMA_TLS_INSECURE === "1") {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }
    html = await fetchBulclimaHtml(arg);
    sourceUrl = arg;
  } else {
    const fixture = path.resolve(__dirname, "../.tmp-bulclima-product.html");
    if (!fs.existsSync(fixture)) {
      console.error("Няма fixture. Пусни inspect-bulclima-page.mjs или подай URL.");
      process.exit(1);
    }
    html = fs.readFileSync(fixture, "utf8");
    sourceUrl = "https://bulclima.com/product/invertoren-klimatik-stenen-general-ashh07kmcg-baohh07kmcg-b";
  }

  const parsed = parseBulclimaProductPage(html, sourceUrl);
  console.log(JSON.stringify(parsed, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
