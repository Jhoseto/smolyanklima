const UA = "Mozilla/5.0";

async function j<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return r.json() as Promise<T>;
}

type WcProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku?: string;
  prices?: { price?: string; currency_code?: string };
  categories?: Array<{ id: number; name: string; slug: string }>;
  short_description?: string;
  description?: string;
  images?: Array<{ src: string }>;
  attributes?: Array<{ name: string; terms: Array<{ name: string }> }>;
};

type WcCategory = { id: number; name: string; slug: string; count: number; parent: number };

async function main() {
  const stenni = await j<WcProduct[]>(
    "https://climacom.com/wp-json/wc/store/v1/products?category=stenni-klimatici&per_page=3",
  );
  console.log("=== Стенни (API sample) ===");
  for (const p of stenni) {
    console.log({
      name: p.name.slice(0, 80),
      priceEur: p.prices?.price ? Number(p.prices.price) / 100 : null,
      sku: p.sku || "(празно)",
      cats: p.categories?.map((c) => c.slug).join(", "),
    });
  }

  const list = await j<WcProduct[]>("https://climacom.com/wp-json/wc/store/v1/products?per_page=2");
  console.log("products in catalog:", list.length);
  const p = list[0];
  if (p) {
    console.log("sample product:", {
      name: p.name,
      slug: p.slug,
      sku: p.sku,
      prices: p.prices,
      categories: p.categories?.map((c) => c.slug),
      images: p.images?.length,
      attrs: p.attributes?.map((a) => a.name),
    });
    const html = await fetch(p.permalink, { headers: { "User-Agent": UA } }).then((r) => r.text());
    const hasTable = /техническ|характеристик|specification/i.test(html);
    const hasPricePublic = /лв|€|price/i.test(html);
    console.log("product page:", { hasTable, hasPricePublic, len: html.length });
  }

  let allCats: WcCategory[] = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await j<WcCategory[]>(
      `https://climacom.com/wp-json/wc/store/v1/products/categories?per_page=100&page=${page}`,
    );
    allCats.push(...batch);
    if (batch.length < 100) break;
  }
  const cats = allCats;
  const totalProducts = cats.reduce((s, c) => (c.parent === 0 ? s + c.count : s), 0);
  console.log("total WC categories:", cats.length, "| top-level product count sum:", totalProducts);
  const top = cats.filter((c) => c.parent === 0);
  console.log("\nTop-level WC categories:");
  for (const c of top.sort((a, b) => b.count - a.count)) {
    console.log(`  ${c.count.toString().padStart(4)} | ${c.slug} | ${c.name}`);
  }

  const homeRoot = cats.find((c) => c.slug === "klimatici-za-doma-i-ofisa");
  if (homeRoot) {
    const children = cats.filter((c) => c.parent === homeRoot.id);
    console.log("\nПодкатегории „Дом и офис“:");
    for (const c of children.sort((a, b) => b.count - a.count)) {
      console.log(`  ${c.count.toString().padStart(4)} | ${c.slug} | ${c.name}`);
    }
  }
}

main().catch(console.error);
