/** Probe: технически таблици на climacom.com продуктови страници */
const UA = "Mozilla/5.0";

const SAMPLES = [
  "https://climacom.com/product/klimatik-mitsubishi-electric-msz-ay25vgk-muz-ay25vg-9000btu/",
  "https://climacom.com/product/vynshno-tqlo-za-multisplit-sistema-pumy-sm112vkm-12-5-kw-42000-btu/",
];

async function fetchHtml(url: string) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.text();
}

function extractTables(html: string) {
  const tables: string[][] = [];
  const tableRe = /<table[\s\S]*?<\/table>/gi;
  for (const block of html.match(tableRe) ?? []) {
    const rows: string[][] = [];
    const rowRe = /<tr[\s\S]*?<\/tr>/gi;
    for (const row of block.match(rowRe) ?? []) {
      const cells = [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map((m) =>
        m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
      );
      if (cells.some((c) => c.length)) rows.push(cells);
    }
    if (rows.length) tables.push(...[rows]);
  }
  return tables;
}

function findSpecSections(html: string) {
  const keys = [
    "SEER",
    "SCOP",
    "Шум",
    "шум",
    "Охлаждане",
    "Отопление",
    "Хладилен",
    "R32",
    "Гаранция",
    "Размери",
    "Тегло",
    "Площ",
    "m²",
    "кВт",
    "BTU",
    "Енергиен",
  ];
  const hits: string[] = [];
  for (const k of keys) {
    if (html.includes(k)) hits.push(k);
  }
  return hits;
}

async function main() {
  for (const url of SAMPLES) {
    console.log("\n" + "=".repeat(80));
    console.log(url);
    const html = await fetchHtml(url);
    console.log("length:", html.length);
    console.log("keyword hits:", findSpecSections(html).join(", "));

    const tables = extractTables(html);
    console.log("tables found:", tables.length);
    for (let i = 0; i < Math.min(tables.length, 6); i++) {
      const t = tables[i];
      console.log(`\n--- table ${i + 1} (${t.length} rows) ---`);
      for (const row of t) console.log(row.join(" | "));
    }

    // ACF / custom blocks
    const acf = html.includes("technical") || html.includes("specification") || html.includes("harakteristiki");
    console.log("custom blocks:", { acf, woocommerce: html.includes("woocommerce") });
  }
}

main().catch(console.error);
