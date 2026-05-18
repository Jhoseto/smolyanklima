import { readFileSync } from "fs";
import { extractCondexProductSpecs } from "../lib/import/condex/parseCondexProduct";

const CASES: Array<{ file: string; name: string }> = [
  { file: ".tmp-condex-fdtc25vh1.html", name: "Mitsubishi Heavy Industries FDTC25VH1 / SRC25ZS-W1*" },
  {
    file: ".tmp-condex-multi-split-sistemi-srk-20-zs-w-2.html",
    name: "Mitsubishi Heavy Industries SRK 20 ZS-W",
  },
];

for (const { file, name } of CASES) {
  const html = readFileSync(file, "utf8");
  const specs = extractCondexProductSpecs(html, { name, description: null });
  console.log("\n===", file, "===");
  console.log(JSON.stringify(specs, null, 2));
}
