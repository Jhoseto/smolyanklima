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

function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
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

function parseDimensionsTriplet(value: string): { h: number; w: number; d: number } | null {
  const x = value.replace(/,/g, "").trim();
  const mul = x.match(/(\d+)\s*[×x]\s*(\d+)\s*[×x]\s*(\d+)/i);
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

function extractSpecRows(html: string): Map<string, string> {
  const rows = new Map<string, string>();
  const tableBlocks = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  for (const block of tableBlocks) {
    if (!/охлаждащ|seer|scop|размери|тегло|шум/i.test(block)) continue;
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
      if (cells.length >= 2) {
        const label = cells[0]!.toLowerCase();
        const value = cells[cells.length - 1]!;
        if (label && value && !label.includes("качено")) rows.set(label, value);
      }
    }
    if (rows.size > 3) break;
  }
  return rows;
}

function rowValue(rows: Map<string, string>, ...fragments: string[]): string | null {
  for (const [label, value] of rows) {
    if (fragments.every((f) => label.includes(f))) return value;
  }
  return null;
}

export function extractClimacomProductSpecs(html: string): ClimacomParsedProduct["specs"] {
  const rows = extractSpecRows(html);
  const specs: ClimacomParsedProduct["specs"] = {};

  const coolVal = rowValue(rows, "охлаждащ", "мощност");
  const heatVal = rowValue(rows, "отоплителн", "мощност");
  if (coolVal) specs.cooling_power_kw = parseNominalFromRange(coolVal);
  if (heatVal) specs.heating_power_kw = parseNominalFromRange(heatVal);

  const seerVal = rowValue(rows, "seer") ?? rowValue(rows, "eer");
  const scopVal = rowValue(rows, "scop") ?? rowValue(rows, "cop");
  if (seerVal) specs.seer = parseNum(seerVal) ?? undefined;
  if (scopVal) specs.scop = parseNum(scopVal) ?? undefined;

  const energyFromTable = extractClimacomEnergyClasses(html);
  specs.energy_class_cool =
    energyFromTable.cool ?? parseEnergyClassFromText(seerVal) ?? null;
  specs.energy_class_heat =
    energyFromTable.heat ?? parseEnergyClassFromText(scopVal) ?? null;

  const noiseCool = rowValue(rows, "шум", "охл");
  const noiseHeat = rowValue(rows, "шум", "отопл");
  const noiseAny = rowValue(rows, "шумов");
  specs.noise_db =
    parseNoiseDb(noiseCool ?? "") ?? parseNoiseDb(noiseHeat ?? "") ?? parseNoiseDb(noiseAny ?? "") ?? null;

  const indoorDim = rowValue(rows, "размери", "вътр");
  const outdoorDim = rowValue(rows, "размери", "външ");
  const anyDim = rowValue(rows, "размери");
  const inD = parseDimensionsTriplet(indoorDim ?? "");
  const outD = parseDimensionsTriplet(outdoorDim ?? anyDim ?? "");
  if (inD) {
    specs.dim_indoor_height_mm = inD.h;
    specs.dim_indoor_width_mm = inD.w;
    specs.dim_indoor_length_mm = inD.d;
  }
  if (outD && outdoorDim) {
    specs.dim_outdoor_height_mm = outD.h;
    specs.dim_outdoor_width_mm = outD.w;
    specs.dim_outdoor_length_mm = outD.d;
  }

  const weightVal = rowValue(rows, "тегло");
  if (weightVal) {
    const slash = weightVal.match(/([\d.,]+)\s*\/\s*([\d.,]+)/);
    if (slash) {
      specs.weight_indoor_kg = parseNum(slash[1]);
      specs.weight_outdoor_kg = parseNum(slash[2]);
    } else {
      const single = parseNum(weightVal.replace(/[^\d.,]/g, ""));
      if (/външ/i.test(weightVal)) specs.weight_outdoor_kg = single;
      else specs.weight_indoor_kg = single;
    }
  }

  const refr = html.match(/\b(R32|R410A|R290)\b/i);
  if (refr) specs.refrigerant = refr[1]!.toUpperCase();
  if (/wi-?fi|melcloud|безжич/i.test(html)) specs.wifi = true;

  if (specs.cooling_power_kw != null) {
    specs.btu = inferBtuFromCoolingKw(specs.cooling_power_kw);
  }

  return specs;
}

export function wcPriceToEur(prices: ClimacomWcProduct["prices"]): number | null {
  if (!prices?.price) return null;
  const minor = prices.currency_minor_unit ?? 2;
  const raw = Number(prices.price);
  if (!Number.isFinite(raw) || raw <= 0) return null;
  return raw / 10 ** minor;
}

export function resolveClimacomTypeHint(categorySlugs: string[], name: string): string | null {
  if (categorySlugs.some((s) => s.includes("multisplit"))) return "мульти";
  if (categorySlugs.some((s) => s.includes("stenni"))) return "стен";
  if (/мульти|multisplit/i.test(name)) return "мульти";
  if (/стенен|стенни/i.test(name)) return "стен";
  if (/касет/i.test(name)) return "касет";
  if (/подов/i.test(name)) return "подов";
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
  if (!priceEur || !wc.name?.trim()) return null;

  const categorySlugs = (wc.categories ?? []).map((c) => c.slug);
  const plainDesc = stripHtmlToText(wc.short_description ?? wc.description ?? "");
  const modelCode =
    (wc.sku?.trim() || null) ?? extractModelCode(wc.name) ?? extractModelCode(plainDesc);
  const brandName = resolveBrandName(wc.name, "Mitsubishi Electric");
  const specs = extractClimacomProductSpecs(html);
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
    featureLabels: collectFeatureLabels(wc),
    specs,
  };
}
