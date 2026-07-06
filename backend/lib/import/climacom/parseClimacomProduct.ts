import { inferBtuFromCoolingKw } from "@/lib/catalog/productBtu";
import {
  extractClimacomEnergyClasses,
  parseEnergyClassFromText,
} from "../parseEnergyClass";
import { extractModelCode, resolveBrandName } from "../brandFromTitle";

export const CLIMACOM_WC_API = "https://climacom.com/wp-json/wc/store/v1";

export type ClimacomWcProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku?: string;
  short_description?: string;
  description?: string;
  prices?: {
    price?: string;
    regular_price?: string;
    currency_minor_unit?: number;
  };
  images?: Array<{ src?: string; thumbnail?: string }>;
  categories?: Array<{ id: number; name: string; slug: string }>;
  attributes?: Array<{ name: string; terms: Array<{ name: string }> }>;
};

export type ClimacomParsedProduct = {
  sourceUrl: string;
  wcId: number;
  name: string;
  modelCode: string | null;
  brandName: string | null;
  priceEur: number;
  priceWithMountEur: number;
  description: string | null;
  imageUrls: string[];
  categorySlugs: string[];
  typeHint: string | null;
  featureLabels: string[];
  specs: {
    btu?: number | null;
    coverage_m2?: number | null;
    noise_db?: number | null;
    cooling_power_kw?: number | null;
    heating_power_kw?: number | null;
    refrigerant?: string | null;
    wifi?: boolean | null;
    energy_class_cool?: string | null;
    energy_class_heat?: string | null;
    seer?: number | null;
    scop?: number | null;
    warranty_months?: number | null;
    weight_indoor_kg?: number | null;
    weight_outdoor_kg?: number | null;
    dim_indoor_length_mm?: number | null;
    dim_indoor_width_mm?: number | null;
    dim_indoor_height_mm?: number | null;
    dim_outdoor_length_mm?: number | null;
    dim_outdoor_width_mm?: number | null;
    dim_outdoor_height_mm?: number | null;
  };
};

const FETCH_HEADERS = {
  "User-Agent": "SmolyanKlimaCatalogSync/1.0 (+https://smolyanklima.com)",
  Accept: "text/html,application/xhtml+xml",
  "Accept-Language": "bg,en;q=0.9",
};

const MAX_DESCRIPTION_CHARS = 12_000;

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/(?:^|\n)\s*•\s*(?=\n|$)/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Пълно описание: WooCommerce `description` (не short!), после short, после HTML блок на страницата.
 * Tab „Описание“ на Climacom често съдържа само техническа таблица — не го ползваме за текст.
 */
export function extractClimacomDescription(
  wc: Pick<ClimacomWcProduct, "short_description" | "description">,
  html: string,
): string | null {
  const full = stripHtmlToText(wc.description ?? "");
  const short = stripHtmlToText(wc.short_description ?? "");

  let text = "";
  if (full.length >= short.length) {
    text = full;
  } else if (short) {
    text = short;
    if (full && !short.includes(full)) text = `${short}\n\n${full}`;
  } else {
    text = full;
  }

  if (text.length < 80) {
    const htmlShort = html.match(
      /woocommerce-product-details__short-description[^>]*>([\s\S]*?)<\/div>/i,
    )?.[1];
    const fromPage = htmlShort ? stripHtmlToText(htmlShort) : "";
    if (fromPage.length > text.length) text = fromPage;
  }

  if (!text.trim()) return null;
  return text.slice(0, MAX_DESCRIPTION_CHARS);
}

function parseNum(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const n = Number(String(raw).replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Номинална стойност от диапазон „min - nominal - max“ или единична. */
function parseNominalFromRange(value: string): number | null {
  const cleaned = value.replace(/,/g, "").trim();
  const parts = cleaned
    .split(/\s*[-–]\s*/)
    .map((p) => parseNum(p))
    .filter((n): n is number => n != null);
  if (parts.length >= 3) return parts[1]!;
  if (parts.length === 1) return parts[0]!;
  if (parts.length === 2) return parts[1] ?? parts[0]!;
  return parseNum(cleaned);
}

/** Разделител между размери: ×, x, или кирилско „х“. */
const DIM_SEP = "[×xх]";

function parseDimensionsTriplet(value: string): { h: number; w: number; d: number } | null {
  const x = value.replace(/,/g, "").trim();
  const mul = new RegExp(`(\\d+)\\s*${DIM_SEP}\\s*(\\d+)\\s*${DIM_SEP}\\s*(\\d+)`, "i").exec(x);
  if (mul) {
    return {
      h: Number(mul[1]),
      w: Number(mul[2]),
      d: Number(mul[3]),
    };
  }
  const parts = x
    .split(/\s*[-–]\s*/)
    .map((p) => parseNum(p.replace(/[^\d.]/g, "")))
    .filter((n): n is number => n != null);
  if (parts.length >= 3) return { h: parts[0]!, w: parts[1]!, d: parts[2]! };
  return null;
}

function parseNoiseDb(value: string): number | null {
  const parts = value
    .split(/\s*[-–/]\s*/)
    .map((p) => parseNum(p.replace(/[^\d.,]/g, "")))
    .filter((n): n is number => n != null);
  if (!parts.length) return null;
  return Math.min(...parts);
}

const SPEC_TABLE_HINT =
  /охлаждащ|seer|scop|размери|тегло|шум|хладилен агент|refrigerant|r32|r410|cooling capacity|heating capacity|indoor unit|outdoor unit|sound level|energy efficiency/i;

/** Етикет + стойност от ред с 2+ клетки (Climacom често има празна първа колона). */
function pickSpecRowLabelValue(cells: string[]): { label: string; value: string } | null {
  const nonEmpty = cells.map((c) => c.trim()).filter(Boolean);
  if (nonEmpty.length < 2) return null;
  const value = nonEmpty[nonEmpty.length - 1]!;
  const label = nonEmpty[nonEmpty.length - 2]!;
  if (!label || !value) return null;
  return { label: label.toLowerCase(), value };
}

function extractSpecRows(html: string): Map<string, string> {
  const rows = new Map<string, string>();
  const tableBlocks = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  for (const block of tableBlocks) {
    if (!SPEC_TABLE_HINT.test(block)) continue;
    const trRe = /<tr[\s\S]*?<\/tr>/gi;
    let tr: RegExpExecArray | null;
    while ((tr = trRe.exec(block)) !== null) {
      const cells: string[] = [];
      const tdRe = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      let td: RegExpExecArray | null;
      while ((td = tdRe.exec(tr[0])) !== null) {
        const t = stripHtmlToText(td[1]);
        if (t) cells.push(t);
      }
      const pair = pickSpecRowLabelValue(cells);
      if (pair && !pair.label.includes("качено") && !pair.label.includes("цена")) {
        rows.set(pair.label, pair.value);
      }
    }
  }
  return rows;
}

function rowValue(rows: Map<string, string>, ...fragments: string[]): string | null {
  for (const [label, value] of rows) {
    if (fragments.every((f) => label.includes(f))) return value;
  }
  return null;
}

/** Първо съвпадение от няколко варианта на етикет (български / английски). */
function rowValueAny(rows: Map<string, string>, ...patternSets: string[][]): string | null {
  for (const fragments of patternSets) {
    const v = rowValue(rows, ...fragments);
    if (v) return v;
  }
  return null;
}

/**
 * Infer EU seasonal energy class from SEER value.
 * Thresholds per EU Regulation 206/2012.
 */
function energyClassFromSeer(seer: number): string | null {
  if (seer >= 8.5) return "A+++";
  if (seer >= 5.6) return "A++";
  if (seer >= 4.6) return "A+";
  if (seer >= 3.8) return "A";
  return null;
}

/**
 * Infer EU seasonal energy class from SCOP value.
 */
function energyClassFromScop(scop: number): string | null {
  if (scop >= 5.1) return "A+++";
  if (scop >= 4.6) return "A++";
  if (scop >= 4.0) return "A+";
  if (scop >= 3.4) return "A";
  return null;
}

/**
 * Extract energy classes from feature labels (WC attributes or h6 tags).
 * Returns the two classes found (sorted highest first) assigned to cool/heat
 * by matching against inferred SEER/SCOP classes.
 */
function extractEnergyClassesFromLabels(
  labels: string[],
  seer: number | null | undefined,
  scop: number | null | undefined,
): { cool: string | null; heat: string | null } {
  const found: string[] = [];
  for (const lbl of labels) {
    const normalized = lbl.replace(/\u0410/g, "A");
    const m =
      normalized.match(/Енергиен\s+клас\s+(A\+{0,3})/i) ??
      normalized.match(/Energy\s+efficiency\s+class\s+(A\+{0,3})/i);
    if (m?.[1]) found.push(m[1].toUpperCase());
  }
  if (!found.length) return { cool: null, heat: null };

  const inferredCool = seer != null ? energyClassFromSeer(seer) : null;
  const inferredHeat = scop != null ? energyClassFromScop(scop) : null;

  // Match found classes to cool/heat by exact match with inferred values
  let cool: string | null = null;
  let heat: string | null = null;
  for (const cls of found) {
    if (!cool && cls === inferredCool) cool = cls;
    else if (!heat && cls === inferredHeat) heat = cls;
  }
  // Fallback: assign remaining found classes by order
  if (!cool && !heat && found.length >= 2) {
    const sorted = [...found].sort((a, b) => b.length - a.length); // longer = higher class
    cool = sorted[0] ?? null;
    heat = sorted[1] ?? null;
  } else if (!cool && found.length === 1 && !heat) {
    cool = found[0] ?? null;
  }
  return { cool, heat };
}

/** Returns true if this is an outdoor-only unit (no indoor body). */
function isOutdoorOnly(html: string, name: string): boolean {
  if (/външно\s+тяло|outdoor\s+unit/i.test(name)) return true;
  // If spec table has indoor dimensions row, it's not outdoor-only
  if (/размери\s+вътр|indoor\s+unit\s+dim/i.test(html)) return false;
  return false;
}

/** Detect built-in WiFi from WC feature labels.
 *  Returns true for built-in, false for optional, null if no WiFi info found. */
function detectClimacomWifi(featureLabels: string[]): boolean | null {
  let foundWifi = false;
  let allOptional = true;
  for (const lbl of featureLabels) {
    if (!/wi-?fi|melcloud/i.test(lbl)) continue;
    foundWifi = true;
    if (!/опция/i.test(lbl)) {
      allOptional = false; // at least one label without "Опция" → built-in
    }
  }
  if (!foundWifi) return null;
  return !allOptional;
}

export function extractClimacomProductSpecs(
  html: string,
  featureLabels: string[] = [],
): ClimacomParsedProduct["specs"] {
  const rows = extractSpecRows(html);
  const specs: ClimacomParsedProduct["specs"] = {};
  const outdoorOnly = isOutdoorOnly(html, "");

  // ── Power ────────────────────────────────────────────────────────────────
  const coolVal = rowValueAny(
    rows,
    ["охлаждащ", "мощност"],
    ["cooling", "capacity"],
  );
  const heatVal = rowValueAny(
    rows,
    ["отоплителн", "мощност"],
    ["heating", "capacity"],
  );
  if (coolVal) specs.cooling_power_kw = parseNominalFromRange(coolVal);
  if (heatVal) specs.heating_power_kw = parseNominalFromRange(heatVal);

  // ── SEER / SCOP — don't fall back to EER/COP (seasonal ≠ rated) ──────────
  const seerVal = rowValue(rows, "seer");
  const scopVal = rowValue(rows, "scop");
  if (seerVal) specs.seer = parseNum(seerVal) ?? undefined;
  if (scopVal) specs.scop = parseNum(scopVal) ?? undefined;

  // ── Energy classes ────────────────────────────────────────────────────────
  // Priority: SEER/SCOP inference (most reliable) > feature labels > table images
  let energyCool: string | null = null;
  let energyHeat: string | null = null;
  // 1. Infer from SEER/SCOP (mathematically deterministic per EU regulation)
  if (specs.seer != null) energyCool = energyClassFromSeer(specs.seer);
  if (specs.scop != null) energyHeat = energyClassFromScop(specs.scop);
  // 2. Supplement from feature labels if still missing
  if (!energyCool || !energyHeat) {
    const fromLabels = extractEnergyClassesFromLabels(featureLabels, specs.seer, specs.scop);
    if (!energyCool) energyCool = fromLabels.cool;
    if (!energyHeat) energyHeat = fromLabels.heat;
  }
  // 3. Last resort: table image extraction (may be inaccurate on Climacom)
  if (!energyCool || !energyHeat) {
    const fromTable = extractClimacomEnergyClasses(html);
    if (!energyCool) energyCool = fromTable.cool;
    if (!energyHeat) energyHeat = fromTable.heat;
  }
  specs.energy_class_cool = energyCool ?? null;
  specs.energy_class_heat = energyHeat ?? null;

  // ── Noise ─────────────────────────────────────────────────────────────────
  const noiseCool = rowValueAny(
    rows,
    ["шум", "охл"],
    ["sound", "cool"],
  );
  const noiseHeat = rowValueAny(
    rows,
    ["шум", "отопл"],
    ["sound", "heat"],
  );
  const noiseAny =
    rowValueAny(rows, ["шумов"], ["шум"], ["sound", "level"], ["sound"]) ?? null;
  specs.noise_db =
    parseNoiseDb(noiseCool ?? "") ??
    parseNoiseDb(noiseHeat ?? "") ??
    parseNoiseDb(noiseAny ?? "") ??
    null;

  // ── Dimensions ───────────────────────────────────────────────────────────
  const indoorDim = rowValueAny(
    rows,
    ["размери", "вътр"],
    ["indoor", "dimension"],
  );
  const outdoorDim = rowValueAny(
    rows,
    ["размери", "външ"],
    ["outdoor", "dimension"],
  );
  const anyDim = rowValueAny(rows, ["размери"], ["dimension"]);
  const inD = parseDimensionsTriplet(indoorDim ?? "");
  const outD = parseDimensionsTriplet(outdoorDim ?? (outdoorOnly ? anyDim : null) ?? "");
  if (inD) {
    specs.dim_indoor_height_mm = inD.h;
    specs.dim_indoor_width_mm = inD.w;
    specs.dim_indoor_length_mm = inD.d;
  }
  if (outD) {
    specs.dim_outdoor_height_mm = outD.h;
    specs.dim_outdoor_width_mm = outD.w;
    specs.dim_outdoor_length_mm = outD.d;
  } else if (!outdoorOnly && anyDim && !inD) {
    // Table had generic "Размери" with no indoor match → outdoor-only layout
    const d = parseDimensionsTriplet(anyDim);
    if (d) {
      specs.dim_outdoor_height_mm = d.h;
      specs.dim_outdoor_width_mm = d.w;
      specs.dim_outdoor_length_mm = d.d;
    }
  }

  // ── Weight ────────────────────────────────────────────────────────────────
  const weightVal = rowValueAny(rows, ["тегло"], ["weight"]);
  if (weightVal) {
    const slash = weightVal.match(/([\d.,]+)\s*[/\/]\s*([\d.,]+)/);
    if (slash) {
      specs.weight_indoor_kg = parseNum(slash[1]);
      specs.weight_outdoor_kg = parseNum(slash[2]);
    } else {
      const single = parseNum(weightVal.replace(/[^\d.,]/g, ""));
      if (/външ|outdoor/i.test(weightVal) || outdoorOnly || !indoorDim) {
        // Outdoor-only or no indoor dimension → weight is outdoor
        specs.weight_outdoor_kg = single;
      } else {
        specs.weight_indoor_kg = single;
      }
    }
  }

  // ── Refrigerant ───────────────────────────────────────────────────────────
  const refrRow = rowValue(rows, "хладилен агент") ?? rowValue(rows, "refrigerant");
  const refrMatch = (refrRow ?? html).match(/\b(R32|R410A|R290)\b/i);
  if (refrMatch) specs.refrigerant = refrMatch[1]!.toUpperCase();

  // ── WiFi ──────────────────────────────────────────────────────────────────
  const wifiResult = detectClimacomWifi(featureLabels);
  if (wifiResult != null) specs.wifi = wifiResult;

  // ── BTU + coverage ────────────────────────────────────────────────────────
  if (specs.cooling_power_kw != null) {
    specs.btu = inferBtuFromCoolingKw(specs.cooling_power_kw);
    // Rough rule: 1 kW cooling ≈ 10 m²
    specs.coverage_m2 = Math.round(specs.cooling_power_kw * 10);
  }

  return specs;
}

export function wcPriceToEur(prices: ClimacomWcProduct["prices"]): number | null {
  if (!prices?.price && prices?.price !== "0") return null;
  const minor = prices.currency_minor_unit ?? 2;
  const raw = Number(prices.price);
  if (!Number.isFinite(raw) || raw < 0) return null;
  return raw === 0 ? 0 : raw / 10 ** minor;
}

export function resolveClimacomTypeHint(categorySlugs: string[], name: string): string | null {
  const slugs = categorySlugs.map((s) => s.toLowerCase());
  // Check category slugs first
  if (slugs.some((s) => s.includes("multisplit") || s.includes("multi"))) return "мулти";
  if (slugs.some((s) => s.includes("kolonen") || s.includes("kolonen-tip"))) return "колон";
  if (slugs.some((s) => s.includes("podov"))) return "подов";
  if (slugs.some((s) => s.includes("kaset"))) return "касет";
  if (slugs.some((s) => s.includes("tavan"))) return "таван";
  if (slugs.some((s) => s.includes("stenni"))) return "стен";
  // SFZ-M / SLZ-M / SEZ-M inner units always pair with MXZ multi-split outdoor bodies
  if (slugs.some((s) => /sfz-m|slz-m|sez-m|mxz/.test(s))) return "мулти";
  // Check product name
  if (/мулти|мульти|multisplit|мултисплит/i.test(name)) return "мулти";
  if (/mxz\b|sfz-m\d|slz-m\d|sez-m\d/i.test(name)) return "мулти";
  if (/колон/i.test(name) || /\bpsa-m/i.test(name)) return "колон";
  if (/подов|таванно[\s-]*подов/i.test(name)) return "подов";
  if (/касет|4[\s-]*посоч/i.test(name)) return "касет";
  if (/таван/i.test(name)) return "таван";
  if (/стенен|стенни/i.test(name)) return "стен";
  return null;
}

export function collectFeatureLabels(wc: ClimacomWcProduct): string[] {
  const labels: string[] = [];
  for (const attr of wc.attributes ?? []) {
    for (const term of attr.terms ?? []) {
      if (term.name?.trim()) labels.push(term.name.trim());
    }
  }
  return labels;
}

export async function fetchClimacomHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} за ${url}`);
  return res.text();
}

export async function parseClimacomProduct(
  wc: ClimacomWcProduct,
  html: string,
): Promise<ClimacomParsedProduct | null> {
  const priceEur = wcPriceToEur(wc.prices);
  if (priceEur === null || !wc.name?.trim()) return null;

  const categorySlugs = (wc.categories ?? []).map((c) => c.slug);
  const plainDesc = extractClimacomDescription(wc, html) ?? "";
  const modelCode =
    (wc.sku?.trim() || null) ?? extractModelCode(wc.name) ?? extractModelCode(plainDesc);
  const brandName = resolveBrandName(wc.name, "Mitsubishi Electric");
  const featureLabels = collectFeatureLabels(wc);
  const specs = extractClimacomProductSpecs(html, featureLabels);
  if (!specs.btu) {
    const btuFromTitle = wc.name.match(/(\d[\d\s]*)\s*(?:000\s*)?BTU/i);
    if (btuFromTitle) {
      const n = parseInt(btuFromTitle[1]!.replace(/\s/g, ""), 10);
      specs.btu = n >= 1000 ? Math.round(n / 1000) : n;
    }
  }

  const imageUrls = (wc.images ?? [])
    .map((img) => img.src || img.thumbnail)
    .filter((u): u is string => Boolean(u?.trim()));

  return {
    sourceUrl: wc.permalink,
    wcId: wc.id,
    name: wc.name.trim(),
    modelCode,
    brandName,
    priceEur,
    priceWithMountEur: priceEur + 200,
    description: plainDesc || null,
    imageUrls: [...new Set(imageUrls)].slice(0, 4),
    categorySlugs,
    typeHint: resolveClimacomTypeHint(categorySlugs, wc.name),
    featureLabels,
    specs,
  };
}
