import type { SpecsInput } from "@/lib/admin/syncProductChildren";
import { inferBtuFromCoolingKw } from "@/lib/catalog/productBtu";
import { resolveBrandName } from "../brandFromTitle";
import type { TempexCatalogEntry } from "./collectTempexProducts";
import { fetchTempexHtml, tempexUrl } from "./tempexHttp";
import { verifiedTempexBtuCorrection, type TempexSourceCorrection } from "./verifiedTempexCorrections";

type SourceFeature = { name: string; value: string };
type SourceImage = { large?: { url?: string }; bySize?: { large_default?: { url?: string } }; cover?: string | number | boolean };
export type TempexSourceProduct = {
  id: number; name: string; price_amount: number; price: string; show_price: string | boolean;
  description?: string; description_short?: string; category?: string; category_name?: string;
  features?: SourceFeature[]; images?: SourceImage[]; cover?: SourceImage;
  attributes?: Record<string, { id_attribute: string; name: string; group: string }>;
  attachments?: Array<{ name?: string; description?: string; file?: string; id_attachment?: string; url?: string }>;
};

export type TempexParsedProduct = {
  sourceUrl: string; sourceId: number; name: string; modelCode: string; brandName: string;
  categorySlug: TempexCatalogEntry["category"]["slug"]; typeHint: string;
  unitKind: "indoor" | "outdoor" | "kit";
  priceEur: number; sourcePriceVisible: boolean; description: string;
  imageUrls: string[]; specs: SpecsInput; featureSlugs: string[];
  sourceCorrections: TempexSourceCorrection[];
};

export class TempexNoPublishedPriceError extends Error {
  constructor(public readonly productName: string, message?: string) { super(message ?? `Без публикувана цена без монтаж: ${productName}`); }
}

export function decodeTempexHtml(value: string): string {
  return value.replace(/&(?:quot|apos|lt|gt|amp|nbsp|deg|times|ndash|mdash|#\d+|#x[0-9a-f]+);/gi, (entity) => {
    const named: Record<string, string> = { "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">", "&amp;": "&", "&nbsp;": " ", "&deg;": "°", "&times;": "×", "&ndash;": "–", "&mdash;": "—" };
    if (named[entity.toLowerCase()]) return named[entity.toLowerCase()]!;
    const code = entity[2]?.toLowerCase() === "x" ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1));
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  });
}

function text(html: string): string {
  return decodeTempexHtml(html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function extractTempexSourceProduct(html: string): TempexSourceProduct {
  const raw = html.match(/\bdata-product="([^"]+)"/)?.[1];
  if (!raw) throw new Error("Липсват структурираните продуктови данни на Tempex.");
  const product = JSON.parse(decodeTempexHtml(raw)) as TempexSourceProduct;
  if (!product.id || !product.name || !Array.isArray(product.features)) throw new Error("Невалидни продуктови данни на Tempex.");
  return product;
}

function firstNumber(value?: string): number | null {
  if (!value) return null;
  const match = value.replace(/(\d)[\s\u00a0](?=\d{3}(?:\D|$))/g, "$1").match(/\d+(?:[.,]\d+)?/);
  const number = match ? Number(match[0].replace(",", ".")) : NaN;
  return Number.isFinite(number) && number > 0 ? number : null;
}

function nominalPower(value?: string): number | null {
  if (!value) return null;
  const parts = value.replace(/kW/gi, "").split("/").map((part) => part.trim());
  // Daikin uses min / nominal / max, while most Tempex brands use nominal (min ~ max).
  if (parts.length === 3 && parts.every((part) => /^\d+(?:[.,]\d+)?$/.test(part))) return firstNumber(parts[1]);
  return firstNumber(value);
}

function descriptionMarkdown(html: string): string {
  return decodeTempexHtml(html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<h[1-6]\b[^>]*>/gi, "\n\n### ").replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<li\b[^>]*>/gi, "\n- ").replace(/<\/(?:p|div|ul|ol|table|tr)>|<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function productIconFeatures(html: string): SourceFeature[] {
  const features: SourceFeature[] = [];
  const section = html.match(/<section\b[^>]*class=["'][^"']*ticons_showIcons[^"']*["'][^>]*>([\s\S]*?)<\/section>/i)?.[1] ?? html;
  for (const li of section.matchAll(/<li\b[\s\S]*?<\/li>/gi)) {
    // The raw page has duplicate id attributes; browser-serialized HTML retains only icon_N.
    if (!/\bid=["'](?:AllAvailableProductTicons_|icon_)\d+["']/.test(li[0])) continue;
    const title = li[0].match(/\btitle="([^"]*)"/)?.[1];
    if (!title) continue;
    const label = title.match(/<strong>([\s\S]*?)<\/strong>/i)?.[1];
    if (label) features.push({ name: text(label), value: text(title.replace(/<strong>[\s\S]*?<\/strong>/i, "")) });
  }
  return features;
}

export function parseTempexProductPage(html: string, entry: TempexCatalogEntry): TempexParsedProduct {
  const product = extractTempexSourceProduct(html);
  if (String(product.id) !== entry.sourceId) throw new Error("Tempex върна различен продукт (възможно пренасочване).");
  const sourcePriceVisible = String(product.show_price) !== "0" && product.show_price !== false;
  if (!sourcePriceVisible || !Number.isFinite(product.price_amount) || product.price_amount <= 0 || !/€|EUR/i.test(product.price)) {
    throw new TempexNoPublishedPriceError(product.name);
  }
  const features = product.features!;
  const icons = productIconFeatures(html);
  const get = (pattern: RegExp) => {
    const value = features.find((feature) => pattern.test(feature.name.trim()))?.value.trim();
    return value && !/^(?:-|–|—|n\/a|няма)$/i.test(value) ? value : undefined;
  };
  const name = text(product.name);
  const brandName = resolveBrandName(name, get(/^Производител$/i));
  // The shared resolver does not cover these Tempex brands and must not infer from the URL/series.
  const brand = /fuji\s+electric/i.test(name) ? "Fuji Electric" : /\btreo\b/i.test(name) ? "Treo" : brandName;
  if (!brand) throw new Error(`Не е разпозната марката: ${name}`);
  const indoor = get(/^Вътрешно тяло$/i);
  const outdoor = get(/^Външно тяло$/i);
  const unitScope = `${name} ${product.category} ${product.category_name}`;
  let unitKind: TempexParsedProduct["unitKind"] = "kit";
  if (entry.category.slug === "multi") {
    if (/vatreshni|вътрешн/i.test(unitScope)) unitKind = "indoor";
    else if (/vanshni|външн/i.test(unitScope)) unitKind = "outdoor";
    else if (indoor && outdoor) unitKind = "kit";
    else if (indoor) unitKind = "indoor";
    else if (outdoor) unitKind = "outdoor";
    else throw new Error(`Не е определен видът на мултисплит тялото: ${name}`);
  }
  // reference is a series/year (KMCE, 2022), NOT the model number.
  const titleModel = name.match(/\b[A-Z][A-Z0-9]*[-/][A-Z0-9()\-/]+(?:\s*\([^)]*\))?/g)?.at(-1)
    ?? name.match(/\b[A-Z]{2,}[0-9][A-Z0-9()\-/]*/g)?.at(-1);
  const modelCode = (unitKind === "indoor" ? indoor : unitKind === "outdoor" ? outdoor : indoor) || titleModel;
  if (!modelCode) throw new Error(`Липсва модел: ${name}`);

  const specs: SpecsInput = {};
  specs.cooling_power_kw = nominalPower(get(/^Мощност на охлаждане/i));
  specs.heating_power_kw = nominalPower(get(/^Мощност на отопление/i));
  const btu = firstNumber(get(/Капацитет.*BTU/i));
  const genericCapacityKw = firstNumber(get(/^Капацитет\s*\(?kW\)?$/i));
  // A generic unit-capacity rating can identify its nominal BTU class; it does not establish separate heating/cooling ratings.
  specs.btu = btu ? (btu >= 1000 ? btu / 1000 : btu) : inferBtuFromCoolingKw(specs.cooling_power_kw ?? genericCapacityKw);
  const btuCorrection = verifiedTempexBtuCorrection(modelCode, specs.btu, specs.cooling_power_kw);
  const sourceCorrections = btuCorrection ? [btuCorrection] : [];
  if (btuCorrection) specs.btu = btuCorrection.catalogValue;
  specs.seer = firstNumber(get(/^SEER\b/i));
  specs.scop = firstNumber(get(/^SCOP\b/i));
  specs.energy_class_cool = get(/^Енергиен клас.*охлаждане/i)?.match(/[A-G]\+{0,3}/i)?.[0].toUpperCase() ?? null;
  specs.energy_class_heat = get(/^Енергиен клас.*отопление/i)?.match(/[A-G]\+{0,3}/i)?.[0].toUpperCase() ?? null;
  specs.refrigerant = get(/^Фреон \(тип\)/i)?.match(/R\s*\d+[A-Z]*/i)?.[0].replace(/\s/g, "").toUpperCase() ?? null;
  const noise = get(/^Звуково налягане вътрешно тяло.*охлаждане/i)
    ?? get(/^Звуково налягане вътрешно тяло\s*(?:[-–]?\s*)?(?:dB|\(dB)/i)
    ?? (unitKind === "outdoor" ? get(/^Звуково налягане външно тяло/i) : undefined);
  const noiseLevels = (noise?.match(/\d+(?:[.,]\d+)?/g) ?? []).map((n) => Number(n.replace(",", "."))).filter((n) => n > 0);
  specs.noise_db = noiseLevels.length ? Math.min(...noiseLevels) : null;
  specs.coverage_m2 = firstNumber(get(/(?:Препоръчителна площ|Площ.*m2|Площ.*м²)/i));
  const warranty = get(/^Гаранция$/i);
  const warrantyValue = firstNumber(warranty);
  specs.warranty_months = warrantyValue ? (/годин/i.test(warranty ?? "") ? warrantyValue * 12 : /месец/i.test(warranty ?? "") ? warrantyValue : null) : null;
  specs.weight_indoor_kg = firstNumber(get(/^Тегло вътрешно тяло/i));
  specs.weight_outdoor_kg = firstNumber(get(/^Тегло външно тяло/i));
  for (const side of ["indoor", "outdoor"] as const) {
    const dimensions = get(side === "indoor" ? /^Размери вътрешно тяло/i : /^Размери външно тяло/i);
    // Notes such as "950 (гръб 840) x 295 x 230" describe the back plate separately.
    const values = dimensions?.replace(/\([^)]*\)/g, "").match(/\d+(?:[.,]\d+)?/g)?.map((v) => Number(v.replace(",", ".")));
    // Tempex labels explicitly specify Ш × В × Д. Catalog uses length=Ш, width=Д, height=В.
    if (values?.length === 3 && values.every((v) => v > 0)) {
      specs[`dim_${side}_length_mm`] = values[0];
      specs[`dim_${side}_height_mm`] = values[1];
      specs[`dim_${side}_width_mm`] = values[2];
    }
  }
  const wifi = get(/wi[ -]?fi|безжично управление/i);
  const wifiIcon = icons.find((feature) => /wi[ -]?fi|wireless lan/i.test(feature.name));
  specs.wifi = wifi ? (/опци|допълнител|^(?:не|няма)(?:\s|$)/i.test(wifi) ? false : /да|вграден|включен/i.test(wifi) ? true : null)
    : wifiIcon ? !/опци|опцион|допълнител/i.test(`${wifiIcon.name} ${wifiIcon.value}`) : null;
  const featureSlugs: string[] = [];
  if (/инвертор/i.test(get(/^Технология$/i) ?? name)) featureSlugs.push("inverter");
  if (specs.wifi === true) featureSlugs.push("wifi");
  // Only explicit feature rows and the current product's icons; exclude recommended accessory cards.
  for (const [slug, pattern] of [["night_mode", /нощен|режим.*сън|sleep/i], ["self_cleaning", /самопочистване|активно почистване/i], ["ionizer", /йонизатор/i], ["turbo", /турбо|мощен режим|powerful/i]] as const) {
    if ([...features, ...icons].some((f) => pattern.test(f.name) && !/^(?:не|няма|опция)$/i.test(f.value) && !/опцион/i.test(f.name))) featureSlugs.push(slug);
  }
  const gallery = product.images ?? [];
  const cover = product.cover ?? gallery.find((image) => image.cover === "1" || image.cover === 1 || image.cover === true);
  const imageUrls = [...new Set([...(cover ? [cover] : []), ...gallery].map((image) => image.large?.url ?? image.bySize?.large_default?.url).filter((url): url is string => Boolean(url)).map((url) => tempexUrl(url).href))];
  if (!imageUrls.length) throw new Error(`Липсват продуктови снимки: ${name}`);
  const technicalTable = features.map((feature) => {
    const corrected = btuCorrection && /Капацитет.*BTU/i.test(feature.name);
    return `| ${corrected ? "Номинален BTU клас" : text(feature.name).replace(/\|/g, "\\|")} | ${corrected ? `${btuCorrection.catalogValue} 000 BTU` : text(feature.value).replace(/\|/g, "\\|")} |`;
  }).join("\n");
  const documents = (product.attachments ?? []).filter((attachment) => /^\d+$/.test(attachment.id_attachment ?? "")).map((attachment) =>
    `- [${text(attachment.name ?? "Документ").replace(/[\[\]]/g, "")}](https://tempex.bg/bg/index.php?controller=attachment&id_attachment=${attachment.id_attachment})`);
  if (btuCorrection) documents.push(`- [Техническа документация на производителя](${btuCorrection.reference})`);
  const description = [
    descriptionMarkdown(product.description_short ?? ""), descriptionMarkdown(product.description ?? ""),
    unitKind === "indoor" ? "Вътрешно тяло за мултисплит система. Цената е само за вътрешното тяло." : unitKind === "outdoor" ? "Външно тяло за мултисплит система. Цената е само за външното тяло." : "",
    `### Технически характеристики\n\n| Характеристика | Стойност |\n| --- | --- |\n${technicalTable}`,
    icons.length ? `### Функции\n\n${icons.map((feature) => `- **${feature.name}**: ${feature.value}`).join("\n")}` : "",
    documents.length ? `### Документи\n\n${documents.join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  const mountAttribute = Object.values(product.attributes ?? {}).find((attribute) => /монтаж/i.test(attribute.group));
  if (mountAttribute && !/^Без монтаж$/i.test(mountAttribute.name)) throw new TempexNoPublishedPriceError(name, `Публикуван е само вариант с монтаж: ${name}`);
  return { sourceUrl: entry.url, sourceId: product.id, name, modelCode, brandName: brand, categorySlug: entry.category.slug,
    typeHint: entry.category.type, unitKind, priceEur: product.price_amount, sourcePriceVisible, description, imageUrls, specs, featureSlugs, sourceCorrections };
}

/** Query parameters select real PrestaShop combinations; URL fragments alone do not select them on the server. */
export async function fetchTempexProduct(entry: TempexCatalogEntry, fetchHtml = fetchTempexHtml): Promise<TempexParsedProduct> {
  if (entry.listingHasPrice === false) throw new TempexNoPublishedPriceError(entry.name ?? entry.url);
  let html = await fetchHtml(entry.url);
  const selects = [...html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)];
  let mountGroup: string | undefined;
  let withoutMount: string | undefined;
  for (const select of selects) {
    const group = select[1]!.match(/name=["']group\[(\d+)\]["']/)?.[1];
    if (!group) continue;
    for (const option of select[2]!.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)) {
      const value = option[1]!.match(/\bvalue=["'](\d+)["']/)?.[1];
      const label = text(option[2]!);
      if (/^Без монтаж$/i.test(label)) { mountGroup = group; withoutMount = value; }
    }
  }
  if (mountGroup && withoutMount) {
    const source = extractTempexSourceProduct(html);
    const selected = source.attributes?.[mountGroup];
    if (selected?.id_attribute !== withoutMount) {
      const url = tempexUrl(entry.url);
      url.searchParams.set(`group[${mountGroup}]`, withoutMount);
      html = await fetchHtml(url.href);
    }
  }
  return parseTempexProductPage(html, entry);
}
