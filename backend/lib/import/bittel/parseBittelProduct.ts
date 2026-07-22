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
  // Browser-like UA: some Bittel product pages return empty body for custom agents.
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "bg,en;q=0.8",
  "Accept-Encoding": "identity",
  "Cache-Control": "no-cache",
};

const DEFAULT_MOUNT_EUR = 200;
const MAX_PRODUCT_IMAGES = 4;

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
    .replace(/&apos;/g, "'")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&deg;/g, "°")
    .replace(/&bull;/g, "•")
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&#(\d+);/g, (_, n) => {
      const code = Number(n);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => {
      const code = parseInt(n, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : _;
    })
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

/**
 * "43 / - / 27 / 20 dB (A)" → 20 (quiet / night mode).
 * Bittel order is typically max / nom / quiet / night — prefer the quietest
 * available value; ignore dashes.
 */
function parseNoiseDb(raw: string | undefined): number | null {
  if (!raw) return null;
  const parts = raw
    .replace(/dB.*$/i, "")
    .split("/")
    .map((p) => {
      const t = p.replace(/[^\d.,\-]/g, "").trim();
      if (!t || t === "-" || t === "–") return null;
      return parseNum(t);
    })
    .filter((n): n is number => n != null && n > 0);
  if (!parts.length) return null;
  return Math.min(...parts);
}

/**
 * "286 x 770 x 225 В x Ш x Д (мм)" → {height_mm:286, width_mm:770, depth_mm:225}
 * Also handles "80.3 x 97.8 x 42.1" without labels.
 * Strategy: extract the first three positive numbers in the string.
 */
function parseDimensionsHwd(s: string | undefined): {
  height_mm: number;
  width_mm: number;
  depth_mm: number;
} | null {
  if (!s) return null;
  const nums = [...s.matchAll(/(\d+(?:[.,]\d+)?)/g)]
    .map((m) => parseFloat(m[1]!.replace(",", ".")))
    .filter((n) => n > 0);
  if (nums.length < 3) return null;
  return {
    height_mm: Math.round(nums[0]!),
    width_mm: Math.round(nums[1]!),
    depth_mm: Math.round(nums[2]!),
  };
}

/**
 * Bittel product pages have a spec tab with id="tab-specification".
 * Inside it, <ul class="specification"> contains:
 *   <li class="group-title"><div>GROUP NAME</div></li>   ← section separator
 *   <li><div><strong>LABEL:</strong><p>VALUE</p></div></li>  ← spec row
 * Group names: "Основни характеристики" (general), "Вътрешно тяло" (indoor), "Външно тяло" (outdoor)
 */
export function extractBittelSpecRows(html: string): {
  general: Map<string, string>;
  indoor: Map<string, string>;
  outdoor: Map<string, string>;
} {
  const general = new Map<string, string>();
  const indoor = new Map<string, string>();
  const outdoor = new Map<string, string>();

  // Find the spec tab
  const specTabStart = html.indexOf('id="tab-specification"');
  if (specTabStart < 0) return { general, indoor, outdoor };

  // Stop before the next sibling tab to avoid parsing description/documents/opinions
  let specTabEnd = html.indexOf('id="tab-description"', specTabStart);
  if (specTabEnd < 0) specTabEnd = html.indexOf('id="tab-documents"', specTabStart);
  if (specTabEnd < 0) specTabEnd = html.indexOf('id="opinions"', specTabStart);
  if (specTabEnd < 0) specTabEnd = specTabStart + 30000;

  const specHtml = html.slice(specTabStart, specTabEnd);

  // Walk all <li> items, tracking which group they belong to
  let currentGroup: Map<string, string> = general;
  const liRe = /<li(?:\s[^>]*)?>[\s\S]*?<\/li>/gi;
  let li: RegExpExecArray | null;

  while ((li = liRe.exec(specHtml)) !== null) {
    const liHtml = li[0]!;

    if (/class="group-title"/i.test(liHtml)) {
      const groupText = stripHtmlToText(liHtml).toLowerCase();
      if (/вътрешно\s+тяло/i.test(groupText)) {
        currentGroup = indoor;
      } else if (/външно\s+тяло/i.test(groupText)) {
        currentGroup = outdoor;
      } else {
        currentGroup = general;
      }
      continue;
    }

    // Bittel spec item: <strong>LABEL:</strong> … <p>VALUE</p>
    const strongM = liHtml.match(/<strong>([\s\S]*?)<\/strong>/i);
    const pM = liHtml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (strongM && pM) {
      const label = stripHtmlToText(strongM[1]!).replace(/:$/, "").toLowerCase().trim();
      const value = stripHtmlToText(pM[1]!).trim();
      if (label && value && label.length <= 150 && !currentGroup.has(label)) {
        currentGroup.set(label, value);
      }
    }
  }

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

  // Refrigerant — keep only the gas code (R-32 / R410A / …)
  const refRaw =
    rowValue(general, "хладилен агент") ??
    rowValue(general, "refrigerant") ??
    html.match(/\b(R-?32|R-?410A|R-?290)\b/i)?.[1];
  let refrigerant: string | null = null;
  if (refRaw) {
    const gas = String(refRaw).match(/\b(R-?\d{2,3}[A-Z]?)\b/i)?.[1];
    refrigerant = (gas ?? String(refRaw)).replace(/\s/g, "").toUpperCase().replace(/^R(\d)/, "R-$1");
    // Normalize R32 → R-32, keep R-32 / R410A variants tidy
    if (/^R\d/i.test(refrigerant) && !refrigerant.includes("-")) {
      refrigerant = refrigerant.replace(/^R/i, "R-");
    }
  }

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

/**
 * Extract product image URLs from Bittel gallery.
 * Gallery uses: <a class="c-gallery-image" href="/web/img/[year]/[productId]/[imageId]/0/slug.png">
 * The href is the full-size image (path segment "0" = original size).
 */
export function extractBittelProductImageUrls(html: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];

  const addUrl = (raw: string) => {
    const abs = toAbsoluteBittelUrl(raw);
    if (!abs) return;
    const clean = abs.split("?")[0]!;
    if (!seen.has(clean)) {
      seen.add(clean);
      urls.push(clean);
    }
  };

  // Primary: full-size gallery links  <a class="c-gallery-image" href="...">
  // The href attribute may come before or after class, so try both orderings.
  const re1 = /<a\s[^>]*class="c-gallery-image"[^>]*href="([^"]+)"/gi;
  const re2 = /<a\s[^>]*href="([^"]+)"[^>]*class="c-gallery-image"/gi;
  for (const re of [re1, re2]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && urls.length < MAX_PRODUCT_IMAGES) {
      addUrl(m[1]!);
    }
  }

  // Fallback: og:image meta tag
  if (!urls.length) {
    const ogM = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (ogM?.[1]) addUrl(ogM[1]);
  }

  return urls.slice(0, MAX_PRODUCT_IMAGES);
}

/**
 * Extract description from the Bittel description tab: id="tab-description".
 * Content lives inside <div class="text" itemprop="description">.
 * Structured as <table class="tmp-text-picture"> blocks, each with a
 * .text-part div containing an orange <span> heading and <p> body text.
 */
export function extractBittelDescription(html: string): string | null {
  const descTabIdx = html.indexOf('id="tab-description"');

  if (descTabIdx >= 0) {
    // Limit to 25000 chars of the description tab content
    const descHtml = html.slice(descTabIdx, descTabIdx + 25000);

    // Find the inner text container
    const textDivM = descHtml.match(
      /itemprop="description"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i,
    );
    const contentHtml = textDivM ? textDivM[1]! : descHtml.slice(0, 20000);

    const parts: string[] = [];
    const seen = new Set<string>();

    const addPart = (text: string) => {
      const t = text.trim();
      if (t && t.length > 4 && !seen.has(t)) {
        seen.add(t);
        parts.push(t);
      }
    };

    // Each feature block: <div class="text-part"><span>HEADING</span><p>TEXT</p></div>
    const blockRe = /<div[^>]*class="text-part"[^>]*>([\s\S]*?)<\/div>/gi;
    let block: RegExpExecArray | null;
    while ((block = blockRe.exec(contentHtml)) !== null) {
      const blockHtml = block[1]!;
      // Orange heading in <span style="...color...">
      const spanM = blockHtml.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
      if (spanM) addPart(stripHtmlToText(spanM[1]!));
      // Body paragraphs
      const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      let pm: RegExpExecArray | null;
      while ((pm = pRe.exec(blockHtml)) !== null) {
        addPart(stripHtmlToText(pm[1]!));
      }
    }

    // Fallback: extract all <p> from the content section
    if (!parts.length) {
      const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi;
      let pm: RegExpExecArray | null;
      while ((pm = pRe.exec(contentHtml)) !== null) {
        addPart(stripHtmlToText(pm[1]!));
      }
    }

    if (parts.length) return parts.join("\n\n").slice(0, 5000);
  }

  // Many Bittel ACs have only a specifications tab — use meta description.
  const metaDesc =
    html.match(/property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    html.match(/name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (metaDesc) {
    const t = decodeHtml(metaDesc);
    if (t.length > 20) return t.slice(0, 5000);
  }

  return null;
}

/** Compact spaced model fragments: "SRK 20 ZT-WF" → "SRK20ZT-WF" */
function compactModelToken(raw: string): string {
  return raw.replace(/\s+/g, "").toUpperCase();
}

/** Extract model code from product name.
 * Examples:
 * "Инверторен климатик Daikin Sensira FTXF35F + RXF35F" → "FTXF35F+RXF35F"
 * "Toshiba … RAS-B10P2KVSG-E + RAS-10P2AVSG-E" → "RAS-B10P2KVSG-E+RAS-10P2AVSG-E"
 * "Mitsubishi … SRK 20 ZT-WF + SRC 20 ZT-W" → "SRK20ZT-WF+SRC20ZT-W"
 * "Nippon KFR 12DC ION NORDIC" → "KFR12DC"
 * "Nippon NPC 12F-PRO NORDIC" → "NPC12F-PRO"
 * "Nippon NPC-24T-PRO NORDIC" → "NPC-24T-PRO"
 */
export function extractBittelModelCode(name: string): string | null {
  // MHI spaced kit: "SRK 20 ZT-WF + SRC 20 ZT-W"
  const mhiKit = name.match(
    /\b((?:SRK|SRC|SRR|SRF|SCM)\s+\d{1,3}\s+[A-Z][A-Z0-9-]*)\s*\+\s*((?:SRK|SRC|SRR|SRF|SCM)\s+\d{1,3}\s+[A-Z][A-Z0-9-]*)\b/i,
  );
  if (mhiKit) {
    return `${compactModelToken(mhiKit[1]!)}+${compactModelToken(mhiKit[2]!)}`;
  }

  // Dashed / solid kit: "RAS-B10P2KVSG-E + RAS-10P2AVSG-E" or "FTXF35F + RXF35F"
  const kitMatch = name.match(
    /\b([A-Z]{2,}[A-Z0-9./-]*\d[A-Z0-9./-]*)\s*\+\s*([A-Z]{2,}[A-Z0-9./-]*\d[A-Z0-9./-]*)\b/i,
  );
  if (kitMatch) {
    return `${kitMatch[1]!.toUpperCase()}+${kitMatch[2]!.toUpperCase()}`;
  }

  // Multi-unit system with several "+": "RM3U19.U24 + RMN09.NSJ + …"
  const multiMatch = name.match(
    /\b([A-Z]{2,}[A-Z0-9./-]*\d[A-Z0-9./-]*(?:\s*\+\s*[A-Z]{2,}[A-Z0-9./-]*\d[A-Z0-9./-]*){1,4})\b/i,
  );
  if (multiMatch) return multiMatch[1]!.replace(/\s*\+\s*/g, "+").toUpperCase();

  // Nippon / spaced single: "KFR 12DC", "NPC 12F-PRO", "NPC-24T-PRO"
  const nippon = name.match(/\b((?:KFR|NPC|NTC|NPD)\s*-?\s*\d{1,3}[A-Z0-9-]*)\b/i);
  if (nippon) return compactModelToken(nippon[1]!);

  // MHI single outdoor/indoor: "SRK 35 ZT-WFB"
  const mhiSingle = name.match(/\b((?:SRK|SRC|SRR|SRF|SCM)\s+\d{1,3}\s+[A-Z][A-Z0-9-]*)\b/i);
  if (mhiSingle) return compactModelToken(mhiSingle[1]!);

  // Slash kits without spaces: "ASW-H09B5C4/JOR3DI-C3"
  const slash = name.match(/\b([A-Z]{2,}[A-Z0-9-]{2,})\s*\/\s*([A-Z]{2,}[A-Z0-9-]{2,})\b/i);
  if (slash) return `${slash[1]!.toUpperCase()}/${slash[2]!.toUpperCase()}`;

  // Solid single model: "FTXF35F", "NPC-24T-PRO", "GWH12AGCXB-K6DNA1A"
  const single = name.match(/\b([A-Z]{2,}[-]?[A-Z0-9]*\d[A-Z0-9]*[-\w./]*)\b/);
  if (single?.[1] && single[1]!.length >= 5) return single[1]!.toUpperCase();

  return null;
}

/** Extract brand name from product name using known brand list */
export function extractBittelBrandName(name: string): string {
  // Prefer shared aliases so we don't create duplicate brands
  // ("Mitsubishi Heavy" vs "Mitsubishi Heavy Industries").
  const fromShared = resolveBrandName(name);
  if (fromShared) return fromShared;

  const known = [
    "Daikin",
    "Mitsubishi Electric",
    "Mitsubishi Heavy",
    "LG",
    "Toshiba",
    "Gree",
    "AUX",
    "Nippon",
    "TechPoint",
    "Hitachi",
    "Fujitsu",
    "Samsung",
    "Haier",
    "TCL",
    "Bosch",
    "Panasonic",
  ];
  for (const b of known) {
    if (new RegExp(`\\b${b.replace(/\s+/g, "\\s+")}\\b`, "i").test(name)) return b;
  }
  if (/mitsubishi\s+heavy/i.test(name)) return "Mitsubishi Heavy";
  return "Неизвестна марка";
}

export function parseBittelProductPage(
  html: string,
  sourceUrl: string,
  listingCategoryPath?: string | null,
): BittelParsedProduct | null {
  // Extract name — Bittel often uses <h1 data-meta="…"> without itemprop
  const h1 =
    html.match(/<h1[^>]*itemprop=["']name["'][^>]*>([\s\S]*?)<\/h1>/i) ??
    html.match(/<h1[^>]*data-meta=["']([^"']+)["'][^>]*>/i) ??
    html.match(/<h1[^>]*class=["'][^"']*product[_-]?name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i) ??
    html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const ogTitle = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const nameRaw = h1?.[1] ?? ogTitle?.[1] ?? "";
  const name = decodeHtml(nameRaw.replace(/<[^>]+>/g, ""));
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
  // Best source: structured-data meta tag  <meta itemprop="price" content="1039.99"/>
  // Bittel always sets priceCurrency=EUR, so this is the EUR price.
  const metaM =
    html.match(/<meta\s[^>]*itemprop=["']price["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i);
  if (metaM?.[1]) {
    const n = parseNum(metaM[1]);
    if (n && n > 0) return Math.round(n * 100) / 100;
  }

  // Fallback: split-rendered price "1039.<sup>99</sup> <sub>€</sub>"
  // Combine integer and decimal parts around a <sup> tag
  const splitM = html.match(/(\d{2,5})\.<sup>(\d{2})<\/sup>\s*<sub>€<\/sub>/i);
  if (splitM) {
    const n = parseNum(`${splitM[1]}.${splitM[2]}`);
    if (n && n > 0) return Math.round(n * 100) / 100;
  }

  // Last resort: look for "NNNN.NN €" in the price div only (not installment lines)
  // Installment lines match "12 x NN.NN €" so exclude those
  const priceDiv = html.match(/class=["'][^"']*price[^"']*["'][^>]*>[\s\S]{0,600}/i)?.[0] ?? "";
  const lineRe = /([\d]{3,5}[.,]\d{2})\s*[€]/g;
  let m: RegExpExecArray | null;
  while ((m = lineRe.exec(priceDiv)) !== null) {
    // Skip installment-style context: "12 x NNN"
    const before = priceDiv.slice(Math.max(0, m.index! - 20), m.index!);
    if (/\d\s*x\s*$/i.test(before)) continue;
    const n = parseNum(m[1]);
    if (n && n >= 50) return Math.round(n * 100) / 100;
  }

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
  if (/колон/i.test(hay)) {
    return { categorySlug: "column", typeHint: "Колонен" };
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

/**
 * Extract feature labels from the description tab (.text-part span headings).
 * These are the short orange feature titles like "Висока ефективност", "Wi-Fi управление", etc.
 */
function extractBittelFeatureLabels(html: string, _description: string | null): string[] {
  const labels: string[] = [];
  const seen = new Set<string>();

  const descTabIdx = html.indexOf('id="tab-description"');
  if (descTabIdx < 0) return labels;

  const descHtml = html.slice(descTabIdx, descTabIdx + 25000);

  // Feature headings are inside <div class="text-part"> as <span style="..."> text
  const blockRe = /<div[^>]*class="text-part"[^>]*>([\s\S]*?)<\/div>/gi;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(descHtml)) !== null) {
    const spanM = block[1]!.match(/<span[^>]*>([\s\S]*?)<\/span>/i);
    if (spanM) {
      const t = stripHtmlToText(spanM[1]!);
      if (t.length >= 4 && t.length <= 120) {
        const key = t.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          labels.push(t);
        }
      }
    }
  }

  return labels;
}

