import { inferBtuFromCoolingKw } from "@/lib/catalog/productBtu";
import { parseEnergyClassFromText } from "../parseEnergyClass";
import { extractModelCode, resolveBrandName } from "../brandFromTitle";

export type BulclimaParsedProduct = {
  sourceUrl: string;
  name: string;
  modelCode: string | null;
  brandName: string | null;
  priceEur: number;
  priceWithMountEur: number | null;
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
  "Accept-Language": "bg,en;q=0.9",
};

export async function fetchBulclimaHtml(url: string): Promise<string> {
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
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseEuroPrice(html: string): number | null {
  const m = html.match(/(\d{1,5}(?:[.,]\d{2})?)\s*€/);
  if (!m?.[1]) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

function parseMountAddon(html: string): number {
  const m = html.match(/Стандартен монтаж\s*\(\+\s*(\d+(?:[.,]\d+)?)\s*€\)/i);
  if (!m?.[1]) return 200;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : 200;
}

function parseNum(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

/**
 * Нормализира хомоглифни символи (Cyrillic А/В/Е/…, Dze Ѕ, Kra ĸ) към ASCII латиница.
 * Ползва се като fallback при търсене в таблични редове — напр. Williams пишат „ЅЕЕR/ЅСОР"
 * с Cyrillic lookalike chars вместо ASCII S/C/O/P.
 */
function toLatinAscii(s: string): string {
  return s
    .replace(/[Ѕѕ]/g, (c) => (c === "Ѕ" ? "S" : "s"))
    .replace(/ĸ/g, "k")
    .replace(/[АВЕКМНОРСТХ]/g, (c) =>
      ({ А: "A", В: "B", Е: "E", К: "K", М: "M", Н: "H", О: "O", Р: "P", С: "C", Т: "T", Х: "X" }[c] ?? c),
    )
    .replace(/[аеоксрхту]/g, (c) => ({ а: "a", е: "e", о: "o", к: "k", с: "c", р: "p", х: "x", т: "t", у: "y" }[c] ?? c))
    .toLowerCase();
}

/** Bulclima таблица: Височина × Дължина × Ширина (mm). */
function parseBulclimaDimensionsHlw(s: string | undefined): {
  dim_length_mm: number;
  dim_width_mm: number;
  dim_height_mm: number;
} | null {
  if (!s) return null;
  // Cassette units combine body + panel in one cell: "246x840x840 / 53x950x950" — take body only.
  const clean = s.split(/\s*\/\s*/)[0]!.trim();
  const parts = clean.split(/[×x]/).map((p) => parseInt(p.replace(/\D/g, ""), 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [h, l, w] = parts;
  return { dim_height_mm: h!, dim_length_mm: l!, dim_width_mm: w! };
}

/** Алтернативен формат ШхВхД (Ширина × Височина × Дълбочина) — Williams и др. */
function parseBulclimaDimensionsShvd(s: string | undefined): {
  dim_length_mm: number;
  dim_width_mm: number;
  dim_height_mm: number;
} | null {
  if (!s) return null;
  // Strip panel suffix if present (e.g. "246x840x840 / 53x950x950").
  const clean = s.split(/\s*\/\s*/)[0]!.trim();
  const parts = clean.split(/[×x]/).map((p) => parseInt(p.replace(/\D/g, ""), 10));
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [w, h, d] = parts;
  return { dim_width_mm: w!, dim_height_mm: h!, dim_length_mm: d! };
}

/** Избира правилния parser за размери според формата в заглавието на реда.
 *  "ШхВхД" (Ширина × Височина × Дълбочина) → ШВД парсер.
 *  Всичко друго → стандартен ВхДхШ парсер.
 */
function parseDimensions(
  s: string | undefined,
  labelHint: string,
): ReturnType<typeof parseBulclimaDimensionsHlw> {
  if (!s) return null;
  // Match explicitly "Ш×В×Д" or "ШхВхД" (В may be Latin B from Williams mixed encoding)
  if (/ш\s*[хx×]\s*[вb]\s*[хx×]\s*д/i.test(labelHint)) return parseBulclimaDimensionsShvd(s);
  return parseBulclimaDimensionsHlw(s);
}

function firstNumberInText(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.replace(",", ".").match(/(\d+(?:\.\d+)?)/);
  return m ? parseNum(m[1]) : null;
}

/**
 * Парсва мощност охлаждане/отопление.
 * Обработва: разделни колони (4-кол. таблица), единична колона с „X/Y" (3-кол.)
 * и единична колона само с едната стойност.
 */
function parsePowerPair(
  cool: string | undefined,
  heat: string | undefined,
): { cool: number | null; heat: number | null } {
  if (heat !== undefined) {
    return { cool: firstNumberInText(cool), heat: firstNumberInText(heat) };
  }
  if (!cool) return { cool: null, heat: null };
  const slash = cool.match(/([\d.,]+(?:\s*\([\d.,\s\-–]+\))?)\s*[/]\s*([\d.,]+)/);
  if (slash) {
    return {
      cool: parseNum(slash[1]!.split("(")[0]!.trim().replace(",", ".")),
      heat: parseNum(slash[2]!.replace(",", ".")),
    };
  }
  return { cool: firstNumberInText(cool), heat: null };
}

function parseNoiseIndoorDb(s: string | undefined): number | null {
  if (!s) return null;
  const parts = s
    .split(/\s*[/\-–]\s*/)
    .map((p) => parseNum(p.replace(/[^\d.,]/g, "")))
    .filter((n): n is number => n != null);
  if (!parts.length) return null;
  return Math.min(...parts);
}

function parseSeerScopCell(s: string | undefined): { value: number | null; energyClass: string | null } {
  if (!s || /^-+$/.test(s.trim())) return { value: null, energyClass: null };
  return { value: firstNumberInText(s), energyClass: parseEnergyClassFromText(s) };
}

type BulclimaTableRow = { unit?: string; cool?: string; heat?: string; label?: string };

function stripHtmlToText(fragment: string): string {
  return decodeHtml(fragment.replace(/<[^>]+>/g, " "));
}

/**
 * Hint за технически таблици — matchва на raw или toLatinAscii(raw) HTML.
 * Достатъчно е едно съвпадение за да се сканира таблицата.
 */
const SPEC_TABLE_HINT =
  /мощност|мощн|capacity|seer|scop|eer|cop|шум|noise|размери|dimension|тегло|weight|хладилен|refrigerant|енергиен|energy|клас|class|ток|current|дебит|flow|\bkW\b|\bdB\b|BTU|ВТU|R32|R410A|R290|\bmm\b/i;

function isSpecTable(tableHtml: string): boolean {
  if (SPEC_TABLE_HINT.test(tableHtml)) return true;
  const norm = toLatinAscii(tableHtml.slice(0, 2000));
  return SPEC_TABLE_HINT.test(norm);
}

function extractTechnicalSpecsTable(html: string): Map<string, BulclimaTableRow> {
  const rows = new Map<string, BulclimaTableRow>();
  const tab2Block =
    html.match(/id=["']tab-2["'][\s\S]*?(?=id=["']tab-3["']|id=["']tab-4["']|$)/i)?.[0] ??
    html.match(/technical-characteristics[\s\S]{0,60000}/i)?.[0];
  const singleProductBlock = html.match(/single-product[\s\S]{0,150000}/i)?.[0] ?? "";
  const scanBlocks = [tab2Block ?? "", singleProductBlock].filter(Boolean);
  const seenTables = new Set<string>();

  const parseTable = (table: string) => {
    if (!isSpecTable(table) || seenTables.has(table)) return;
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
      const rawLabel = cells[0]!;
      const label = rawLabel.toLowerCase();
      const row: BulclimaTableRow =
        cells.length >= 4
          ? { unit: cells[1], cool: cells[2], heat: cells[3], label: rawLabel }
          : cells.length === 3
            ? { unit: cells[1], cool: cells[2], label: rawLabel }
            : { cool: cells[1], label: rawLabel };
      if (!rows.has(label)) rows.set(label, row);
    }
  };

  for (const block of scanBlocks) {
    for (const table of block.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
      parseTable(table);
    }
  }

  // Fallback: scan full HTML when nothing found in known sections
  if (rows.size === 0) {
    for (const table of html.match(/<table[\s\S]*?<\/table>/gi) ?? []) {
      parseTable(table);
      if (rows.size >= 8) break;
    }
  }

  return rows;
}

/**
 * Търси ред по ключови думи.
 * При неуспех опитва с ASCII-нормализиран label (справя се с Williams хомоглифни chars).
 */
function tableRow(rows: Map<string, BulclimaTableRow>, ...fragments: string[]): BulclimaTableRow | undefined {
  for (const [label, row] of rows) {
    if (fragments.every((f) => label.includes(f))) return row;
  }
  for (const [label, row] of rows) {
    const norm = toLatinAscii(label);
    if (fragments.every((f) => norm.includes(toLatinAscii(f)))) return row;
  }
  return undefined;
}

function tableRowFirst(rows: Map<string, BulclimaTableRow>, ...alternates: string[][]): BulclimaTableRow | undefined {
  for (const frags of alternates) {
    const r = tableRow(rows, ...frags);
    if (r) return r;
  }
  return undefined;
}

/**
 * WiFi — само ако изрично е вграден в продукта.
 * "чрез WiFi адаптер" / "по желание" → false (опционален аксесоар).
 * Без ясни данни → null.
 */
function detectBulclimaWifi(
  featureLabels: string[],
  listBlockHtml: string,
  descTabHtml: string,
): boolean | null {
  const BUILT_IN =
    /вграден\s+wi-?fi|built.?in\s+wi-?fi|wi-?fi\s+(?:вграден|включен|ready|chip)|airstage\s+(?:app|apл)|melcloud/i;
  const OPTIONAL =
    /чрез\s+wi-?fi\s+адаптер|wi-?fi\s+адаптер|wi-?fi\s+модул\s*(?:[а-яa-z]*\s*)?(?:по\s+желание|опционален|отделно)|опционален.*wi-?fi/i;

  for (const src of [featureLabels.join(" "), listBlockHtml, descTabHtml]) {
    if (BUILT_IN.test(src)) return true;
    if (OPTIONAL.test(src)) return false;
  }
  return null;
}

function readAttributeIconValue(html: string, title: string): string | null {
  const re = new RegExp(
    `attribute-title[^>]*>\\s*${title}\\s*<[^>]+>[\\s\\S]{0,120}?attribute-value[^>]*>\\s*([^<]+)`,
    "i",
  );
  const m = re.exec(html);
  return m?.[1] ? decodeHtml(m[1].trim()) : null;
}

function extractListCharacteristics(html: string): {
  seer?: number;
  scop?: number;
  energyCool?: string;
  energyHeat?: string;
  noiseDb?: number;
  refrigerant?: string;
} {
  const block = html.match(/single-product-list-characteristics[\s\S]{0,4000}/i)?.[0] ?? "";
  const text = stripHtmlToText(block);
  const out: ReturnType<typeof extractListCharacteristics> = {};
  const seerM = text.match(/SEER\s*([\d.,]+)/i);
  const scopM = text.match(/SCOP\s*([\d.,]+)/i);
  if (seerM) out.seer = parseNum(seerM[1]) ?? undefined;
  if (scopM) out.scop = parseNum(scopM[1]) ?? undefined;
  const seerChunk = text.match(/SEER[\s\S]{0,60}/i)?.[0];
  const scopChunk = text.match(/SCOP[\s\S]{0,60}/i)?.[0];
  out.energyCool = parseEnergyClassFromText(seerChunk ?? text) ?? undefined;
  out.energyHeat = parseEnergyClassFromText(scopChunk ?? text) ?? undefined;
  const noiseM = text.match(/(\d+(?:[.,]\d+)?)\s*dB/i);
  if (noiseM) out.noiseDb = parseNum(noiseM[1]) ?? undefined;
  const refrM = text.match(/\b(R32|R410A|R290)\b/i);
  if (refrM) out.refrigerant = refrM[1]!.toUpperCase();
  return out;
}

function parseWarrantyMonths(html: string): number | null {
  const scope =
    html.match(/single-product[\s\S]{0,100000}?id=["']tab-3["']/i)?.[0] ??
    html.match(/product-page[\s\S]{0,100000}/i)?.[0] ??
    html.slice(0, 120000);
  const years = scope.match(/гаранция[\s\S]{0,160}?(\d+)\s*(?:години|година)/i);
  if (years?.[1]) {
    const n = Number(years[1]);
    return Number.isFinite(n) ? n * 12 : null;
  }
  const months = scope.match(/гаранция[\s\S]{0,160}?(\d+)\s*месеца/i);
  if (months?.[1]) {
    const n = Number(months[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}


export type BulclimaSpecsPayload = BulclimaParsedProduct["specs"];

/** Пълни технически данни от таб „Технически характеристики", иконите и списъка. */
export function extractBulclimaProductSpecs(html: string, featureLabels: string[] = []): BulclimaSpecsPayload {
  const table = extractTechnicalSpecsTable(html);
  const list = extractListCharacteristics(html);

  // ── Мощност ──────────────────────────────────────────────────────────────
  const powerRow = tableRowFirst(table, ["мощност"], ["capacity"], ["мощн"]);
  const power = parsePowerPair(powerRow?.cool, powerRow?.heat);
  const coolKw =
    power.cool ??
    parseNum(readAttributeIconValue(html, "Охлаждане") ?? undefined) ??
    firstNumberInText(html.match(/coolding-capacity-attribute-value[\s\S]{0,200}?attribute-value[^>]*>([^<]+)/i)?.[1]);
  const heatKw =
    power.heat ??
    parseNum(readAttributeIconValue(html, "Отопление") ?? undefined) ??
    firstNumberInText(html.match(/heating-capacity-attribute-value[\s\S]{0,200}?attribute-value[^>]*>([^<]+)/i)?.[1]);

  // ── BTU ───────────────────────────────────────────────────────────────────
  const btuIcon = parseNum(readAttributeIconValue(html, "Мощност") ?? undefined);
  const btuTable = tableRowFirst(table, ["btu"], ["капацитет", "btu"]);
  const btuTableVal = firstNumberInText(btuTable?.cool);
  const btu =
    btuIcon != null && btuIcon > 0 && btuIcon <= 120
      ? Math.round(btuIcon)
      : btuTableVal != null && btuTableVal > 100
        ? Math.round(btuTableVal / 1000)
        : inferBtuFromCoolingKw(coolKw);

  // ── SEER / SCOP ───────────────────────────────────────────────────────────
  // toLatinAscii fallback handles Williams homoglyph chars (Ѕ, Cyrillic С/О/Р → seer/scop)
  const seerRow = tableRowFirst(table, ["seer"], ["eer"]);
  const scopRow = tableRowFirst(table, ["scop"], ["cop"]);
  // 3-column tables (Williams): value in .cool; 4-column (General): seer→cool, scop→heat
  const seerCell = parseSeerScopCell(seerRow?.cool ?? seerRow?.heat);
  const scopCell = parseSeerScopCell(scopRow?.heat ?? scopRow?.cool);

  // ── Енергиен клас ─────────────────────────────────────────────────────────
  const energyClassCoolRow = tableRowFirst(
    table, ["клас", "охлажд"], ["клас", "охл"], ["class", "cool"], ["energy", "cooling"],
  );
  const energyClassHeatRow = tableRowFirst(
    table, ["клас", "отопл"], ["class", "heat"], ["energy", "heating"],
  );
  const energyClassRow = tableRowFirst(table, ["енергиен", "клас"], ["energy", "class"]);
  const classIcon = parseEnergyClassFromText(readAttributeIconValue(html, "Клас") ?? undefined);
  const energyCoolFromTable =
    parseEnergyClassFromText(energyClassCoolRow?.cool ?? energyClassCoolRow?.heat) ??
    (energyClassRow?.cool?.includes("/")
      ? parseEnergyClassFromText(energyClassRow.cool.split("/")[0])
      : parseEnergyClassFromText(energyClassRow?.cool));
  const energyHeatFromTable =
    parseEnergyClassFromText(energyClassHeatRow?.cool ?? energyClassHeatRow?.heat) ??
    (energyClassRow?.cool?.includes("/")
      ? parseEnergyClassFromText(energyClassRow.cool.split("/")[1])
      : parseEnergyClassFromText(energyClassRow?.heat));

  // ── Шум ──────────────────────────────────────────────────────────────────
  const noiseIndoorRow = tableRowFirst(
    table, ["шум", "вътреш"], ["noise", "indoor"], ["sound", "indoor"],
  );
  const noiseRow = tableRowFirst(table, ["шум"], ["звуков"], ["noise", "level"], ["sound"], ["noise"]);
  const noise_db =
    parseNoiseIndoorDb(noiseIndoorRow?.cool ?? noiseIndoorRow?.heat) ??
    parseNoiseIndoorDb(noiseRow?.cool) ??
    list.noiseDb ??
    parseNum(html.match(/(\d+)\s*dB\s*\(A\)/i)?.[1]);

  // ── Размери ───────────────────────────────────────────────────────────────
  const dimIndoorRow = tableRowFirst(
    table, ["размери", "вътреш"], ["dimension", "indoor"], ["dimension", "internal"],
  );
  const dimOutdoorRow = tableRowFirst(
    table, ["размери", "външ"], ["dimension", "outdoor"], ["dimension", "external"],
  );
  const dimRow = tableRowFirst(table, ["размери"], ["dimension"]);
  const indoorDimRaw = dimIndoorRow?.cool ?? dimIndoorRow?.heat ?? dimRow?.cool;
  const outdoorDimRaw = dimOutdoorRow?.cool ?? dimOutdoorRow?.heat ?? dimRow?.heat;
  const indoorDim = parseDimensions(indoorDimRaw, dimIndoorRow?.label ?? dimRow?.label ?? "");
  const outdoorDim = parseDimensions(outdoorDimRaw, dimOutdoorRow?.label ?? dimRow?.label ?? "");

  // ── Тегло ─────────────────────────────────────────────────────────────────
  const weightIndoorRow = tableRowFirst(
    table, ["тегло", "вътреш"], ["weight", "indoor"], ["weight", "internal"],
  );
  const weightOutdoorRow = tableRowFirst(
    table, ["тегло", "външ"], ["weight", "outdoor"], ["weight", "external"],
  );
  const weightRow = tableRowFirst(table, ["тегло"], ["weight"]);
  const weight_indoor_kg =
    firstNumberInText(weightIndoorRow?.cool ?? weightIndoorRow?.heat) ??
    firstNumberInText(weightRow?.cool);
  const weight_outdoor_kg =
    firstNumberInText(weightOutdoorRow?.cool ?? weightOutdoorRow?.heat) ??
    firstNumberInText(weightRow?.heat);

  // ── Хладилен агент ────────────────────────────────────────────────────────
  const refrRow = tableRowFirst(table, ["хладилен", "агент"], ["refrigerant"]);
  const refrigerant =
    refrRow?.cool?.trim() ||
    list.refrigerant ||
    html.match(/\b(R32|R410A|R290)\b/i)?.[1]?.toUpperCase() ||
    null;

  // ── WiFi ──────────────────────────────────────────────────────────────────
  const listBlockHtml = html.match(/single-product-list-characteristics[\s\S]{0,4000}/i)?.[0] ?? "";
  const descTabHtml = html.match(/id=["']tab-1["'][\s\S]{0,8000}/i)?.[0] ?? "";
  const wifi = detectBulclimaWifi(featureLabels, listBlockHtml, descTabHtml);

  return {
    btu,
    coverage_m2: coolKw != null && coolKw > 0 ? Math.round(coolKw * 10) : null,
    noise_db,
    cooling_power_kw: coolKw,
    heating_power_kw: heatKw,
    refrigerant,
    wifi,
    energy_class_cool: seerCell.energyClass ?? energyCoolFromTable ?? list.energyCool ?? classIcon ?? null,
    energy_class_heat: scopCell.energyClass ?? energyHeatFromTable ?? list.energyHeat ?? null,
    seer: seerCell.value ?? list.seer ?? null,
    scop: scopCell.value ?? list.scop ?? null,
    warranty_months: parseWarrantyMonths(html),
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

const IMAGE_EXT = /\.(jpg|jpeg|png|webp|avif)(\?|$)/i;
/** Всички снимки от productgallery (не само 4). */
const MAX_PRODUCT_IMAGES = 16;

const SPECS_APPENDIX_MARKER = "Технически данни (Bulclima):";

function toAbsoluteBulclimaUrl(src: string, base = "https://bulclima.com"): string {
  const trimmed = src.trim();
  if (!trimmed || trimmed.startsWith("data:")) return "";
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http")) return trimmed;
  return `${base.replace(/\/$/, "")}${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
}

/** WordPress/CDN: photo-300x200.jpg → photo.jpg; маха ?w= / ?h= за по-голям оригинал. */
export function upscaleBulclimaImageUrl(url: string): string {
  let u = url.trim();
  u = u.replace(/-\d+x\d+(?=\.(jpg|jpeg|png|webp|avif)(\?|$))/i, "");
  u = u.replace(/\/(?:thumb(?:nail)?|small|medium|large)\//gi, "/");
  try {
    const parsed = new URL(u);
    for (const key of ["w", "h", "width", "height", "resize", "fit", "crop"]) {
      parsed.searchParams.delete(key);
    }
    u = parsed.toString();
  } catch {
    /* relative or invalid */
  }
  return u;
}

function parseSrcsetUrls(srcset: string): string[] {
  const out: string[] = [];
  for (const part of srcset.split(",")) {
    const url = part.trim().split(/\s+/)[0];
    if (url) out.push(url);
  }
  return out;
}

function isProductImageCandidate(url: string): boolean {
  const u = url.toLowerCase();
  if (!IMAGE_EXT.test(u)) return false;
  if (u.includes("logo") || u.includes("icon") || u.includes("banner") || u.includes("cookie")) return false;
  if (u.includes("gravatar") || u.includes("payment") || u.includes("sprite")) return false;
  if (u.includes("mainmenuitem") || u.includes("/ico")) return false;
  if (/\/\d{2,3}x\d{2,3}\//.test(u) && !u.includes("productgallery")) return false;
  return u.includes("wp-content") || u.includes("/uploads/") || u.includes("bulclima.com");
}

function collectImageUrlsFromHtmlFragment(
  fragment: string,
  base: string,
  raw: string[],
  seen: Set<string>,
): void {
  const push = (src: string | undefined | null) => {
    if (raw.length >= MAX_PRODUCT_IMAGES || !src) return;
    const abs = upscaleBulclimaImageUrl(toAbsoluteBulclimaUrl(src, base));
    if (!abs || !isProductImageCandidate(abs) || seen.has(abs)) return;
    seen.add(abs);
    raw.push(abs);
  };

  const attrRe =
    /(?:src|data-src|data-lazy-src|data-original|data-full|data-large_image|href)=["']([^"']+)["']/gi;
  let am: RegExpExecArray | null;
  while ((am = attrRe.exec(fragment)) !== null) {
    push(am[1]);
  }

  const imgRe = /<img[^>]+>/gi;
  let im: RegExpExecArray | null;
  while ((im = imgRe.exec(fragment)) !== null) {
    const tag = im[0]!;
    push(tag.match(/\ssrc=["']([^"']+)["']/i)?.[1]);
    push(tag.match(/data-(?:src|lazy-src|original)=["']([^"']+)["']/i)?.[1]);
    const ss = tag.match(/srcset=["']([^"']+)["']/i)?.[1];
    if (ss) {
      const candidates = parseSrcsetUrls(ss)
        .map((u) => upscaleBulclimaImageUrl(toAbsoluteBulclimaUrl(u, base)))
        .filter((u) => isProductImageCandidate(u));
      if (candidates.length) push(candidates[candidates.length - 1]);
    }
  }
}

/** Извлича до 4 големи снимки в реда на откриване (галерия → og → останали). */
export function extractBulclimaProductImageUrls(html: string, base = "https://bulclima.com"): string[] {
  const raw: string[] = [];
  const seen = new Set<string>();

  const push = (src: string | undefined | null) => {
    if (raw.length >= MAX_PRODUCT_IMAGES || !src) return;
    const abs = upscaleBulclimaImageUrl(toAbsoluteBulclimaUrl(src, base));
    if (!abs || !isProductImageCandidate(abs) || seen.has(abs)) return;
    seen.add(abs);
    raw.push(abs);
  };

  const galleryBlock =
    html.match(/productgallery[\s\S]{0,80000}/i)?.[0] ??
    html.match(/product-gallery[\s\S]{0,80000}/i)?.[0];
  if (galleryBlock) collectImageUrlsFromHtmlFragment(galleryBlock, base, raw, seen);

  const ogImg = html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  push(ogImg?.[1]);

  const jsonLdImages = html.matchAll(/"image"\s*:\s*(?:\[([^\]]+)\]|"([^"]+)")/gi);
  for (const m of jsonLdImages) {
    const block = m[1] ?? m[2] ?? "";
    for (const u of block.matchAll(/https?:\/\/[^"'\s,]+\.(?:jpg|jpeg|png|webp|avif)[^"'\s,]*/gi)) {
      push(u[0]);
    }
  }

  if (raw.length < MAX_PRODUCT_IMAGES) {
    collectImageUrlsFromHtmlFragment(html, base, raw, seen);
  }

  const imageQualityScore = (u: string) => {
    const l = u.toLowerCase();
    if (l.includes("/originals/")) return 4;
    if (l.includes("540x405") || l.includes("800x") || l.includes("1024x")) return 3;
    if (l.includes("productgallery")) return 2;
    if (l.includes("120x90") || l.includes("150x")) return 0;
    return 1;
  };

  const byBase = new Map<string, string>();
  for (const url of raw) {
    const baseName = url.replace(/-\d+x\d+/i, "").replace(/\/(originals|\d+x\d+)\//i, "/");
    const prev = byBase.get(baseName);
    if (!prev || imageQualityScore(url) > imageQualityScore(prev)) byBase.set(baseName, url);
  }

  return [...byBase.values()]
    .sort((a, b) => imageQualityScore(b) - imageQualityScore(a))
    .slice(0, MAX_PRODUCT_IMAGES);
}

function normalizeBulclimaProductUrl(href: string, base = "https://bulclima.com"): string {
  const trimmed = href.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("javascript:")) return "";
  try {
    const abs = new URL(trimmed, base);
    if (!abs.hostname.includes("bulclima.com")) return "";
    if (!abs.pathname.includes("/product/")) return "";
    abs.hash = "";
    abs.search = "";
    const path = abs.pathname.replace(/\/+$/, "");
    return `${base.replace(/\/$/, "")}${path}`;
  } catch {
    return "";
  }
}

export function extractProductUrlsFromListing(html: string, base = "https://bulclima.com"): string[] {
  const urls = new Set<string>();
  const patterns = [
    /href=["'](?:https?:\/\/bulclima\.com)?(\/product\/[^"'#?\s]+)\/?["']/gi,
    /href=["'](https?:\/\/bulclima\.com\/product\/[^"'#?\s]+)\/?["']/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const raw = m[1]!.startsWith("http") ? m[1]! : `${base.replace(/\/$/, "")}${m[1]}`;
      const norm = normalizeBulclimaProductUrl(raw, base);
      if (norm) urls.add(norm);
    }
  }
  return [...urls];
}

/** Брой продукти от листинга („139“) — за проверка на пагинацията. */
export function extractListingProductCount(html: string): number | null {
  const m = html.match(/>\s*(\d{1,4})\s*<[\s\S]{0,400}?productCategorySingle/i);
  if (m?.[1]) {
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  }
  const alt = html.match(/productCategorySingle[\s\S]{0,200}?>\s*(\d{1,4})\s*</i);
  if (alt?.[1]) {
    const n = Number(alt[1]);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function extractCategoryUrls(html: string, base = "https://bulclima.com"): string[] {
  const urls = new Set<string>();
  const re = /href=["'](?:https?:\/\/bulclima\.com)?(\/products\/klimatici\/[^"'#?]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const path = m[1]!;
    if (path.includes("/product/")) continue;
    urls.add(`${base.replace(/\/$/, "")}${path}`);
  }
  return [...urls];
}

/** Макс. страница от JS пагинация (data-page) + брой продукти / perPage. */
export function extractBulclimaListingMaxPage(html: string): number {
  let maxPage = 1;
  for (const m of html.matchAll(/data-page=["'](\d+)["']/gi)) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxPage) maxPage = n;
  }
  const perPageM = html.match(/"perPage":\s*(\d+)/);
  const perPage = perPageM ? Number(perPageM[1]) : 18;
  const total = extractListingProductCount(html);
  if (total && perPage > 0) {
    maxPage = Math.max(maxPage, Math.ceil(total / perPage));
  }
  return maxPage;
}

/** Всички URL на листинг страници (?page=N) — bulclima.com ползва JS, не href линкове. */
export function buildBulclimaListingPageUrls(listingUrl: string, firstPageHtml: string): string[] {
  const pages = new Set<string>();
  const base = new URL(listingUrl);
  base.hash = "";
  base.searchParams.delete("page");
  base.searchParams.delete("paged");
  const cleanHref = base.href;

  pages.add(cleanHref);
  const maxPage = extractBulclimaListingMaxPage(firstPageHtml);
  for (let p = 2; p <= maxPage; p++) {
    const u = new URL(cleanHref);
    u.searchParams.set("page", String(p));
    pages.add(u.href);
  }

  for (const legacy of extractPaginationUrlsFromHrefs(firstPageHtml, listingUrl)) {
    pages.add(legacy);
  }

  return [...pages].sort((a, b) => {
    const pa = Number(new URL(a).searchParams.get("page") ?? "1");
    const pb = Number(new URL(b).searchParams.get("page") ?? "1");
    return pa - pb;
  });
}

function extractPaginationUrlsFromHrefs(html: string, currentUrl: string): string[] {
  const pages = new Set<string>();
  const listingBase = new URL(currentUrl);
  listingBase.hash = "";
  listingBase.searchParams.delete("page");
  listingBase.searchParams.delete("paged");

  const hrefRe = /href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1]!.trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    try {
      const abs = new URL(href, currentUrl);
      if (!abs.hostname.includes("bulclima.com")) continue;
      if (!abs.pathname.includes("/products/") || abs.pathname.includes("/product/")) continue;
      const hasPage =
        abs.searchParams.has("page") ||
        abs.searchParams.has("paged") ||
        /\/page\/\d+\/?$/i.test(abs.pathname);
      if (hasPage) {
        abs.hash = "";
        pages.add(abs.href);
      }
    } catch {
      /* skip invalid href */
    }
  }

  let maxPage = 1;
  const pageNumRe = /[?&](?:page|paged)=(\d+)/gi;
  let pm: RegExpExecArray | null;
  while ((pm = pageNumRe.exec(html)) !== null) {
    const n = Number(pm[1]);
    if (Number.isFinite(n) && n > maxPage) maxPage = n;
  }
  const pathPageRe = /\/page\/(\d+)\/?/gi;
  while ((pm = pathPageRe.exec(html)) !== null) {
    const n = Number(pm[1]);
    if (Number.isFinite(n) && n > maxPage) maxPage = n;
  }

  for (let p = 2; p <= maxPage; p++) {
    const u = new URL(listingBase.href);
    u.searchParams.set("page", String(p));
    pages.add(u.href);
  }

  return [...pages];
}

/** @deprecated Използвайте buildBulclimaListingPageUrls */
export function extractPaginationUrls(html: string, currentUrl: string): string[] {
  return buildBulclimaListingPageUrls(currentUrl, html).slice(1);
}

/** Лого/марка от продуктовата страница на Bulclima (`single-product-brand-thumb`). */
export function extractBulclimaBrandHint(html: string): string | null {
  const thumb = html.match(
    /class=["'][^"']*single-product-brand-thumb[^"']*["'][^>]*(?:title|alt)=["']([^"']+)["']/i,
  );
  if (thumb?.[1]) return decodeHtml(thumb[1]).replace(/\s+Inc\.?$/i, "").trim() || null;
  const thumbAltFirst = html.match(
    /single-product-brand-thumb[^>]*\s(?:title|alt)=["']([^"']+)["']/i,
  );
  if (thumbAltFirst?.[1]) return decodeHtml(thumbAltFirst[1]).replace(/\s+Inc\.?$/i, "").trim() || null;
  return null;
}

export function categorySlugFromKlimaticiPath(path: string): string | null {
  const p = path.toLowerCase();
  if (p.includes("multi-split") || p.includes("multisplit") || p.includes("multi-split-sistemi")) return "multi";
  if (p.includes("podovi")) return "floor";
  if (p.includes("kasetuch") || p.includes("kasset") || p.includes("kaset")) return "cassette";
  if (p.includes("tavan")) return "ceiling";
  if (p.includes("stenni") || p.includes("stenen")) return "wall";
  return null;
}

function categorySlugFromUrl(url: string): string | null {
  try {
    return categorySlugFromKlimaticiPath(new URL(url).pathname);
  } catch {
    return categorySlugFromKlimaticiPath(url);
  }
}

/** Най-специфичната подкатегория от breadcrumbs на продуктовата страница. */
export function extractBulclimaKlimaticiCategoryPath(html: string): string | null {
  const crumbs = html.match(/<div[^>]*class=["'][^"']*breadcrumbs[^"']*["'][\s\S]*?<\/ol>/i)?.[0];
  if (!crumbs) return null;
  const re =
    /class=["'][^"']*breadcrumb-link[^"']*["'][^>]*href=["'](?:https?:\/\/bulclima\.com)?(\/products\/klimatici\/[^"'#?]+)["']/gi;
  let deepest: string | null = null;
  let m: RegExpExecArray | null;
  while ((m = re.exec(crumbs)) !== null) deepest = m[1]!;
  return deepest;
}

const KLIMA_CATEGORY_PRIORITY = ["floor", "cassette", "ceiling", "multi", "wall"] as const;

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
  if (slug === "cassette") return "Касетъчен";
  if (slug === "ceiling") return "Таван";
  if (slug === "multi") return "Мулти";
  if (slug === "wall") return "Стенен";
  return null;
}

function typeHintFromProductText(name: string, description: string | null): string | null {
  const hay = `${name} ${description ?? ""}`;
  if (/мульти|multisplit|мултисплит/i.test(hay)) return "Мулти";
  if (/подов|таванно[\s-]*подов/i.test(hay)) return "Подов";
  // Касетъчен преди „таван“ — и двата се монтират на тавана, но са различни системи.
  if (/касет|4[\s-]*посоч|four[\s-]*way/i.test(hay)) return "Касетъчен";
  if (/таван/i.test(hay)) return "Таван";
  if (/дизайнерск/i.test(hay)) return "Дизайн";
  if (/стенен|стенни/i.test(hay)) return "Стенен";
  return null;
}

export function resolveBulclimaProductClassification(
  html: string,
  sourceUrl: string,
  name: string,
  description: string | null,
  listingCategoryPath?: string | null,
): { categorySlug: string | null; typeHint: string } {
  const pathCandidates = [
    extractBulclimaKlimaticiCategoryPath(html),
    listingCategoryPath,
    (() => {
      try {
        return new URL(sourceUrl).pathname;
      } catch {
        return sourceUrl;
      }
    })(),
  ].filter((p): p is string => Boolean(p?.trim()));

  let categorySlug = pickCategorySlug(pathCandidates.map((path) => categorySlugFromKlimaticiPath(path)));

  const typeHint =
    typeHintFromProductText(name, description) ??
    typeHintFromCategorySlug(categorySlug) ??
    "Стенен";

  if (!categorySlug) {
    if (typeHint === "Подов") categorySlug = "floor";
    else if (typeHint === "Касетъчен") categorySlug = "cassette";
    else if (typeHint === "Таван") categorySlug = "ceiling";
    else if (typeHint === "Мулти") categorySlug = "multi";
    else categorySlug = "wall";
  }

  return { categorySlug, typeHint };
}

function listingCategorySpecificity(path: string | null): number {
  if (!path) return 0;
  const p = path.toLowerCase();
  if (p === "/products/klimatici" || /\/klimatici\/?$/.test(p)) return 1;
  if (
    p.includes("podovi") ||
    p.includes("stenni") ||
    p.includes("kaset") ||
    p.includes("tavan") ||
    p.includes("multi-split") ||
    p.includes("multisplit")
  ) {
    return 3;
  }
  return 2;
}

function formatBulclimaSpecsAppendix(rows: Map<string, BulclimaTableRow>): string {
  if (rows.size === 0) return "";
  const lines: string[] = [`\n\n---\n${SPECS_APPENDIX_MARKER}\n`];
  for (const [label, row] of rows) {
    const labelText = row.label?.trim() || label;
    const unit = row.unit?.trim();
    const cool = row.cool?.trim();
    const heat = row.heat?.trim();
    if (cool && heat) {
      lines.push(`${labelText}: ${cool}${unit ? ` ${unit}` : ""} / ${heat}${unit ? ` ${unit}` : ""}`);
    } else if (cool) {
      lines.push(`${labelText}: ${cool}${unit ? ` ${unit}` : ""}`);
    } else if (heat) {
      lines.push(`${labelText}: ${heat}${unit ? ` ${unit}` : ""}`);
    }
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

export function parseBulclimaProductPage(
  html: string,
  sourceUrl: string,
  listingCategoryPath?: string | null,
): BulclimaParsedProduct | null {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const ogTitle = html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const name = decodeHtml((h1?.[1] ?? ogTitle?.[1] ?? "").replace(/<[^>]+>/g, ""));
  if (!name || name.length < 5) return null;

  const priceEur = parseEuroPrice(html);
  const effectivePriceEur = priceEur ?? 0;

  const mount = parseMountAddon(html);
  const modelCode = extractModelCode(name);
  const brandName = resolveBrandName(name, extractBulclimaBrandHint(html));

  let description: string | null = null;
  const descTab = html.match(
    /id=["']tab-1["'][\s\S]*?product-description[\s\S]*?>([\s\S]*?)<\/div>\s*<\/div>/i,
  );
  if (descTab?.[1]) {
    description = decodeHtml(descTab[1].replace(/<[^>]+>/g, " ").slice(0, 5000));
  } else {
    const descBlock = html.match(/Описание[\s\S]{0,200}?<\/h[234]>[\s\S]{0,8000}?(?=<h[234]|Технически характеристики|Екстри|$)/i);
    if (descBlock) {
      description = decodeHtml(descBlock[0].replace(/<[^>]+>/g, " ").slice(0, 5000));
    }
  }

  const imageUrls = extractBulclimaProductImageUrls(html);

  const featureLabels: string[] = [];
  const seenFeatures = new Set<string>();
  const pushFeature = (label: string) => {
    const t = decodeHtml(label.replace(/<[^>]+>/g, "")).trim();
    if (t.length < 3 || t.length > 120) return;
    const key = t.toLowerCase();
    if (seenFeatures.has(key)) return;
    seenFeatures.add(key);
    featureLabels.push(t);
  };

  const listBlock = html.match(/single-product-list-characteristics[\s\S]{0,4000}/i)?.[0];
  if (listBlock) {
    const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let li: RegExpExecArray | null;
    while ((li = liRe.exec(listBlock)) !== null) {
      pushFeature(li[1]!);
    }
  }

  const extrasTab = html.match(/id=["']tab-3["'][\s\S]{0,20000}/i)?.[0];
  if (extrasTab) {
    const nameRe = /<div class="name">([\s\S]*?)<\/div>/gi;
    let nm: RegExpExecArray | null;
    while ((nm = nameRe.exec(extrasTab)) !== null) {
      pushFeature(nm[1]!);
    }
  }

  const tableRows = extractTechnicalSpecsTable(html);
  const specs = extractBulclimaProductSpecs(html, featureLabels);
  const specsAppendix = formatBulclimaSpecsAppendix(tableRows);
  description = mergeDescriptionWithSpecsAppendix(description, specsAppendix);

  const { categorySlug, typeHint } = resolveBulclimaProductClassification(
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
    brandName,
    priceEur: effectivePriceEur,
    priceWithMountEur: Math.round((effectivePriceEur + mount) * 100) / 100,
    description: description || null,
    imageUrls,
    categorySlug,
    typeHint,
    featureLabels,
    specs,
  };
}

export const BULCLIMA_KLIMA_ROOT = "https://bulclima.com/products/klimatici";

/** Категории за синхронизация (по заявка: стенни + мултисплит). */
export const BULCLIMA_DEFAULT_SYNC_LISTING_URLS = [
  "https://bulclima.com/products/klimatici/stenni-klimatici",
  "https://bulclima.com/products/klimatici/multi-split-sistemi",
] as const;

/**
 * Разрешени подкатегории при обхождане от /products/klimatici (ако се подаде custom списък — не се ползва).
 */
const ALLOWED_CATEGORY_PATTERNS = [
  /stenni/i,
  /multi-split/i,
  /multisplit/i,
  /podovi/i,
  /tavann/i,
  /kaset/i,
];

export function isAllowedBulclimaCategoryPath(path: string): boolean {
  const p = path.toLowerCase();
  if (/kanalni|kolonni|mobilni|wi-fi-i-aksesoari/i.test(p)) return false;
  return ALLOWED_CATEGORY_PATTERNS.some((re) => re.test(p));
}

export type CollectBulclimaUrlsOptions = {
  limit?: number;
  /** Листинг URL-и; по подразбиране stenni + multi-split. */
  listingUrls?: readonly string[];
};

export type BulclimaCatalogEntry = {
  url: string;
  listingCategoryPath: string | null;
};

async function crawlBulclimaListingCategory(
  catUrl: string,
  productEntries: Map<string, BulclimaCatalogEntry>,
  limit: number | undefined,
  onStatus?: (message: string) => void,
): Promise<boolean> {
  const sizeBeforeCategory = productEntries.size;
  const visitedPages = new Set<string>();
  let expectedCount: number | null = null;
  let queue: string[] = [];

  const seedHtml = await fetchBulclimaHtml(catUrl);
  expectedCount = extractListingProductCount(seedHtml);
  queue = buildBulclimaListingPageUrls(catUrl, seedHtml);
  if (expectedCount != null) {
    onStatus?.(
      `Категория ${new URL(catUrl).pathname}: ~${expectedCount} продукта, ${queue.length} страници листинг`,
    );
  } else {
    onStatus?.(`Категория ${new URL(catUrl).pathname}: ${queue.length} страници листинг`);
  }

  while (queue.length > 0) {
    const pageUrl = queue.shift()!;
    if (visitedPages.has(pageUrl)) continue;
    visitedPages.add(pageUrl);
    try {
      onStatus?.(`Листинг: ${pageUrl}`);
      const html = pageUrl === catUrl && visitedPages.size === 1 ? seedHtml : await fetchBulclimaHtml(pageUrl);
      const before = productEntries.size;
      let listingPath: string | null = null;
      try {
        listingPath = new URL(pageUrl).pathname;
      } catch {
        listingPath = null;
      }
      for (const u of extractProductUrlsFromListing(html)) {
        const prev = productEntries.get(u);
        const spec = listingCategorySpecificity(listingPath);
        const prevSpec = listingCategorySpecificity(prev?.listingCategoryPath ?? null);
        if (!prev || spec > prevSpec) {
          productEntries.set(u, { url: u, listingCategoryPath: listingPath });
        }
        if (limit && productEntries.size >= limit) {
          onStatus?.(`Намерени ${productEntries.size} продукта (лимит ${limit})`);
          return true;
        }
      }
      if (productEntries.size > before) {
        onStatus?.(`Открити ${productEntries.size} уникални продукта до момента…`);
      }
    } catch (e: unknown) {
      onStatus?.(`Пропуснат листинг ${pageUrl}: ${e instanceof Error ? e.message : String(e)}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  if (expectedCount != null) {
    const foundInCategory = productEntries.size - sizeBeforeCategory;
    if (foundInCategory < expectedCount) {
      onStatus?.(
        `Внимание: „${new URL(catUrl).pathname}“ — на bulclima.com ${expectedCount} продукта, открити ${foundInCategory} URL (проверете пагинацията).`,
      );
    }
  }
  return false;
}

export async function collectBulclimaProductUrls(
  limitOrOpts?: number | CollectBulclimaUrlsOptions,
  onStatus?: (message: string) => void,
): Promise<BulclimaCatalogEntry[]> {
  const opts: CollectBulclimaUrlsOptions =
    typeof limitOrOpts === "number" || limitOrOpts === undefined
      ? { limit: limitOrOpts }
      : limitOrOpts;
  const limit = opts.limit;
  const categoryUrls = [...(opts.listingUrls ?? BULCLIMA_DEFAULT_SYNC_LISTING_URLS)];

  onStatus?.(`Обхождане на ${categoryUrls.length} категории: ${categoryUrls.map((u) => new URL(u).pathname).join(", ")}`);
  const productEntries = new Map<string, BulclimaCatalogEntry>();

  for (const catUrl of categoryUrls) {
    const hitLimit = await crawlBulclimaListingCategory(catUrl, productEntries, limit, onStatus);
    if (hitLimit) return [...productEntries.values()];
  }

  onStatus?.(`Обходът приключи — ${productEntries.size} продукта`);
  return [...productEntries.values()];
}
