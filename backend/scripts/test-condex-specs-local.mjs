import { readFileSync } from "fs";
import { extractCondexProductSpecs } from "../lib/import/condex/parseCondexProduct.ts";

for (const file of [".tmp-condex-fdtc25vh1.html", ".tmp-condex-multi-split-sistemi-srk-20-zs-w-2.html"]) {
  const html = readFileSync(file, "utf8");
  const specs = extractCondexProductSpecs(html);
  console.log("\n===", file, "===");
  console.log(JSON.stringify(specs, null, 2));
}
