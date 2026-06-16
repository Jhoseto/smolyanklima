import {
  PRIMARY_MATERIALS,
  LEFT_MATERIALS,
  RIGHT_MATERIALS,
  PROTOCOL_MATERIALS,
  PDF_LEFT_MATERIALS,
  PDF_RIGHT_MATERIALS,
  resolveMaterialQty,
} from "../lib/protocol-materials";

const PDF_ALL = [...PDF_LEFT_MATERIALS, ...PDF_RIGHT_MATERIALS];
const PDF_IDS = new Set(PDF_ALL.map((m) => m.id));

const COMBINED_SOURCES: Record<string, string[]> = {
  dyubel_prp_80: ["pri_dyubel_10x80", "dyubel_prp_80"],
  dyubel_prp_100: ["pri_dyubel_10x100", "dyubel_prp_100"],
  dyubel_prp_120: ["pri_dyubel_10x120", "dyubel_prp_120"],
  dyubel_prp_140: ["pri_dyubel_10x140", "dyubel_prp_140"],
  dyubel_prp_160: ["pri_dyubel_10x160", "dyubel_prp_160"],
  dyubel_trv: ["pri_dyubel_8x60", "dyubel_trv"],
};

function wizardIdVisibleInPdf(wizardId: string): string | null {
  if (PDF_IDS.has(wizardId)) return `директен PDF ред: ${wizardId}`;
  for (const [pdfId, sources] of Object.entries(COMBINED_SOURCES)) {
    if (sources.includes(wizardId)) return `комбиниран PDF ред: ${pdfId}`;
  }
  return null;
}

const wizardIds = PROTOCOL_MATERIALS.map((m) => m.id);
const dup = wizardIds.filter((id, i) => wizardIds.indexOf(id) !== i);
const missing = PROTOCOL_MATERIALS.filter((m) => !wizardIdVisibleInPdf(m.id));

const pdfNotEnterable = PDF_ALL.filter((m) => {
  if (Object.keys(COMBINED_SOURCES).includes(m.id)) return false;
  return !wizardIds.includes(m.id);
});

const testQty = Object.fromEntries(wizardIds.map((id) => [id, 1]));
const resolveFails: string[] = [];
for (const m of PDF_ALL) {
  const q = resolveMaterialQty(m.id, testQty);
  if (!q) resolveFails.push(m.id);
}

console.log("=== Обобщение ===");
console.log(`PDF редове: ${PDF_ALL.length}`);
console.log(`Стъпка 2 (PRIMARY): ${PRIMARY_MATERIALS.length}`);
console.log(`Стъпка 4 (LEFT): ${LEFT_MATERIALS.length}`);
console.log(`Стъпка 5 (RIGHT): ${RIGHT_MATERIALS.length}`);
console.log(`PROTOCOL_MATERIALS: ${PROTOCOL_MATERIALS.length} (${new Set(wizardIds).size} уникални)`);

if (dup.length) console.log("\nДублирани ID:", [...new Set(dup)]);
else console.log("\nДублирани ID: няма");

if (missing.length) {
  console.log("\nWizard ID без PDF ред:");
  for (const m of missing) console.log(`  - ${m.id} (${m.name})`);
} else console.log("\nOK: Всички wizard материали се появяват в PDF");

if (pdfNotEnterable.length) {
  console.log("\nPDF редове без поле в уизарда:");
  for (const m of pdfNotEnterable) console.log(`  - ${m.id} (${m.name})`);
} else console.log("\nOK: Всички PDF редове могат да се попълнят от уизарда");

if (resolveFails.length) {
  console.log("\nresolveMaterialQty fails (qty=1 everywhere):", resolveFails);
} else console.log("\nOK: resolveMaterialQty покрива всички PDF редове");

process.exit(missing.length || pdfNotEnterable.length || dup.length || resolveFails.length ? 1 : 0);
