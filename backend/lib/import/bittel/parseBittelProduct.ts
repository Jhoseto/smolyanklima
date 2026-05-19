import { inferBtuFromCoolingKw } from "@/lib/catalog/productBtu";
import { parseEnergyClassFromText } from "../parseEnergyClass";
import { resolveBrandName } from "../brandFromTitle";

export const BITTEL_BASE_URL = "https://www.bittel.bg";

export type BittelParsedProduct = {
  sourceUrl: string;
  name: string;
  modelCode: string | null;
  brandName: string;
  priceEur: number;
  priceWithMountEur: number;
  description: string | null;
  imageUrls: string[];
  categorySlug: string | null;
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
  "Accept-Language": "bg,en;q=0.8",
  "Cache-Control": "no-cache",
};

const DEFAULT_MOUNT_EUR = 200;
const MAX_PRODUCT_IMAGES = 4;
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|avif)(\?|$)/i;

export async function fetchBittelHtml(url: string): Promise<string> {
  const res = await fetch(url, { headers: FETCH_HEADERS, redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} за ${url}`);
  return res.text();
}

function decodeHtml(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtmlToText(fragment: string): string {
  return decodeHtml(fragment.replace(/<[^>]+>/g, " "));
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/\s/g, "").replace(",", ".").trim());
  return Number.isFinite(n) && n !== 0 ? n : null;
}

function firstNumberInText(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/\s/g, "").replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return m ? parseNum(m[1]) : null;
}

/** "1.3 / 3.3 / 3.8 kW" → 3.3 (nominal = middle value) */
function parseNominalKw(raw: string | undefined): number | null {
  if (!raw) return null;
  const parts = raw
    .replace(/kW/gi, "")
    .split("/")
    .map((p) => parseNum(p.trim()))
    .filter((n): n is number => n != null);
  if (parts.length === 3) return parts[1]!;
  if (parts.length === 2) return parts[0]!;
  if (parts.length === 1) return parts[0]!;
  return null;
}

/** "43 / - / 27 / 20 dB (A)" → 20 (min = silent mode) */
function parseNoiseDb(raw: string | undefined): number | null {
  if (!raw) return null;
  const parts = raw
    .replace(/dB.*$/i, "")
    .split("/")
    .map((p) => parseNum(p.replace(/[^\d.,\-]/g, "").trim()))
    .filter((n): n is number => n != null && n > 0);
  if (!parts.length) return null;
  return Math.min(...parts);
}

/** "286 x 770 x 225 В x Ш x Д (мм)" → {h, w, d} in mm (Височина × Ширина × Дълбочина) */
function parseDimensionsHwd(s: string | undefined): {
  height_mm: number;
  width_mm: number;
  depth_mm: number;
} | null {
  if (!s) return null;
  const clean = s
    .replace(/В\s*[xх×]/gi, "x")
    .replace(/Ш\s*[xх×]/gi, "x")
    .replace(/Д\s*/gi, "")
    .replace(/\(мм\)/gi, "")
    .trim();
  const parts = clean
    .split(/\s*[xхX×]\s*/)
    .map((p) => parseInt(p.replace(/\D/g, ""), 10));
  if (parts.length < 3 || parts.some((n) => !Number.isFinite(n) || n <= 0)) return null;
  return { height_mm: parts[0]!, width_mm: parts[1]!, depth_mm: parts[2]! };
}

/**
 * Bittel pages have "Техническа информация" with sub-sections:
 * "Основни характеристики", "Вътрешно тяло", "Външно тяло".
 * We parse spec tables/definition lists and track which section each row belongs to.
 */
export function extractBittelSpecRows(html: string): {
  general: Map<string, string>;
  indoor: Map<string, string>;
  outdoor: Map<string, string>;
} {
  const general = new Map<string, string>();
  const indoor = new Map<string, string>();
  const outdoor = new Map<string, string>();

  // Find the "Техническа информация" section
  const techSection =
    html.match(/[Тт]ехническа\s+информация[\s\S]{0,60000}/)?.[0] ??
    html.match(/technical[\s\S]{0,60000}/i)?.[0] ??
    html;

  // Split into sub-sections by headers
  // Headers appear as text "Основни характеристики", "Вътрешно тяло", "Външно тяло"
  const generalMarker = /основни\s+характеристики/i;
  const indoorMarker = /вътрешно\s+тяло/i;
  const outdoorMarker = /външно\s+тяло/i;

  let generalText = "";
  let indoorText = "";
  let outdoorText = "";

  const indoorIdx = techSection.search(indoorMarker);
  const outdoorIdx = techSection.search(outdoorMarker);
  const generalIdx = techSection.search(generalMarker);

  if (generalIdx >= 0) {
    const end = indoorIdx > generalIdx ? indoorIdx : (outdoorIdx > generalIdx ? outdoorIdx : techSection.length);
    generalText = techSection.slice(generalIdx, end);
  } else {
    // No explicit general section marker — use everything before "Вътрешно тяло"
    const end = indoorIdx >= 0 ? indoorIdx : (outdoorIdx >= 0 ? outdoorIdx : techSection.length / 3);
    generalText = techSection.slice(0, end);
  }

  if (indoorIdx >= 0) {
    const end = outdoorIdx > indoorIdx ? outdoorIdx : techSection.length;
    indoorText = techSection.slice(indoorIdx, end);
  }

  if (outdoorIdx >= 0) {
    outdoorText = techSection.slice(outdoorIdx);
  }

  function parseSection(sectionHtml: string): Map<string, string> {
    const rows = new Map<string, string>();

    // Try: <tr><td>label</td><td>value</td></tr> pattern
    const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let tr: RegExpExecArray | null;
    while ((tr = trRe.exec(sectionHtml)) !== null) {
      const cells: string[] = [];
      const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let td: RegExpExecArray | null;
      while ((td = tdRe.exec(tr[1]!)) !== null) {
        const t = stripHtmlToText(td[1]!).trim();
        if (t) cells.push(t);
      }
      if (cells.length >= 2) {
        const label = cells[0]!.replace(/:$/, "").toLowerCase().trim();
        const value = cells[cells.length - 1]!.trim();
        if (label && value && label.length <= 120) rows.set(label, value);
      }
    }

    // Try: <dt>label</dt><dd>value</dd> pattern
    const dlContent = sectionHtml.match(/<d[lt][^>]*>[\s\S]*?(?=<\/dl>|$)/gi) ?? [];
    for (const dl of dlContent) {
      const dtRe = /<dt[^>]*>([\s\S]*?)<\/dt>/gi;
      const ddRe = /<dd[^>]*>([\s\S]*?)<\/dd>/gi;
      const labels: string[] = [];
      const values: string[] = [];
      let dt: RegExpExecArray | null;
      let dd: RegExpExecArray | null;
      while ((dt = dtRe.exec(dl)) !== null) labels.push(stripHtmlToText(dt[1]!).replace(/:$/, "").toLowerCase().trim());
      while ((dd = ddRe.exec(dl)) !== null) values.push(stripHtmlToText(dd[1]!).trim());
      for (let i = 0; i < Math.min(labels.length, values.length); i++) {
        const l = labels[i]!;
        const v = values[i]!;
        if (l && v && l.length <= 120) rows.set(l, v);
      }
    }

    // Try: lines matching "Label: Value" or "Label Value\n" pattern in plain text
    if (rows.size < 2) {
      const text = stripHtmlToText(sectionHtml);
      const lineRe = /([А-ЯA-Za-z][А-Яа-яA-Za-z\s()\/.,+-]{3,80}?)\s*:\s*([^\n:]{2,100})/g;
      let m: RegExpExecArray | null;
      while ((m = lineRe.exec(text)) !== null) {
        const label = m[1]!.toLowerCase().trim();
        const value = m[2]!.trim();
        if (label && value && !rows.has(label)) rows.set(label, value);
      }
    }

    return rows;
  }

  // Parse each section
  const gRows = parseSection(generalText);
  const iRows = parseSection(indoorText);
  const oRows = parseSection(outdoorText);

  for (const [k, v] of gRows) general.set(k, v);
  for (const [k, v] of iRows) indoor.set(k, v);
  for (const [k, v] of oRows) outdoor.set(k, v);

  return { general, indoor, outdoor };
}

function rowValue(rows: Map<string, string>, ...fragments: string[]): string | undefined {
  for (const [label, value] of rows) {
    if (fragments.every((f) => label.includes(f.toLowerCase()))) return value;
  }
  return undefined;
}

export function extractBittelProductSpecs(html: string): BittelParsedProduct["specs"] {
  const { general, indoor, outdoor } = extractBittelSpecRows(html);

  // kW — cooling and heating (nominal)
  const coolRaw =
    rowValue(general, "мощност", "охлаждане") ??
    rowValue(general, "охладителна", "мощност") ??
    rowValue(general, "cooling");
  const heatRaw =
    rowValue(general, "мощност", "отопление") ??
    rowValue(general, "отоплителна", "мощност") ??
    rowValue(general, "heating");

  const coolKw = parseNominalKw(coolRaw);
  const heatKw = parseNominalKw(heatRaw);

  // BTU — explicit or inferred
  const btuRaw = rowValue(general, "мощност", "btu") ?? rowValue(general, "btu");
  let btu: number | null = null;
  if (btuRaw) {
    // "12 000 BTU" → 12
    const cleaned = btuRaw.replace(/\s/g, "").replace(",", ".");
    const m = cleaned.match(/(\d+(?:\.\d+)?)/);
    if (m) {
      const n = parseFloat(m[1]!);
      // Could be raw (12000) or already in thousands (12)
      btu = n >= 1000 ? Math.round(n / 1000) : (n > 0 ? Math.round(n) : null);
    }
  }
  if (!btu && coolKw) btu = inferBtuFromCoolingKw(coolKw);

  // SEER / SCOP
  const seerRaw = rowValue(general, "seer");
  const scopRaw = rowValue(general, "scop");
  const seer = firstNumberInText(seerRaw);
  const scop = firstNumberInText(scopRaw);

  // Energy class "A++ / A+"
  const energyRaw =
    rowValue(general, "енергиен клас") ??
    rowValue(general, "energy class");
  let energyCool: string | null = null;
  let energyHeat: string | null = null;
  if (energyRaw) {
    const parts = energyRaw.split("/").map((p) => parseEnergyClassFromText(p.trim()));
    energyCool = parts[0] ?? null;
    energyHeat = parts[1] ?? null;
  }

  // Coverage "22 кв. м"
  const covRaw =
    rowValue(general, "подходящ за помещения") ??
    rowValue(general, "площ") ??
    rowValue(general, "coverage");
  const coverage_m2 =
    firstNumberInText(covRaw) ??
    (coolKw != null && coolKw > 0 ? Math.round(coolKw * 10) : null);

  // Warranty
  const warRaw = rowValue(general, "гаранция");
  let warranty_months: number | null = null;
  if (warRaw) {
    const n = firstNumberInText(warRaw);
    if (n != null) {
      warranty_months = /месец/i.test(warRaw) ? n : n * 12; // assume years if no "месец"
    }
  }

  // Refrigerant
  const refRaw =
    rowValue(general, "хладилен агент") ??
    rowValue(general, "refrigerant") ??
    html.match(/\b(R-?32|R-?410A|R-?290)\b/i)?.[1];
  const refrigerant = refRaw ? refRaw.replace(/\s/g, "").toUpperCase() : null;

  // Wi-Fi
  const wifiRaw =
    rowValue(general, "wi-fi") ??
    rowValue(general, "wifi") ??
    rowValue(indoor, "wi-fi") ??
    rowValue(indoor, "wifi");
  let wifi: boolean | null = null;
  if (wifiRaw) {
    wifi = !/^(не|no|без|0|false)\b/i.test(wifiRaw.trim());
  } else if (/wi-?fi\s+в\s+комплект|включен.*wi-?fi|wi-?fi\s+модул.*да/i.test(html)) {
    wifi = true;
  }

  // Noise — indoor unit cooling noise (quiet mode)
  const noiseIndoorRaw =
    rowValue(indoor, "шум", "охлаждане") ??
    rowValue(indoor, "ниво на шум") ??
    rowValue(general, "шум") ??
    rowValue(general, "noise");
  const noise_db = parseNoiseDb(noiseIndoorRaw);

  // Indoor dimensions "В x Ш x Д (мм)"
  const dimInRaw =
    rowValue(indoor, "размери") ??
    rowValue(general, "размери");
  const indoorDim = parseDimensionsHwd(dimInRaw);

  // Outdoor dimensions
  const dimOutRaw = rowValue(outdoor, "размери");
  const outdoorDim = parseDimensionsHwd(dimOutRaw);

  // Weights
  const weightInRaw = rowValue(indoor, "тегло") ?? rowValue(general, "тегло");
  const weightOutRaw = rowValue(outdoor, "тегло");
  const weight_indoor_kg = firstNumberInText(weightInRaw);
  const weight_outdoor_kg = firstNumberInText(weightOutRaw);

  return {
    btu,
    coverage_m2: coverage_m2 != null && coverage_m2 > 0 ? Math.round(coverage_m2) : null,
    noise_db,
    cooling_power_kw: coolKw,
    heating_power_kw: heatKw,
    refrigerant,
    wifi,
    energy_class_cool: energyCool,
    energy_class_heat: energyHeat,
    seer,
    scop,
    warranty_months,
    weight_indoor_kg,
    weight_outdoor_kg,
    // Bittel dimensions: В=height, Ш=width (→ length in our schema), Д=depth (→ width in our schema)
    dim_indoor_height_mm: indoorDim?.height_mm ?? null,
    dim_indoor_length_mm: indoorDim?.width_mm ?? null,
    dim_indoor_width_mm: indoorDim?.depth_mm ?? null,
    dim_outdoor_height_mm: outdoorDim?.height_mm ?? null,
    dim_outdoor_length_mm: outdoorDim?.width_mm ?? null,
    dim_outdoor_width_mm: outdoorDim?.depth_mm ?? null,
  };
}

function toAbsoluteBittelUrl(src: string): string {
  const t = src.trim();
  if (!t || t.startsWith("data:")) return "";
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("http")) return t;
  if (t.startsWith("/")) return `${BITTEL_BASE_URL}${t}`;
  return "";
}

function isProductImageUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (!IMAGE_EXT.test(u)) return false;
  if (/logo|icon|flag|banner|sprite|social|avatar|pixel|tracking/i.test(u)) return false;
  // Bittel product images are under /web/files/products/ (not /thumbs/)
  if (!u.includes("bittel.bg")) return false;
  if (u.includes("/web/files/products/") || u.includes("/images/")) return true;
  return false;
}

function isProductThumbnailUrl(url: string): boolean {
  const u = url.toLowerCase();
  return u.includes("/web/files/thumbs/") && IMAGE_EXT.test(u) && u.includes("bittel.bg");
}

/** Convert thumbnail URL to full-size URL (strip thumbs path component) */
function upgradeToFullSize(url: string): string {
  // Typically: /web/files/thumbs/products/... → /web/files/products/...
  return url.replace(/\/web\/files\/thumbs\//, "/web/files/");
}

export function extractBittelProductImageUrls(html: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const push = (raw: string, preferFull = false) => {
    let abs = toAbsoluteBittelUrl(raw);
    if (!abs) return;
    // Try to upgrade thumbnail → full size
    if (isProductThumbnailUrl(abs)) {
      const full = upgradeToFullSize(abs);
      abs = full;
    }
    if (!isProductImageUrl(abs) && !isProductThumbnailUrl(abs)) return;
    // Normalise: remove query string
    const clean = abs.split("?")[0]!;
    if (!seen.has(clean)) {
      seen.add(clean);
      urls.push(clean);
    }
  };

  // og:image is the main product image
  const og = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (og?.[1]) push(og[1]);

  // Gallery area — look for product image containers
  const galleryBlock =
    html.match(/class=["'][^"']*product[_-]?(?:images?|gallery|photo)[^"']*["'][\s\S]{0,20000}/i)?.[0] ??
    html.match(/id=["'][^"']*product[_-]?(?:images?|gallery|photos?)[^"']*["'][\s\S]{0,20000}/i)?.[0] ??
    html.slice(0, 60000);

  // Extract data-zoom-image, data-large_image, data-src, src
  const imgRe = /\b(?:data-zoom-image|data-large_image|data-src|src)=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(galleryBlock)) !== null) {
    push(m[1]!);
    if (urls.length >= MAX_PRODUCT_IMAGES * 2) break;
  }

  return urls.slice(0, MAX_PRODUCT_IMAGES);
}

/** Extract description from "Подробно описание" section */
export function extractBittelDescription(html: string): string | null {
  // Look for "Подробно описание" section
  const descSection =
    html.match(/[Пп]одробно\s+описание[\s\S]{0,12000}/)?.[0] ??
    html.match(/[Оо]писание[\s\S]{0,8000}/)?.[0];

  if (!descSection) return null;

  // Extract paragraphs and headings
  const parts: string[] = [];

  // Extract <h2>/<h3> headings followed by <p> text
  const headingRe = /<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi;
  let h: RegExpExecArray | null;
  while ((h = headingRe.exec(descSection)) !== null) {
    const heading = stripHtmlToText(h[1]!);
    if (heading && heading.length > 2) parts.push(heading);
  }

  // Extract <p> paragraphs
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
  let p: RegExpExecArray | null;
  while ((p = pRe.exec(descSection)) !== null) {
    const text = stripHtmlToText(p[1]!);
    if (text && text.length > 10) parts.push(text);
  }

  // Extract <li> bullets
  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let li: RegExpExecArray | null;
  while ((li = liRe.exec(descSection)) !== null) {
    const text = stripHtmlToText(li[1]!);
    if (text && text.length > 8 && text.length <= 300) parts.push(`• ${text}`);
  }

  if (!parts.length) {
    // Fallback: strip all HTML tags and take the text
    const rawText = stripHtmlToText(descSection).slice(0, 4000);
    if (rawText.length > 50) return rawText;
    return null;
  }

  return parts.join("\n\n").slice(0, 4000) || null;
}

/** Extract model code from product name.
 * Examples:
 * "Инверторен климатик Daikin Sensira FTXF35F + RXF35F" → "FTXF35F+RXF35F"
 * "LG мулти сплит система RM3U19.U24 + RMN09.NSJ" → "RM3U19.U24+RMN09.NSJ"
 * "Zewnętrzne тяло AUX AM2-H18/4DR3HA" → "AM2-H18/4DR3HA"
 */
export function extractBittelModelCode(name: string): string | null {
  // Full kit: "FTXF35F + RXF35F" or "FTXF35F+RXF35F"
  const kitMatch = name.match(/\b([A-Z][A-Z0-9]{2,}[0-9][A-Z0-9]*(?:[./][A-Z0-9]+)*)\s*\+\s*([A-Z][A-Z0-9]{2,}[0-9][A-Z0-9]*(?:[./][A-Z0-9]+)*)\b/);
  if (kitMatch) return `${kitMatch[1]!}+${kitMatch[2]!}`;

  // Multi-unit system: "RM3U19.U24 + RMN09.NSJ + ..."
  const multiMatch = name.match(/\b([A-Z][A-Z0-9]{2,}[0-9][\w.]*(?:\s*\+\s*[A-Z][A-Z0-9]{2,}[\w.]+){1,4})/);
  if (multiMatch) return multiMatch[1]!.replace(/\s*\+\s*/g, "+");

  // Single model code like "AM2-H18/4DR3HA" or "BRP069B45"
  const single = name.match(/\b([A-Z]{2,}[0-9][-\w./]+)\b/);
  if (single?.[1] && single[1]!.length >= 5) return single[1]!;

  return null;
}

/** Extract brand name from product name using known brand list */
export function extractBittelBrandName(name: string): string {
  const known = [
    "Daikin", "Mitsubishi Electric", "Mitsubishi Heavy Industries",
    "LG", "Toshiba", "Gree", "AUX", "Nippon", "TechPoint", "TECHPOINT",
    "Hitachi", "Fujitsu", "Samsung", "Haier", "TCL", "Bosch", "Panasonic",
  ];
  for (const b of known) {
    if (new RegExp(`\\b${b}\\b`, "i").test(name)) return b;
  }
  // Try resolveBrandName from shared utility
  return resolveBrandName(name) ?? "Неизвестна марка";
}

export function parseBittelProductPage(
  html: string,
  sourceUrl: string,
  listingCategoryPath?: string | null,
): BittelParsedProduct | null {
  // Extract name
  const h1 = html.match(/<h1[^>]*itemprop=["']name["'][^>]*>([\s\S]*?)<\/h1>/i) ??
             html.match(/<h1[^>]*class=["'][^"']*product[_-]?name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ??
             html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const ogTitle = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const name = decodeHtml((h1?.[1] ?? ogTitle?.[1] ?? "").replace(/<[^>]+>/g, ""));
  if (!name || name.length < 3) return null;

  // Extract price in EUR — "1063.00 € | 2079.05 лв."
  // Look for the first "N.NN €" or "€ N.NN" pattern
  const priceEur = extractBittelPriceEur(html);
  if (priceEur == null || priceEur <= 0) return null;

  const brandName = extractBittelBrandName(name);
  const modelCode = extractBittelModelCode(name);
  const description = extractBittelDescription(html);
  const imageUrls = extractBittelProductImageUrls(html);
  const specs = extractBittelProductSpecs(html);

  // Category and type from listing path + name
  const { categorySlug, typeHint } = resolveBittelProductClassification(name, listingCategoryPath ?? null);

  // Feature labels from description
  const featureLabels = extractBittelFeatureLabels(html, description);

  return {
    sourceUrl,
    name,
    modelCode,
    brandName,
    priceEur,
    priceWithMountEur: Math.round((priceEur + DEFAULT_MOUNT_EUR) * 100) / 100,
    description: description || null,
    imageUrls,
    categorySlug,
    typeHint,
    featureLabels,
    specs,
  };
}

export function extractBittelPriceEur(html: string): number | null {
  // Pattern: "1063.00 €" or "1 063.00 €" or "€ 1063.00"
  const candidates: RegExpMatchArray[] = [];

  // Look in the first part of the page (price area)
  const priceArea =
    html.match(/itemprop=["']price["'][\s\S]{0,400}/i)?.[0] ??
    html.match(/class=["'][^"']*price[^"']*["'][\s\S]{0,400}/i)?.[0] ??
    html.slice(0, 4000);

  // "1063.00 € | 2079.05 лв." → first number before €
  const beforeEuro = priceArea.match(/([\d][\d\s]*[\d][.,]\d{2})\s*€/);
  if (beforeEuro?.[1]) {
    const n = parseNum(beforeEuro[1]);
    if (n && n > 0) return Math.round(n * 100) / 100;
  }

  // "€ 1063.00"
  const afterEuro = priceArea.match(/€\s*([\d][\d\s]*[\d][.,]\d{2})/);
  if (afterEuro?.[1]) {
    const n = parseNum(afterEuro[1]);
    if (n && n > 0) return Math.round(n * 100) / 100;
  }

  // Last resort: any price-looking number in the page
  const any = html.match(/([\d][\d\s]*[\d][.,]\d{2})\s*€/);
  if (any?.[1]) {
    const n = parseNum(any[1]);
    if (n && n > 0) return Math.round(n * 100) / 100;
  }

  void candidates;
  return null;
}

function resolveBittelProductClassification(
  name: string,
  listingCategoryPath: string | null,
): { categorySlug: string; typeHint: string } {
  const hay = `${name} ${listingCategoryPath ?? ""}`.toLowerCase();

  if (/multisplit|мулти[\s-]*сплит|\/c\/klimatici\/invertorni-multisplit/i.test(hay)) {
    return { categorySlug: "multi", typeHint: "Мулти" };
  }
  if (/подов\s+тип|floor/i.test(name)) {
    return { categorySlug: "floor", typeHint: "Подов" };
  }
  if (/касет/i.test(name)) {
    return { categorySlug: "cassette", typeHint: "Касетъчен" };
  }
  return { categorySlug: "wall", typeHint: "Стенен" };
}

export { resolveBittelProductClassification };

function extractBittelFeatureLabels(html: string, description: string | null): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  const descSection =
    html.match(/[Пп]одробно\s+описание[\s\S]{0,12000}/)?.[0] ?? "";

  const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let li: RegExpExecArray | null;
  while ((li = liRe.exec(descSection)) !== null) {
    const t = stripHtmlToText(li[1]!);
    if (t.length < 8 || t.length > 200) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(t);
  }

  // Also extract heading features
  const h3Re = /<h3[^>]*>([\s\S]*?)<\/h3>/gi;
  let h3: RegExpExecArray | null;
  while ((h3 = h3Re.exec(descSection)) !== null) {
    const t = stripHtmlToText(h3[1]!);
    if (t.length >= 8 && t.length <= 120) {
      const key = t.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        labels.push(t);
      }
    }
  }

  return labels;
}

