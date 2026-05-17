/** Временен probe — структура на climacom.com каталог */
const UA = "Mozilla/5.0 (compatible; SmolyanKlimaProbe/1.0)";

async function fetchHtml(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.text();
}

function uniq<T>(a: T[]) {
  return [...new Set(a)];
}

async function main() {
  const homeCat = "https://climacom.com/produkt-kategoriya/klimatici-za-doma-i-ofisa/stenni-klimatici/";
  const html = await fetchHtml(homeCat);
  const subcats = uniq([...html.matchAll(/href="(https:\/\/climacom\.com\/produkt-kategoriya\/[^"]+)"/g)].map((m) => m[1]));
  const prods = uniq([...html.matchAll(/href="(https:\/\/climacom\.com\/produkt\/[^"]+)"/g)].map((m) => m[1]));
  const anyLinks = uniq([...html.matchAll(/href="(https:\/\/climacom\.com\/[^"]+)"/g)].map((m) => m[1]));
  const leafCats = subcats.filter((u) => u.includes("stenni") || u.split("/").length > 5);
  console.log("=== Стенни климатици ===");
  console.log("subcategory links:", subcats.length);
  console.log("product links:", prods.length);
  console.log("sample subcats:", subcats.slice(0, 8));
  console.log("link patterns:", uniq(anyLinks.map((u) => u.replace("https://climacom.com/", "").split("/")[0])).join(", "));

  // probe one deeper subcat
  const deep = subcats.find((u) => u.includes("msz") || u.includes("inverter") || u.endsWith("stenni-klimatici/"));
  if (deep) {
    const dhtml = await fetchHtml(deep);
    const dprods = uniq([...dhtml.matchAll(/href="(https:\/\/climacom\.com\/produkt\/[^"]+)"/g)].map((m) => m[1]));
    const dseries = uniq([...dhtml.matchAll(/href="(https:\/\/climacom\.com\/[^"]+)"/g)].map((m) => m[1])).filter((u) =>
      u.includes("produkt"),
    );
    console.log("\n=== Deep:", deep, "===");
    console.log("products:", dprods.length, dprods.slice(0, 5));
    console.log("produkt* links sample:", dseries.slice(0, 15));
  }

  if (prods[0]) {
    const phtml = await fetchHtml(prods[0]);
    console.log("\n=== Sample product:", prods[0], "===");
    const title = phtml.match(/<h1[^>]*>([^<]+)</i)?.[1]?.trim();
    const price =
      phtml.match(/(\d[\d\s.,]*)\s*(?:лв|€|EUR)/i)?.[0] ??
      (phtml.includes("woocommerce-Price") ? "woocommerce price block present" : "no obvious price");
    const hasSpecs = /техническ|спецификац|характеристик|cooling|отоплителн/i.test(phtml);
    const hasBtu = /\bBTU\b|\bkW\b|кВт/i.test(phtml);
    const hasImages = (phtml.match(/wp-content\/uploads/g) ?? []).length;
    const model = phtml.match(/MSZ-[A-Z0-9-]+|MUZ-[A-Z0-9-]+/i)?.[0];
    console.log({ title, price, hasSpecs, hasBtu, imageCount: hasImages, model });
    console.log("html length:", phtml.length);
  }

  const top = await fetchHtml("https://climacom.com/produkti/");
  const topCats = uniq(
    [...top.matchAll(/href="(https:\/\/climacom\.com\/produkt-kategoriya\/[a-z0-9-]+)\/?"/g)].map((m) => m[1]),
  );
  console.log("\n=== Top-level categories (", topCats.length, ") ===");
  for (const c of topCats) console.log(c.replace("https://climacom.com/produkt-kategoriya/", ""));

  const api = await fetch("https://climacom.com/wp-json/wp/v2/products?per_page=5", { headers: { "User-Agent": UA } });
  console.log("\n=== WP products API ===", api.status);
  if (api.ok) {
    const items = (await api.json()) as Array<{ id: number; link: string; title: { rendered: string }; slug: string }>;
    for (const p of items.slice(0, 3)) console.log(p.id, p.slug, p.title.rendered, p.link);
  }

  const wc = await fetch("https://climacom.com/wp-json/wc/store/v1/products?per_page=5", { headers: { "User-Agent": UA } });
  console.log("WC store API:", wc.status);

  const page2 = await fetchHtml("https://climacom.com/produkt-kategoriya/klimatici-za-doma-i-ofisa/stenni-klimatici/page/2/");
  const p2links = uniq([...page2.matchAll(/href="(https:\/\/climacom\.com\/[^"]+)"/g)].map((m) => m[1])).filter((u) =>
    /\/produkt\/|\/products\//.test(u),
  );
  console.log("\npage2 product urls:", p2links.slice(0, 10));
  console.log("has woocommerce:", page2.includes("woocommerce"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
