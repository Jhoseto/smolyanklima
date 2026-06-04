import { fetchCondexHtml } from "../lib/import/condex/parseCondexProduct";
import * as fs from "fs";

const url = process.argv[2] ?? "https://condex.bg/products/seria-premium-zs/";

async function main() {
  const html = await fetchCondexHtml(url);
  const idx = html.indexOf("SRK / SRC 20 ZS-WT");
  if (idx < 0) {
    console.log("not found");
    return;
  }
  const slice = html.slice(Math.max(0, idx - 800), idx + 2500);
  fs.writeFileSync(".tmp-condex-card.html", slice, "utf8");
  console.log("wrote .tmp-condex-card.html", slice.length);
}

main().catch(console.error);
