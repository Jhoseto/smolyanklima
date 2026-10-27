import assert from "node:assert/strict";
import { test } from "node:test";
import wall from "./fixtures/stenni-klimatici.json";
import floor from "./fixtures/podovi-klimatici.json";
import column from "./fixtures/kolonni-klimatici.json";
import multi from "./fixtures/multi-split-sistemi.json";
import mounted from "./fixtures/mounted.json";
import indoorSamsung from "./fixtures/indoor-samsung.json";
import { collectTempexProductUrls, parseTempexListing, TEMPEX_CATEGORIES, type TempexCatalogEntry } from "./collectTempexProducts";
import { fetchTempexProduct, parseTempexProductPage, TempexNoPublishedPriceError } from "./parseTempexProduct";
import { tempexUrl } from "./tempexHttp";
import { isTempexImportedTemplate, restoredTempexAvailability, TEMPEX_UNAVAILABLE_NOTE } from "./tempexAvailability";
import { verifiedTempexBtuCorrection } from "./verifiedTempexCorrections";

const page = (product: unknown, icons = "") => `<html><div data-product="${JSON.stringify(product).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}"></div>${icons}</html>`;
const entry = (index: number, id: number): TempexCatalogEntry => ({ category: TEMPEX_CATEGORIES[index]!, sourceId: String(id), url: `https://tempex.bg/bg/product-${id}.html` });

test("real wall fixture: correct model, nominal output, BTU units, quietest indoor pressure and dimensions", () => {
  const parsed = parseTempexProductPage(page(wall.product, wall.icons), entry(0, wall.product.id));
  assert.equal(parsed.modelCode, "RSG12KMCE");
  assert.equal(parsed.brandName, "Fuji Electric");
  assert.equal(parsed.priceEur, 799);
  assert.equal(parsed.specs.cooling_power_kw, 3.4);
  assert.equal(parsed.specs.btu, 12);
  assert.equal(parsed.specs.noise_db, 20);
  assert.equal(parsed.specs.dim_indoor_length_mm, 834);
  assert.equal(parsed.specs.dim_indoor_height_mm, 270);
  assert.equal(parsed.specs.dim_indoor_width_mm, 222);
  assert.equal(parsed.specs.warranty_months, 60);
  assert.notEqual(parsed.specs.wifi, true); // This unit requires an optional adapter.
  assert.match(parsed.description, /Тръбни връзки/);
  assert.match(parsed.description, /controller=attachment&id_attachment=335/);
  assert.equal(parsed.imageUrls.length, wall.product.images.length);
});

test("real floor fixture: built-in Wi-Fi, ionizer and all manufacturer functions", () => {
  const parsed = parseTempexProductPage(page(floor.product, floor.icons), entry(1, floor.product.id));
  assert.equal(parsed.categorySlug, "floor");
  assert.equal(parsed.specs.wifi, true);
  assert.ok(parsed.featureSlugs.includes("wifi"));
  assert.ok(parsed.featureSlugs.includes("ionizer"));
  assert.equal(parsed.specs.weight_indoor_kg, 14.9);
  assert.equal(parsed.specs.warranty_months, 36);
  assert.match(parsed.description, /Нискотемпературен кит/);
});

test("browser-normalized HTML preserves functions after duplicate source id attributes are removed", () => {
  const normalized = floor.icons.replace(/\s+id="AllAvailableProductTicons_\d+"/g, "");
  const parsed = parseTempexProductPage(page(floor.product, `<section class="ticons_showIcons">${normalized}</section>`), entry(1, floor.product.id));
  assert.equal(parsed.specs.wifi, true);
  assert.ok(parsed.featureSlugs.includes("ionizer"));
  assert.match(parsed.description, /Нискотемпературен кит/);
});

test("the manufacturer's selected cover is the main image even when it is not first in the gallery", () => {
  const images = wall.product.images.map((image, index) => ({ ...image, cover: index === 1 ? "1" : "0" }));
  const parsed = parseTempexProductPage(page({ ...wall.product, images }), entry(0, wall.product.id));
  assert.equal(parsed.imageUrls[0], images[1]!.large.url);
  assert.equal(parsed.imageUrls.length, images.length);
});

test("dimensions preserve the overall width when the manufacturer also specifies a back-plate width", () => {
  const product = { ...wall.product, features: wall.product.features.map((feature) => /^Размери вътрешно/.test(feature.name) ? { ...feature, value: "950 (гръб 840) x 295 x 230" } : feature) };
  const parsed = parseTempexProductPage(page(product), entry(0, product.id));
  assert.equal(parsed.specs.dim_indoor_length_mm, 950);
  assert.equal(parsed.specs.dim_indoor_height_mm, 295);
  assert.equal(parsed.specs.dim_indoor_width_mm, 230);
});

test("power uses the nominal value in min / nominal / max notation", () => {
  const product = { ...wall.product, features: wall.product.features.map((feature) => /^Мощност на охлаждане/.test(feature.name) ? { ...feature, value: "1.3 / 2.5 / 3.2" } : /^Мощност на отопление/.test(feature.name) ? { ...feature, value: "1.3 / 2.8 / 4.7" } : feature) };
  const parsed = parseTempexProductPage(page(product), entry(0, product.id));
  assert.equal(parsed.specs.cooling_power_kw, 2.5);
  assert.equal(parsed.specs.heating_power_kw, 2.8);
});

test("generic sound-pressure and capacity labels fill only the fields their meaning supports", () => {
  const features = floor.product.features.filter((feature) => !/Мощност на охлаждане|Мощност на отопление|Капацитет.*BTU|Звуково налягане вътрешно тяло/i.test(feature.name));
  const product = { ...floor.product, features: [...features, { name: "Капацитет kW", value: "2.5" }, { name: "Звуково налягане вътрешно тяло dB(A)", value: "36 / 30 / 21" }] };
  const parsed = parseTempexProductPage(page(product), entry(1, product.id));
  assert.equal(parsed.specs.btu, 9);
  assert.equal(parsed.specs.noise_db, 21);
  assert.equal(parsed.specs.cooling_power_kw, null);
  assert.equal(parsed.specs.heating_power_kw, null);
});

test("real column and outdoor multisplit fixtures preserve classification and unit scope", () => {
  const col = parseTempexProductPage(page(column.product, column.icons), entry(2, column.product.id));
  assert.equal(col.modelCode, "AC140BNPDKH/EU");
  assert.equal(col.specs.cooling_power_kw, 13.4);
  assert.equal(col.specs.dim_indoor_height_mm, 1850);
  const outdoor = parseTempexProductPage(page(multi.product, multi.icons), entry(3, multi.product.id));
  assert.equal(outdoor.unitKind, "outdoor");
  assert.equal(outdoor.categorySlug, "multi");
  assert.equal(outdoor.modelCode, "ROG18LAC2");
  assert.equal(outdoor.specs.btu, 18);
  assert.equal(outdoor.sourceCorrections[0]?.sourceValue, 24);
  assert.equal(outdoor.specs.noise_db, 50);
  assert.match(outdoor.description, /Цената е само за външното тяло/);
});

test("fetch selects only the uninstalled combination when the default includes installation", async () => {
  const calls: string[] = [];
  const select = '<select name="group[6]"><option value="33">Без монтаж</option><option value="34">Със стандартен монтаж</option></select>';
  const parsed = await fetchTempexProduct(entry(0, wall.product.id), async (href) => {
    calls.push(href);
    const group = new URL(href).searchParams.get("group[6]");
    return page(group === "33" ? wall.product : mounted) + select;
  });
  assert.equal(parsed.priceEur, 799);
  assert.equal(calls.length, 2);
  assert.equal(new URL(calls[1]!).searchParams.get("group[6]"), "33");
  assert.ok(calls.every((href) => new URL(href).searchParams.get("group[6]") !== "34"));
});

test("indoor multisplit bodies are climate products with a unit-only price, not complete kits", () => {
  const product = { ...floor.product, name: "Вътрешно подово тяло за мулти сплит система Midea MFA2U-12HRFNX(GA)", category: "vatreshni-tela", category_name: "Вътрешни тела", attributes: undefined };
  const parsed = parseTempexProductPage(page(product, floor.icons), entry(3, product.id));
  assert.equal(parsed.categorySlug, "multi");
  assert.equal(parsed.unitKind, "indoor");
  assert.equal(parsed.modelCode, "MFA2U-12HRFNX(GA)");
  assert.match(parsed.description, /Цената е само за вътрешното тяло/);
});

test("real indoor Samsung quoted on request is excluded even though its public payload contains a numeric price", () => {
  assert.equal(indoorSamsung.product.price_amount, 290.41);
  assert.equal(indoorSamsung.product.show_price, "0");
  assert.throws(() => parseTempexProductPage(page(indoorSamsung.product, indoorSamsung.icons), entry(3, indoorSamsung.product.id)), TempexNoPublishedPriceError);
  assert.throws(() => parseTempexProductPage(page({ ...indoorSamsung.product, show_price: 0 }), entry(3, indoorSamsung.product.id)), TempexNoPublishedPriceError);
});

test("reject wrong product redirects, unpriced records, foreign hosts and installation-only variants", async () => {
  assert.throws(() => parseTempexProductPage(page(wall.product), entry(0, 999)), /различен продукт/);
  assert.throws(() => parseTempexProductPage(page({ ...wall.product, price_amount: 0 }), entry(0, wall.product.id)), /цена/);
  assert.throws(() => tempexUrl("https://tempex.bg.evil.example/bg/product.html"));
  assert.throws(() => tempexUrl("http://tempex.bg/bg/product.html"));
  await assert.rejects(fetchTempexProduct(entry(0, wall.product.id), async () => page({ ...wall.product, attributes: mounted.attributes })), TempexNoPublishedPriceError);
});

test("listing ignores navigation and recommendations; pagination cannot silently repeat page one", async () => {
  const listing = `<html><a href="https://tempex.bg/bg/not-a-product.html">Banner</a><article data-id-product="27"><h2 class="h3 product-title"><a href="https://tempex.bg/bg/product.html#/33-montazh-bez_montazh">Product</a></h2></article><nav class="pagination"><a href="https://tempex.bg/bg/stenni-klimatici?page=2">2</a></nav></html>`;
  const parsed = parseTempexListing(listing, TEMPEX_CATEGORIES[0]);
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0]?.url, "https://tempex.bg/bg/product.html");
  assert.deepEqual(parsed.pages, [1, 2]);
  await assert.rejects(collectTempexProductUrls(undefined, undefined, async () => listing), /повтаря страница/);
});

test("listing recognizes published EUR prices and never fetches a product explicitly listed without one", async () => {
  const listing = '<html><article data-id-product="27"><h2 class="h3 product-title"><a href="https://tempex.bg/bg/product.html">Priced</a></h2><div class="product-price-and-shipping"><span class="product-price" content="799">799,00&#160;€</span></div></article></html>';
  assert.equal(parseTempexListing(listing, TEMPEX_CATEGORIES[0]).entries[0]?.listingHasPrice, true);
  assert.equal(parseTempexListing(listing.replace('class="product-price" content="799"', 'content="799" class="discounted product-price"'), TEMPEX_CATEGORIES[0]).entries[0]?.listingHasPrice, true);
  assert.throws(() => parseTempexListing(listing.replace(' content="799"', ""), TEMPEX_CATEGORIES[0]), /Променен формат/);
  assert.throws(() => parseTempexListing(listing.replace("€", "BGN"), TEMPEX_CATEGORIES[0]), /Променен формат/);
  let fetched = false;
  await assert.rejects(fetchTempexProduct({ ...entry(0, 27), listingHasPrice: false }, async () => { fetched = true; return page(wall.product); }), TempexNoPublishedPriceError);
  assert.equal(fetched, false);
});

test("future sync restores only supplier-driven deactivation and preserves staff notes and visibility", () => {
  assert.deepEqual(restoredTempexAvailability({ is_active: false, internal_note: "Изключен ръчно" }), {});
  assert.deepEqual(restoredTempexAvailability({ is_active: false, internal_note: `Бележка от офиса\n${TEMPEX_UNAVAILABLE_NOTE}` }), { is_active: true, internal_note: "Бележка от офиса" });
  assert.ok(!("show_in_public_catalog" in restoredTempexAvailability({ is_active: false, internal_note: TEMPEX_UNAVAILABLE_NOTE })));
});

test("availability reconciliation never adopts manually entered supplier products or other catalog scopes", () => {
  assert.equal(isTempexImportedTemplate({ slug: "model-tempex-27", source_url: "https://tempex.bg/bg/product.html" }), true);
  assert.equal(isTempexImportedTemplate({ slug: "model-catalog-1-tempex-27", source_url: "https://tempex.bg/bg/product.html" }), true);
  assert.equal(isTempexImportedTemplate({ slug: "manual-cassette", source_url: "https://tempex.bg/bg/product.html" }), false);
  assert.equal(isTempexImportedTemplate({ slug: "manual-product", source_url: null }), false);
  assert.equal(isTempexImportedTemplate({ slug: "model-tempex-27", source_url: "https://another-supplier.example/product.html" }), false);
});

test("an unexpected catalog with no recognizable published prices cannot deactivate the existing catalog", async () => {
  let nextId = 0;
  await assert.rejects(collectTempexProductUrls(undefined, undefined, async () => {
    const id = ++nextId;
    return `<html><article data-id-product="${id}"><h2 class="h3 product-title"><a href="https://tempex.bg/bg/product-${id}.html">Model ${id}</a></h2></article></html>`;
  }), /нито една публикувана цена/);
});

test("verified source corrections are narrowly guarded and do not override later supplier fixes", () => {
  assert.equal(verifiedTempexBtuCorrection("ROG30LAT4", 48, 8)?.catalogValue, 30);
  assert.equal(verifiedTempexBtuCorrection("ROG30LAT4", 30, 8), null);
  assert.equal(verifiedTempexBtuCorrection("ROG30LAT4", 48, 9), null);
  assert.equal(verifiedTempexBtuCorrection("UNVERIFIED", 48, 8), null);
});
