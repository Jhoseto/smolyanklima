import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  collectCondexProductUrls,
  CONDEX_DEFAULT_SYNC_LISTING_URLS,
} from "../lib/import/condex/collectCondexProducts";
import { classifyCondexCatalogItem } from "../lib/import/condex/classifyCondexItem";
import { fetchCondexHtml, parseCondexProductPage } from "../lib/import/condex/parseCondexProduct";

async function main() {
  if (process.env.CONDEX_TLS_INSECURE === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const urls = await collectCondexProductUrls({ listingUrls: CONDEX_DEFAULT_SYNC_LISTING_URLS });
  const srk25 = urls.filter((e) => /25.*zsx/i.test(e.url));
  console.log("\n=== CRAWL: SRK/SRC 25 ZSX URLs ===", srk25.length);
  for (const e of srk25) console.log(e.url);

  const slugs = [
    "srk-25-zsx-w/",
    "srk-25-zsx-wb/",
    "srk-src-25-zsx-w/",
    "srk-src-25-zsx-wb/",
  ];
  for (const slug of slugs) {
    const hit = urls.find((e) => e.url.includes(slug));
    console.log(slug, hit ? "in crawl" : "MISSING", hit?.listingCategoryPath ?? "");
  }

  const testUrl = "https://condex.bg/product-details/srk-25-zsx-wb/";
  const html = await fetchCondexHtml(testUrl);
  const parsed = parseCondexProductPage(
    html,
    testUrl,
    "/products/%d1%81%d1%82%d0%b5%d0%bd%d0%b5%d0%bd-%d1%82%d0%b8%d0%bf-%d1%81%d0%b5%d1%80%d0%b8%d1%8f-diamond-srk-zsx/",
  );
  const kind = parsed
    ? classifyCondexCatalogItem(parsed, testUrl, "/products/%d1%81%d1%82%d0%b5%d0%bd%d0%b5%d0%bd-%d1%82%d0%b8%d0%bf-%d1%81%d0%b5%d1%80%d0%b8%d1%8f-diamond-srk-zsx/")
    : null;
  console.log("\nParse srk-25-zsx-wb:", parsed?.modelCode, parsed?.name?.slice(0, 60), "kind", kind);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
  const sbUrl = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !key) {
    console.log("\n(No .env.local — skip DB check)");
    return;
  }
  const supabase = createClient(sbUrl, key);

  const patterns = ["%srk-25-zsx%", "%SRK25ZSX%", "%мулти-сплит%SRK%25%ZSX%"];
  console.log("\n=== DB products ===");
  for (const pat of patterns) {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,model_code,source_url,stock_status")
      .or(`name.ilike.${pat},model_code.ilike.${pat},source_url.ilike.${pat}`)
      .limit(20);
    if (error) console.log("err", pat, error.message);
    else console.log(pat, (data ?? []).length, (data ?? []).map((r) => ({ mc: r.model_code, url: r.source_url })));
  }

  console.log("\n=== DB accessories (condex srk-25-zsx) ===");
  const { data: acc } = await supabase
    .from("accessories")
    .select("id,name,source_url,kind")
    .or("source_url.ilike.%srk-25-zsx%,name.ilike.%SRK%25%ZSX%")
    .limit(30);
  console.log((acc ?? []).length, acc);

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .ilike("source_url", "%condex.bg/product-details%");
  console.log("\nTotal products with condex source_url:", count);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
