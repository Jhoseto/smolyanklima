import path from "node:path";
import { fileURLToPath } from "node:url";
import { readdir, readFile, writeFile } from "node:fs/promises";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { collectTempexProductUrls } from "../lib/import/tempex/collectTempexProducts";
import { extractTempexSourceProduct, fetchTempexProduct, TempexNoPublishedPriceError, type TempexParsedProduct } from "../lib/import/tempex/parseTempexProduct";

type CachePage = { url: string; html: string; fetchedAt: string };
type ProductRow = Record<string, unknown> & { id: string; source_url: string; product_specs: Record<string, unknown> | null; product_images: Array<{ url: string; is_main: boolean; sort_order: number }>; product_features: Array<{ features: { slug: string } }> };

async function main() {
  dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env.local"), quiet: true });
  const option = (name: string) => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const directory = path.resolve(option("cache-dir") ?? ".cache/tempex");
  const pages = new Map<string, CachePage>();
  for (const filename of await readdir(directory)) {
    if (!/^[0-9a-f]{64}\.json$/.test(filename)) continue;
    const cached = JSON.parse(await readFile(path.join(directory, filename), "utf8")) as CachePage;
    pages.set(cached.url, cached);
  }
  const fetchCached = async (url: string) => {
    const cached = pages.get(url);
    if (!cached) throw new Error(`Липсва изходна страница в архива: ${url}`);
    return cached.html;
  };
  const allEntries = await collectTempexProductUrls(undefined, undefined, fetchCached);
  const partial = process.argv.includes("--partial");
  const entries = partial ? allEntries.filter((entry) => {
    const source = pages.get(entry.url);
    return entry.listingHasPrice === false || (source && Date.now() - new Date(source.fetchedAt).getTime() > 10_000);
  }) : allEntries;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Липсват данни за връзка с базата.");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const supplier = await db.from("contacts").select("id,full_name").eq("contact_kind", "supplier").or("full_name.ilike.%темпекс%,full_name.ilike.%tempex%").single();
  if (supplier.error || !supplier.data) throw new Error(supplier.error?.message ?? "Липсва доставчик");
  const [rows, categories, types, brands] = await Promise.all([
    db.from("products").select("id,source_url,name,model_code,price,price_with_mount,description,category_id,type_id,brand_id,stock_quantity,sold_quantity,stock_status,show_in_public_catalog,product_specs(*),product_images(url,is_main,sort_order),product_features(features(slug))").eq("supplier_id", supplier.data.id).range(0, 1999),
    db.from("categories").select("id,slug"), db.from("product_types").select("id,name"), db.from("brands").select("id,name"),
  ]);
  for (const result of [rows, categories, types, brands]) if (result.error) throw new Error(result.error.message);
  const categoryMap = new Map((categories.data ?? []).map((row) => [String(row.id), String(row.slug)]));
  const typeMap = new Map((types.data ?? []).map((row) => [String(row.id), String(row.name)]));
  const brandMap = new Map((brands.data ?? []).map((row) => [String(row.id), String(row.name)]));
  const entryUrls = new Set(entries.map((entry) => entry.url));
  const products = (rows.data as unknown as ProductRow[]).filter((product) => !partial || entryUrls.has(product.source_url));
  const issues: Array<{ url: string; field: string; expected?: unknown; actual?: unknown }> = [];
  const sourceIssues: Array<{ url: string; issue: string }> = [];
  const excluded: Array<{ url: string; name: string }> = [];
  const corrections: Array<{ url: string; field: string; sourceValue: number; catalogValue: number; reference: string; reason: string }> = [];
  const expectedUrls = new Set<string>();
  const counts: Record<string, number> = {};
  const unitCounts = { indoor: 0, outdoor: 0, kit: 0 };
  const completeness: Record<string, { supplied: number; populated: number }> = {};
  const records: Array<{ url: string; id: string; name: string; category: string; unitKind: string; price: number; sourcePriceVisible: boolean; images: number; sourceCapturedAt: string }> = [];
  const bySource = new Map<string, ProductRow[]>();
  for (const product of products) bySource.set(product.source_url, [...(bySource.get(product.source_url) ?? []), product]);

  for (const entry of entries) {
    let item: TempexParsedProduct;
    try { item = await fetchTempexProduct(entry, fetchCached); }
    catch (error) {
      if (error instanceof TempexNoPublishedPriceError) excluded.push({ url: entry.url, name: error.productName });
      else issues.push({ url: entry.url, field: "source", actual: error instanceof Error ? error.message : String(error) });
      continue;
    }
    expectedUrls.add(entry.url);
    corrections.push(...item.sourceCorrections.map((correction) => ({ url: entry.url, ...correction })));
    counts[item.categorySlug] = (counts[item.categorySlug] ?? 0) + 1;
    unitCounts[item.unitKind]++;
    const matches = bySource.get(entry.url) ?? [];
    if (matches.length !== 1) { issues.push({ url: entry.url, field: "productCount", expected: 1, actual: matches.length }); continue; }
    const product = matches[0]!;
    const equal = (field: string, expected: unknown, actual: unknown) => {
      if (JSON.stringify(expected ?? null) !== JSON.stringify(actual ?? null)) issues.push({ url: entry.url, field, expected, actual });
    };
    equal("name", item.name, product.name);
    equal("model_code", item.modelCode, product.model_code);
    equal("price", item.priceEur, product.price);
    equal("price_with_mount", null, product.price_with_mount);
    equal("category", item.categorySlug, categoryMap.get(String(product.category_id)));
    equal("brand", item.brandName, brandMap.get(String(product.brand_id)));
    if (!typeMap.get(String(product.type_id))?.toLowerCase().includes(item.typeHint.toLowerCase())) issues.push({ url: entry.url, field: "type", actual: typeMap.get(String(product.type_id)), expected: item.typeHint });
    equal("description", item.description, product.description);
    equal("stock_quantity", 0, product.stock_quantity);
    equal("sold_quantity", 0, product.sold_quantity);
    equal("stock_status", "on_order", product.stock_status);
    equal("show_in_public_catalog", false, product.show_in_public_catalog);
    for (const [field, expected] of Object.entries(item.specs)) {
      equal(`specs.${field}`, expected, product.product_specs?.[field]);
      const stat = completeness[field] ??= { supplied: 0, populated: 0 };
      if (expected != null) { stat.supplied++; if (product.product_specs?.[field] != null) stat.populated++; }
    }
    equal("images", item.imageUrls, [...product.product_images].sort((a, b) => a.sort_order - b.sort_order).map((image) => image.url));
    equal("mainImageCount", 1, product.product_images.filter((image) => image.is_main).length);
    equal("features", [...item.featureSlugs].sort(), product.product_features.map((feature) => feature.features.slug).sort());
    // Independent unit and source-price checks catch errors in the normalized mapping itself.
    const raw = extractTempexSourceProduct(await fetchCached(entry.url));
    const coverUrl = raw.cover?.large?.url ?? raw.images?.find((image) => image.cover === "1" || image.cover === true || image.cover === 1)?.large?.url;
    if (coverUrl) equal("sourceCover", coverUrl, product.product_images.find((image) => image.is_main)?.url);
    const feature = (label: RegExp) => raw.features?.find((f) => label.test(f.name))?.value;
    if (item.categorySlug === "multi") {
      if (/вътрешн/i.test(raw.name) && item.unitKind !== "indoor") issues.push({ url: entry.url, field: "unitKind", expected: "indoor", actual: item.unitKind });
      if (/външн/i.test(raw.name) && item.unitKind !== "outdoor") issues.push({ url: entry.url, field: "unitKind", expected: "outdoor", actual: item.unitKind });
      const model = feature(item.unitKind === "outdoor" ? /^Външно тяло$/i : /^Вътрешно тяло$/i);
      if (model && model !== "-") equal("unitModelFromManufacturer", model.trim(), product.model_code);
    }
    const cooling = item.specs.cooling_power_kw;
    const btu = item.specs.btu;
    if (cooling && btu && Math.abs(cooling * 3.41214 - btu) > 4) sourceIssues.push({ url: entry.url, issue: `BTU ${btu} и охлаждане ${cooling} kW в източника се разминават.` });
    for (const side of ["indoor", "outdoor"] as const) {
      const rawDimension = feature(side === "indoor" ? /^Размери вътрешно тяло/i : /^Размери външно тяло/i);
      if (rawDimension && rawDimension !== "-" && !item.specs[`dim_${side}_length_mm`]) sourceIssues.push({ url: entry.url, issue: `Неразчетени размери ${side}: ${rawDimension}` });
    }
    records.push({ url: entry.url, id: product.id, name: item.name, category: item.categorySlug, unitKind: item.unitKind, price: item.priceEur, sourcePriceVisible: item.sourcePriceVisible, images: item.imageUrls.length, sourceCapturedAt: pages.get(entry.url)!.fetchedAt });
  }
  for (const product of products) if (!expectedUrls.has(product.source_url)) issues.push({ url: product.source_url, field: "unexpectedSupplierProduct", actual: product.id });
  const summary = { checkedAt: new Date().toISOString(), partial, sourceProducts: allEntries.length, inspectedSources: entries.length, eligibleProducts: expectedUrls.size, excludedWithoutPublishedPrice: excluded.length, databaseProducts: products.length, compared: records.length, categories: counts, unitKinds: unitCounts, images: records.reduce((total, record) => total + record.images, 0), differences: issues.length, sourceWarnings: sourceIssues.length, completeness };
  const report = { summary: { ...summary, verifiedSourceCorrections: corrections.length }, issues, sourceIssues, corrections, excluded, records };
  await writeFile(path.resolve(option("output") ?? path.join(directory, "audit.json")), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ summary, issues, sourceIssues }, null, 2));
  if (issues.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
