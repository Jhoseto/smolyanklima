import { inferBtuFromCoolingKw } from "@/lib/catalog/productBtu";
import { parseEnergyClassFromText } from "../parseEnergyClass";
import { extractModelCode } from "../brandFromTitle";

export const CONDEX_BRAND_NAME = "Mitsubishi Heavy Industries";

export type CondexParsedProduct = {
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
};

const DEFAULT_MOUNT_EUR = 200;
const IMAGE_EXT = /\.(jpg|jpeg|png|webp|avif)(\?|$)/i;
const MAX_PRODUCT_IMAGES = 16;
const SPECS_APPENDIX_MARKER = "Технически данни (Condex):";

export async function fetchCondexHtml(url: string): Promise<string> {
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
    .replace(/&#8216;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#038;/g, "&")
    .replace(/&#(\d+);/g, (_, code) => {
      const n = Number(code);
      return Number.isFinite(n) ? String.fromCharCode(n) : _;
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

/** SRK / SRC 25 ZSP-W → SRK25ZSP-W; FDTC25VH1 / SRC25ZS-W1* → FDTC25VH1 */
export function extractCondexModelCode(name: string): string | null {
  const dualWall = name.match(/\b([A-Z]{2,})\s*\/\s*([A-Z]{2,})\s+(\d+(?:[.,]\d+)?)\s+([\w*-]+)/i);
  if (dualWall) {
    const num = dualWall[3]!.replace(/[.,]/g, "");
    return `${dualWall[1]!.toUpperCase()}${num}${dualWall[4]!.replace(/\*/g, "").toUpperCase()}`;
  }
  const kit = name.match(/\b(FDTC\d+[A-Z0-9]*)\s*\/\s*(SRC[\w*-]+)/i);
  if (kit) return `${kit[1]!.toUpperCase()}/${kit[2]!.replace(/\*/g, "").toUpperCase()}`;
  const fdfKit = name.match(/\b(FDF[\w*-]+)\s*\/\s*(FDC[\w*-]+)/i);
  if (fdfKit) return `${fdfKit[1]!.replace(/\s+/g, "").toUpperCase()}/${fdfKit[2]!.replace(/\s+/g, "").replace(/\*/g, "").toUpperCase()}`;
  const compact = name.match(/\b(FDTC|FDF|FDC|SRK|SRC|SRR|SRF|SCM)([A-Z0-9][\w*-]*)/i);
  if (compact) return `${compact[1]!.toUpperCase()}${compact[2]!.replace(/\*/g, "").toUpperCase()}`;
  return extractModelCode(name);
}

function stripHtmlToText(fragment: string): string {
  return decodeHtml(fragment.replace(/<[^>]+>/g, " "));
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(/\s/g, "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function firstNumberInText(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return m ? parseNum(m[1]) : null;
}

/** Condex often lists kW columns as watts (e.g. 3000 → 3.0 kW). */
function parseCondexCapacityKw(raw: string | undefined): number | null {
  const n = firstNumberInText(raw);
  if (n == null) return null;
  if (n >= 100) return Math.round((n / 1000) * 100) / 100;
  return n;
}

/** „2,5 (0,9 – 3,2)“ → 2.5 kW (номинал преди скоби). */
function parseCondexNominalKw(raw: string | undefined): number | null {
  if (!raw) return null;
  const head = raw.split("(")[0]!.trim();
  return parseCondexCapacityKw(head);
}

function parseCondexNoiseDb(raw: string | undefined): number | null {
  if (!raw) return null;
  const parts = raw
    .split(/\s*[/\-–]\s*/)
    .map((p) => parseNum(p.replace(/[^\d.,]/g, "")))
    .filter((n): n is number => n != null);
  if (!parts.length) return null;
  return Math.min(...parts);
}

function parseCondexWarrantyMonths(html: string): number | null {
  const scope =
    html.match(/id=["']tab-general-details["'][\s\S]{0,12000}/i)?.[0] ??
    html.match(/single-product[\s\S]{0,120000}/i)?.[0] ??
    html.slice(0, 120000);
  const years = scope.match(/гаранц[\s\S]{0,200}?(\d+)\s*(?:години|година|г\.)/i);
  if (years?.[1]) {
    const n = Number(years[1]);
    return Number.isFinite(n) ? n * 12 : null;
  }
  const enYears = scope.match(/warranty[\s\S]{0,200}?(\d+)\s*(?:years?|yr)/i);
  if (enYears?.[1]) {
    const n = Number(enYears[1]);
    return Number.isFinite(n) ? n * 12 : null;
  }
  const months = scope.match(/гаранц[\s\S]{0,200}?(\d+)\s*месеца/i);
  if (months?.[1]) {
    const n = Number(months[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isCondexOutdoorOnlyProduct(name: string, description: string | null): boolean {
  const hay = `${name} ${description ?? ""}`;
  return (
    /\bвъншно\s+тяло\b|\bвъншен\s+агрегат\b|\boutdoor\s+unit\b/i.test(hay) &&
    !/\bвътрешн/i.test(hay) &&
    !/\bинверторен\s+климатик\b|\bsplit\s+система\b/i.test(hay)
  );
}

export function parseCondexEuroPrice(html: string): number | null {
  const candidates: string[] = [];
  const priceBlock = html.match(/class=["'][^"']*product_price[^"']*["'][\s\S]{0,400}/i)?.[0];
  if (priceBlock) candidates.push(priceBlock);
  const h1Area = html.match(/<h1[^>]*>[\s\S]{0,1200}/i)?.[0];
  if (h1Area) candidates.push(h1Area);

  for (const block of candidates) {
    const m = block.match(/€\s*([\d\s]+(?:[.,]\d{1,2})?)/);
    if (m?.[1]) {
      const n = parseNum(m[1]);
      if (n != null && n > 0) return Math.round(n * 100) / 100;
    }
  }

  const meta = html.match(/itemprop=["']price["'][^>]*content=["']€\s*([\d\s]+(?:[.,]\d{1,2})?)/i);
  if (meta?.[1]) {
    const n = parseNum(meta[1]);
    if (n != null && n > 0) return Math.round(n * 100) / 100;
  }

  const any = html.match(/€\s*([\d\s]+(?:[.,]\d{1,2})?)/);
  if (any?.[1]) {
    const n = parseNum(any[1]);
    if (n != null && n > 0) return Math.round(n * 100) / 100;
  }
  return null;
}

function parseDimensionsHlw(s: string | undefined): {
  dim_height_mm: number;
  dim_length_mm: number;
  dim_width_mm: number;
} | null {
  if (!s) return null;
  const cleaned = s.replace(/\(\+\d+\)/g, "").trim();
  const parts = cleaned.split(/[×x]/).map((p) => parseInt(p.replace(/\D/g, ""), 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [h, l, w] = parts;
  return { dim_height_mm: h!, dim_length_mm: l!, dim_width_mm: w! };
}

const SPEC_TABLE_HINT =
  /capacity|капацитет|мощност|seer|scop|шум|noise|размери|dimension|тегло|weight|хладилен|refrigerant|енергиен|energy|eer|cop|wi-?fi/i;

function parseSlashPair(s: string | undefined): { a: number | null; b: number | null } {
  if (!s) return { a: null, b: null };
  const parts = s.split("/").map((p) => parseNum(p.trim()));
  return { a: parts[0] ?? null, b: parts[1] ?? null };
}

function extractCondexSpecRows(html: string): Map<string, string> {
  const rows = new Map<string, string>();
  const tab1 =
    html.match(/id=["']tab-1["'][\s\S]*?(?=id=["']tab-2["']|id=["']tab-attached|$)/i)?.[0] ?? "";
  const scanBlocks = [
    tab1,
    html.match(/Characteristics[\s\S]{0,20000}/i)?.[0] ?? "",
    html.match(/single-product[\s\S]{0,80000}/i)?.[0] ?? "",
  ].filter(Boolean);

  const seenTables = new Set<string>();
  for (const block of scanBlocks) {
    for (const table of block.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
      if (!SPEC_TABLE_HINT.test(table) || seenTables.has(table)) continue;
      seenTables.add(table);

      const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let tr: RegExpExecArray | null;
      while ((tr = trRe.exec(table)) !== null) {
        const cells: string[] = [];
        const tdRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        let td: RegExpExecArray | null;
        while ((td = tdRe.exec(tr[1])) !== null) {
          const t = stripHtmlToText(td[1]);
          if (t) cells.push(t);
        }
        if (cells.length < 2) continue;
        const label = cells[0]!.toLowerCase();
        const value = cells[cells.length - 1]!.trim();
        if (!label || !value || label.length > 120) continue;
        rows.set(label, value);
      }
    }
    if (rows.size >= 4) break;
  }
  return rows;
}

function rowValue(rows: Map<string, string>, ...fragments: string[]): string | undefined {
  for (const [label, value] of rows) {
    if (fragments.every((f) => label.includes(f))) return value;
  }
  return undefined;
}

export function extractCondexProductSpecs(
  html: string,
  context?: { name?: string; description?: string | null },
): CondexParsedProduct["specs"] {
  const rows = extractCondexSpecRows(html);
  const outdoorOnly = isCondexOutdoorOnlyProduct(context?.name ?? "", context?.description ?? null);

  const coolRaw =
    rowValue(rows, "охладителен", "капацитет") ??
    rowValue(rows, "охладителна", "мощност") ??
    rowValue(rows, "охладител", "мощ") ??
    rowValue(rows, "cooling capacity") ??
    rowValue(rows, "охлаждане", "капацитет") ??
    rowValue(rows, "cooling", "capacity");
  const heatRaw =
    rowValue(rows, "отоплителен", "капацитет") ??
    rowValue(rows, "отоплителна", "мощност") ??
    rowValue(rows, "отоплител", "мощ") ??
    rowValue(rows, "heating capacity") ??
    rowValue(rows, "отопление", "капацитет") ??
    rowValue(rows, "heating", "capacity");

  const coolKw = parseCondexNominalKw(coolRaw);
  const heatKw = parseCondexNominalKw(heatRaw);

  const eerCop = parseSlashPair(rowValue(rows, "eer", "cop"));
  const seerScop = parseSlashPair(rowValue(rows, "seer", "scop"));

  const energyRaw =
    rowValue(rows, "енергиен клас") ??
    rowValue(rows, "energy class") ??
    rowValue(rows, "energy", "class");
  let energyCool: string | null = null;
  let energyHeat: string | null = null;
  if (energyRaw) {
    const parts = energyRaw.split("/").map((p) => parseEnergyClassFromText(p.trim()));
    energyCool = parts[0] ?? parseEnergyClassFromText(energyRaw);
    energyHeat = parts[1] ?? null;
  }
  energyCool =
    energyCool ??
    parseEnergyClassFromText(rowValue(rows, "енергиен", "охлажд") ?? rowValue(rows, "energy", "cooling") ?? "") ??
    null;
  energyHeat =
    energyHeat ??
    parseEnergyClassFromText(rowValue(rows, "енергиен", "отопл") ?? rowValue(rows, "energy", "heating") ?? "") ??
    null;

  const noiseCool =
    rowValue(rows, "шум", "охлаждане") ??
    rowValue(rows, "cooling noise") ??
    rowValue(rows, "noise level", "cooling") ??
    rowValue(rows, "ниво на шум", "охлаждане");
  const noiseHeat =
    rowValue(rows, "шум", "отопление") ??
    rowValue(rows, "heating noise") ??
    rowValue(rows, "noise level", "heating") ??
    rowValue(rows, "ниво на шум", "отопление");

  const dimIn =
    rowValue(rows, "размери вътрешно") ??
    rowValue(rows, "internal dimensions") ??
    rowValue(rows, "indoor", "dimension") ??
    rowValue(rows, "размери", "вътреш");
  const dimOut =
    rowValue(rows, "размери външно") ??
    rowValue(rows, "external dimensions") ??
    rowValue(rows, "outdoor", "dimension") ??
    rowValue(rows, "размери", "външ");

  const indoorDim = parseDimensionsHlw(dimIn);
  const outdoorDim = parseDimensionsHlw(dimOut);

  const weightInRaw =
    rowValue(rows, "тегло", "вътреш") ??
    rowValue(rows, "weight", "internal") ??
    rowValue(rows, "weight", "indoor");
  const weightOutRaw =
    rowValue(rows, "тегло", "външ") ??
    rowValue(rows, "weight", "external") ??
    rowValue(rows, "weight", "outdoor");
  const weightCombined = rowValue(rows, "тегло") ?? rowValue(rows, "weight");
  let weight_indoor_kg = firstNumberInText(weightInRaw);
  let weight_outdoor_kg = firstNumberInText(weightOutRaw);
  if (weightCombined && (weight_indoor_kg == null || weight_outdoor_kg == null)) {
    const slash = weightCombined.match(/([\d.,]+)\s*\/\s*([\d.,]+)/);
    if (slash) {
      weight_indoor_kg = weight_indoor_kg ?? parseNum(slash[1]);
      weight_outdoor_kg = weight_outdoor_kg ?? parseNum(slash[2]);
    } else {
      const single = parseNum(weightCombined.replace(/[^\d.,]/g, ""));
      if (/външ|outdoor/i.test(weightCombined)) weight_outdoor_kg = weight_outdoor_kg ?? single;
      else weight_indoor_kg = weight_indoor_kg ?? single;
    }
  }

  const coverageRaw =
    rowValue(rows, "площ", "помещение") ??
    rowValue(rows, "coverage") ??
    rowValue(rows, "площ");
  const coverageParsed = firstNumberInText(coverageRaw);

  const refrigerant =
    rowValue(rows, "хладилен", "агент") ??
    rowValue(rows, "refrigerant") ??
    html.match(/\b(R32|R410A|R290)\b/i)?.[1]?.toUpperCase() ??
    null;

  const generalText = stripHtmlToText(html.match(/id=["']tab-general-details["'][\s\S]{0,8000}/i)?.[0] ?? "");
  const wifiRow = rowValue(rows, "wi-fi") ?? rowValue(rows, "wifi") ?? rowValue(rows, "безжич");
  let wifi: boolean | null = null;
  if (wifiRow) {
    wifi = !/^(не|no|без|without|false|0)\b/i.test(wifiRow.trim());
  } else if (
    /вграден\s+wi-?fi|built-?in\s+wi-?fi|wi-?fi\s+включен|wi-?fi\s+ready|с\s+wi-?fi/i.test(generalText)
  ) {
    wifi = true;
  } else if (/без\s+wi-?fi|no\s+wi-?fi|without\s+wi-?fi/i.test(generalText)) {
    wifi = false;
  }

  const noiseIn = parseCondexNoiseDb(noiseCool);
  const noiseOut = parseCondexNoiseDb(noiseHeat);
  const noise_db = outdoorOnly
    ? (noiseOut ?? noiseIn)
    : (noiseIn ?? noiseOut);

  return {
    btu: inferBtuFromCoolingKw(coolKw),
    coverage_m2:
      coverageParsed != null && coverageParsed > 0
        ? Math.round(coverageParsed)
        : coolKw != null && coolKw > 0
          ? Math.round(coolKw * 10)
          : null,
    noise_db,
    cooling_power_kw: coolKw,
    heating_power_kw: heatKw,
    refrigerant,
    wifi,
    energy_class_cool: energyCool,
    energy_class_heat: energyHeat,
    seer: seerScop.a ?? eerCop.a,
    scop: seerScop.b ?? eerCop.b,
    warranty_months: parseCondexWarrantyMonths(html),
    weight_indoor_kg,
    weight_outdoor_kg,
    dim_indoor_length_mm: indoorDim?.dim_length_mm ?? null,
    dim_indoor_width_mm: indoorDim?.dim_width_mm ?? null,
    dim_indoor_height_mm: indoorDim?.dim_height_mm ?? null,
    dim_outdoor_length_mm: outdoorDim?.dim_length_mm ?? null,
    dim_outdoor_width_mm: outdoorDim?.dim_width_mm ?? null,
    dim_outdoor_height_mm: outdoorDim?.dim_height_mm ?? null,
  };
}

function toAbsoluteCondexUrl(src: string): string {
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith("data:")) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http")) return trimmed;
  if (trimmed.startsWith("/")) return `https://condex.bg${trimmed}`;
  return "";
}

function isProductImageUrl(url: string): boolean {
  const u = url.toLowerCase();
  if (!IMAGE_EXT.test(u)) return false;
  if (/logo|icon|flag|iso_9001|payment|sprite|avatar/i.test(u)) return false;
  return u.includes("condex.bg") && (u.includes("wp-content") || u.includes("/uploads/"));
}

export function extractCondexProductImageUrls(html: string): string[] {
  const urls: string[] = [];
  const push = (raw: string) => {
    const abs = toAbsoluteCondexUrl(raw);
    if (abs && isProductImageUrl(abs) && !urls.includes(abs)) urls.push(abs);
  };

  const og = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (og?.[1]) push(og[1]);

  const galleryBlocks = [
    html.match(/class=["'][^"']*product_images[^"']*["'][\s\S]{0,40000}/i)?.[0],
    html.match(/woocommerce-product-gallery[\s\S]{0,40000}/i)?.[0],
    html.match(/single-product[\s\S]{0,60000}/i)?.[0],
  ].filter(Boolean) as string[];

  const srcRe = /\b(?:src|data-src|data-large_image|href)=["']([^"']+)["']/gi;
  for (const gallery of galleryBlocks.length ? galleryBlocks : [html.slice(0, 100000)]) {
    let m: RegExpExecArray | null;
    while ((m = srcRe.exec(gallery)) !== null) {
      push(m[1]!);
      if (urls.length >= MAX_PRODUCT_IMAGES) break;
    }
    if (urls.length >= MAX_PRODUCT_IMAGES) break;
  }

  return urls.slice(0, MAX_PRODUCT_IMAGES);
}

function formatCondexSpecsAppendix(rows: Map<string, string>): string {
  if (rows.size === 0) return "";
  const lines: string[] = [`\n\n---\n${SPECS_APPENDIX_MARKER}\n`];
  for (const [label, value] of rows) {
    if (label && value) lines.push(`${label}: ${value}`);
  }
  return lines.join("\n");
}

function mergeDescriptionWithSpecsAppendix(description: string | null, appendix: string): string | null {
  if (!appendix.trim()) return description?.trim() || null;
  const base = (description ?? "").trim();
  const markerIdx = base.indexOf(SPECS_APPENDIX_MARKER);
  if (markerIdx >= 0) {
    return `${base.slice(0, markerIdx).trimEnd()}${appendix}`;
  }
  return base ? `${base}${appendix}` : appendix.trim();
}

export function extractCondexCategoryPaths(html: string): string[] {
  const block = html.match(/class=["']posted_in["'][\s\S]*?<\/span>/i)?.[0];
  if (!block) return [];
  const paths: string[] = [];
  const re = /href=["'](https:\/\/condex\.bg\/products\/[^"'#?]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    try {
      paths.push(new URL(m[1]!).pathname);
    } catch {
      /* skip */
    }
  }
  return paths;
}

export function categorySlugFromCondexPath(path: string): string | null {
  const p = path.toLowerCase();
  if (p.includes("multi-split") || p.includes("vatreshni-tela") || p.includes("vanshni-tela")) return "multi";
  if (p.includes("kolonni") || p.includes("fdf")) return "column";
  if (p.includes("srf") || p.includes("podov")) return "floor";
  if (p.includes("fdtc") || p.includes("kaset")) return "cassette";
  if (p.includes("srr") || p.includes("kanalen") || p.includes("slim")) return "ceiling";
  if (
    p.includes("srk") ||
    p.includes("zsp") ||
    p.includes("ztl") ||
    p.includes("premium") ||
    p.includes("diamond") ||
    p.includes("smart-plus") ||
    p.includes("standart") ||
    p.includes("za-doma-i-ofisa")
  ) {
    return "wall";
  }
  return null;
}

const KLIMA_CATEGORY_PRIORITY = ["floor", "column", "cassette", "ceiling", "multi", "wall"] as const;

function pickCategorySlug(slugs: Iterable<string | null>): string | null {
  const found = new Set<string>();
  for (const slug of slugs) {
    if (slug) found.add(slug);
  }
  for (const slug of KLIMA_CATEGORY_PRIORITY) {
    if (found.has(slug)) return slug;
  }
  return null;
}

function typeHintFromCategorySlug(slug: string | null): string | null {
  if (slug === "floor") return "Подов";
  if (slug === "column") return "Колонен";
  if (slug === "cassette") return "Касетъчен";
  if (slug === "ceiling") return "Таван";
  if (slug === "multi") return "Мулти";
  if (slug === "wall") return "Стенен";
  return null;
}

function typeHintFromProductText(name: string, description: string | null): string | null {
  const hay = `${name} ${description ?? ""}`;
  if (/мульти|multisplit|мултисплит|multi[\s-]*split/i.test(hay)) return "Мулти";
  if (/\bfdf\b|\bfdf\s+\d/i.test(hay) || /колон/i.test(hay)) return "Колонен";
  if (/\bfdtc\b|касет/i.test(hay)) return "Касетъчен";
  if (/\bsrr\b|канален|каналн/i.test(hay)) return "Таван";
  if (/\bsrf\b|подов/i.test(hay)) return "Подов";
  if (/стенен|стенни|инверторен климатик/i.test(hay)) return "Стенен";
  return null;
}

export function resolveCondexProductClassification(
  html: string,
  sourceUrl: string,
  name: string,
  description: string | null,
  listingCategoryPath?: string | null,
): { categorySlug: string | null; typeHint: string } {
  const pathCandidates = [
    ...extractCondexCategoryPaths(html),
    listingCategoryPath,
    (() => {
      try {
        return new URL(sourceUrl).pathname;
      } catch {
        return sourceUrl;
      }
    })(),
  ].filter((p): p is string => Boolean(p?.trim()));

  let categorySlug = pickCategorySlug(pathCandidates.map((path) => categorySlugFromCondexPath(path)));

  const typeHint =
    typeHintFromProductText(name, description) ??
    typeHintFromCategorySlug(categorySlug) ??
    "Стенен";

  if (!categorySlug) {
    if (typeHint === "Подов") categorySlug = "floor";
    else if (typeHint === "Колонен") categorySlug = "column";
    else if (typeHint === "Касетъчен") categorySlug = "cassette";
    else if (typeHint === "Таван") categorySlug = "ceiling";
    else if (typeHint === "Мулти") categorySlug = "multi";
    else categorySlug = "wall";
  }

  return { categorySlug, typeHint };
}

export function parseCondexProductPage(
  html: string,
  sourceUrl: string,
  listingCategoryPath?: string | null,
): CondexParsedProduct | null {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const ogTitle = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const name = decodeHtml((h1?.[1] ?? ogTitle?.[1] ?? "").replace(/<[^>]+>/g, ""));
  if (!name || name.length < 3) return null;

  const priceEur = parseCondexEuroPrice(html);
  if (priceEur == null) return null;

  const modelCode = extractCondexModelCode(name);

  let description: string | null = null;
  const generalSlice =
    html.match(
      /id=["']tab-general-details["'][\s\S]*?(?=<div[^>]+class=["'][^"']*tab_content_wrapper[^"']*["'][^>]+id=["']tab-1["'])/i,
    )?.[0] ??
    html.match(/id=["']tab-general-details["'][\s\S]{0,6000}/i)?.[0] ??
    html.match(/General Details[\s\S]{0,6000}/i)?.[0];
  const generalInner = generalSlice?.match(/<div class=["']wpb_wrapper["']>([\s\S]*?)<\/div>/i)?.[1];
  if (generalInner) {
    description = stripHtmlToText(generalInner).slice(0, 4000);
  } else if (generalSlice) {
    const h2 = generalSlice.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1];
    const bullets = [...generalSlice.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
      .map((m) => stripHtmlToText(m[1]))
      .filter((t) => t.length >= 8);
    description = [h2 ? stripHtmlToText(h2) : "", bullets.join(" ")].filter(Boolean).join(". ").slice(0, 4000);
  }
  const generalBlock = generalSlice;
  const tableRows = extractCondexSpecRows(html);
  const specs = extractCondexProductSpecs(html, { name, description });
  description = mergeDescriptionWithSpecsAppendix(
    description,
    formatCondexSpecsAppendix(tableRows),
  );

  if (/не включва панел|does not include panel|panel.*mandatory|задължителн/i.test(html)) {
    const note =
      "Забележка: цената на сайта на Кондекс може да не включва панел и/или дистанционно (вижте описанието на продукта).";
    description = description ? `${description}\n\n${note}` : note;
  }

  const featureLabels: string[] = [];
  const seenFeatures = new Set<string>();
  if (generalBlock) {
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let li: RegExpExecArray | null;
    while ((li = liRe.exec(generalBlock)) !== null) {
      const t = stripHtmlToText(li[1]!);
      if (t.length < 8 || t.length > 200) continue;
      const key = t.toLowerCase();
      if (seenFeatures.has(key)) continue;
      seenFeatures.add(key);
      featureLabels.push(t);
    }
  }

  const imageUrls = extractCondexProductImageUrls(html);
  const { categorySlug, typeHint } = resolveCondexProductClassification(
    html,
    sourceUrl,
    name,
    description,
    listingCategoryPath,
  );

  return {
    sourceUrl,
    name,
    modelCode,
    brandName: CONDEX_BRAND_NAME,
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
