/**
 * productService.ts – Изолиращ слой между данните и UI компонентите
 * ──────────────────────────────────────────────────────────────────
 * ВАЖНО: UI компонентите НИКОГА не четат директно от db.ts или products масива.
 * Те извикват само функциите от този файл.
 *
 * За смяна с реален backend: замени само тялото на функциите тук.
 * Нищо друго в UI не се пипа.
 */

import type {
  CatalogProduct,
  ProductSpec,
  ProductBadge,
  CategoryMeta,
  BrandMeta,
  SortOption,
} from './types/product';
import { DEFAULT_CATALOG_SORT } from './types/product';

// ──────────────────────────────────────
// IMAGE POOL (6 налични снимки за всички продукти)
// При backend → снимките идват от API/CDN
// ──────────────────────────────────────

function resolveBorderAndBg(brand: string): { cardBorder: string; imgBg: string } {
  const brandLower = brand.toLowerCase();
  if (brandLower.includes('daikin'))    return { cardBorder: 'border-blue-200 shadow-blue-50', imgBg: 'bg-gray-50' };
  if (brandLower.includes('mitsubishi heavy')) return { cardBorder: 'border-rose-200 shadow-rose-50', imgBg: 'bg-white' };
  if (brandLower.includes('mitsubishi')) return { cardBorder: 'border-red-100 shadow-red-50', imgBg: 'bg-white' };
  if (brandLower.includes('samsung'))  return { cardBorder: 'border-indigo-100', imgBg: 'bg-gray-100' };
  if (brandLower.includes('fujitsu'))  return { cardBorder: 'border-gray-200', imgBg: 'bg-gray-50' };
  if (brandLower.includes('gree'))     return { cardBorder: 'border-green-100', imgBg: 'bg-white' };
  if (brandLower.includes('lg'))       return { cardBorder: 'border-gray-200', imgBg: 'bg-gray-50' };
  if (brandLower.includes('panasonic')) return { cardBorder: 'border-blue-100', imgBg: 'bg-white' };
  return { cardBorder: 'border-gray-200', imgBg: 'bg-gray-50' };
}

// ──────────────────────────────────────
// BADGE LOGIC
// ──────────────────────────────────────

function resolveBadge(product: {
  slug?: string | null;
  name?: string;
  price: number;
  energyCool?: string;
  features: string[];
}): ProductBadge | undefined {
  const features = product.features ?? [];
  const key = `${(product.slug ?? "").toLowerCase()} ${(product.name ?? "").toLowerCase()}`;
  if (key.includes("perfera") || key.includes("ln25")) {
    return { text: 'Bestseller', bg: 'bg-yellow-100', textCol: 'text-yellow-700' };
  }
  if (product.energyCool === 'A+++') {
    return { text: 'Premium', bg: 'bg-blue-100', textCol: 'text-blue-700' };
  }
  if (product.price < 1000) {
    return { text: 'Топ цена', bg: 'bg-green-100', textCol: 'text-green-700' };
  }
  if (features.some(f => f.toLowerCase().includes('тих') || f.includes('19 dB') || f.includes('19dB'))) {
    return { text: 'Ултра тих', bg: 'bg-purple-100', textCol: 'text-purple-700' };
  }
  return undefined;
}

// ──────────────────────────────────────
// SPECS (icon + text pairs for quick-view)
// ──────────────────────────────────────

function resolveSpecs(product: { coolingPower?: string; noise?: string; wifi?: boolean }): ProductSpec[] {
  const specs: ProductSpec[] = [];
  if (product.coolingPower) {
    specs.push({ icon: '⚡', text: product.coolingPower });
  }
  if (product.noise) {
    specs.push({ icon: '🔇', text: product.noise });
  }
  if (product.wifi !== undefined) {
    specs.push({ icon: product.wifi ? '📶' : '—', text: product.wifi ? 'WiFi' : 'Без WiFi' });
  }
  return specs.slice(0, 3);
}

// ──────────────────────────────────────
// RATING (детерминирано от id докато няма реални данни)
// ──────────────────────────────────────

function fakeRating(seed: string): { rating: number; reviews: number } {
  const hash = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rating = +(4.5 + (hash % 5) * 0.1).toFixed(1);
  const reviews = 15 + (hash % 100);
  return { rating, reviews };
}

/** Публично описание без вътрешни „Източник:“ редове от импорт. */
export function publicProductDescription(description: string | undefined | null): string | undefined {
  if (!description?.trim()) return undefined;
  const cut = description.search(/\n\nИзточник:\s*https?:\/\//i);
  if (cut >= 0) {
    const trimmed = description.slice(0, cut).trim();
    return trimmed || undefined;
  }
  if (/^Източник:\s*https?:\/\//i.test(description.trim())) return undefined;
  return description.trim();
}

// ──────────────────────────────────────
// MAIN MAPPING FUNCTION
// ──────────────────────────────────────

type ApiProduct = {
  slug: string;
  name: string;
  description?: string | null;
  price: number;
  price_with_mount?: number | null;
  product_condition?: "new" | "used" | null;
  rating?: number | null;
  reviews_count?: number | null;
  meta_title?: string | null;
  meta_description?: string | null;
  brands?: { name: string } | null;
  product_types?: { name: string } | null;
  product_specs?: Array<{
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
  }> | null;
  product_images?: Array<{ url: string; is_main: boolean; sort_order: number }> | null;
  product_features?: Array<{ features?: { name?: string } | null }> | null;
};

const CATALOG_IMAGE_PLACEHOLDER = '/images/hero-new.jpg';

/** Предпочита локални/Cloudinary URL; cnj CDN често връща 404 след импорт. */
export function pickCatalogImageUrl(urls: string[]): string {
  if (!urls.length) return CATALOG_IMAGE_PLACEHOLDER;
  const local = urls.find((u) => u.startsWith('/'));
  if (local) return local;
  const cloudinary = urls.find((u) => u.includes('res.cloudinary.com'));
  if (cloudinary) return cloudinary;
  const reliable = urls.find((u) => !/img\.cdn-cnj\.si/i.test(u));
  return reliable ?? urls[0] ?? CATALOG_IMAGE_PLACEHOLDER;
}

function resolveProductCategory(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('касет') || t.includes('таван') || t.includes('подов') || t.includes('канал') || t.includes('колон')) {
    return 'Търговски';
  }
  if (t.includes('мулти')) return 'Къща';
  return 'Апартамент';
}

function mapApiToCatalogProduct(raw: ApiProduct): CatalogProduct {
  const brand = raw.brands?.name ?? '—';
  const type = raw.product_types?.name ?? '';
  const specs0 = raw.product_specs?.[0];
  const features = (raw.product_features ?? [])
    .map((pf) => pf.features?.name)
    .filter(Boolean) as string[];

  const energyCool = specs0?.energy_class_cool ?? undefined;
  const energyHeat = specs0?.energy_class_heat ?? undefined;
  const sortedImages = (raw.product_images ?? [])
    .slice()
    .sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || a.sort_order - b.sort_order)
    .map((im) => im.url)
    .filter(Boolean);
  const image = pickCatalogImageUrl(sortedImages);

  const { cardBorder, imgBg } = resolveBorderAndBg(brand);
  const fallback = fakeRating(raw.slug);
  const rating = raw.rating != null ? Number(raw.rating) : fallback.rating;
  const reviews = raw.reviews_count != null ? Number(raw.reviews_count) : fallback.reviews;

  const numOrUndef = (v: unknown): number | undefined => {
    if (v == null) return undefined;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  const coolingKw = numOrUndef(specs0?.cooling_power_kw);
  const heatingKw = numOrUndef(specs0?.heating_power_kw);
  const noiseDb = numOrUndef(specs0?.noise_db);
  const coverageM2 = numOrUndef(specs0?.coverage_m2);
  const btu = numOrUndef(specs0?.btu);

  const coolingPower = coolingKw != null ? `${coolingKw} kW` : undefined;
  const heatingPower = heatingKw != null ? `${heatingKw} kW` : undefined;
  const noise = noiseDb != null ? `${noiseDb} dB` : undefined;
  const area = coverageM2 != null ? `до ${Math.round(coverageM2)} м²` : undefined;
  const warranty = specs0?.warranty_months ? `${Math.round(specs0.warranty_months / 12)} г. гаранция` : undefined;

  const weightIndoorKg = numOrUndef(specs0?.weight_indoor_kg);
  const weightOutdoorKg = numOrUndef(specs0?.weight_outdoor_kg);
  const indoorDims = {
    lengthMm: numOrUndef(specs0?.dim_indoor_length_mm),
    widthMm: numOrUndef(specs0?.dim_indoor_width_mm),
    heightMm: numOrUndef(specs0?.dim_indoor_height_mm),
  };
  const outdoorDims = {
    lengthMm: numOrUndef(specs0?.dim_outdoor_length_mm),
    widthMm: numOrUndef(specs0?.dim_outdoor_width_mm),
    heightMm: numOrUndef(specs0?.dim_outdoor_height_mm),
  };
  const hasIndoorDims = indoorDims.lengthMm != null || indoorDims.widthMm != null || indoorDims.heightMm != null;
  const hasOutdoorDims = outdoorDims.lengthMm != null || outdoorDims.widthMm != null || outdoorDims.heightMm != null;
  const dimensions = hasIndoorDims || hasOutdoorDims
    ? {
        indoor: hasIndoorDims ? indoorDims : undefined,
        outdoor: hasOutdoorDims ? outdoorDims : undefined,
      }
    : undefined;

  return {
    id: raw.slug,
    name: raw.name,
    brand,
    model: raw.name,
    type,
    category: resolveProductCategory(type),
    condition: raw.product_condition === "used" ? "used" : "new",

    image,
    images: sortedImages.length ? sortedImages : undefined,
    imgBg,
    cardBorder,

    energyClass: energyCool ?? 'A+',
    specs: resolveSpecs({ coolingPower, noise, wifi: specs0?.wifi ?? undefined }),
    extras: features.slice(0, 4),
    area,
    noise,
    wifi: specs0?.wifi ?? undefined,
    warranty,
    description: raw.description ?? undefined,
    refrigerant: specs0?.refrigerant ?? undefined,
    coolingPower,
    heatingPower,
    seer: numOrUndef(specs0?.seer),
    scop: numOrUndef(specs0?.scop),
    btu,
    coverageM2,
    coolingKw,
    heatingKw,
    noiseDb,

    metaTitle: raw.meta_title?.trim() || undefined,
    metaDescription: raw.meta_description?.trim() || undefined,

    price: Number(raw.price),
    priceWithMount:
      raw.price_with_mount != null && Number.isFinite(Number(raw.price_with_mount))
        ? Number(raw.price_with_mount)
        : undefined,

    rating,
    reviews,

    badge: resolveBadge({ slug: raw.slug, name: raw.name, price: Number(raw.price), energyCool, features }),
    inStock: true,

    features,
    energyCool,
    energyHeat,

    weightIndoorKg,
    weightOutdoorKg,
    dimensions,
  };
}

// ──────────────────────────────────────
// PUBLIC SERVICE FUNCTIONS
// ── Замени САМО ТУК при реален backend ──
// ──────────────────────────────────────

const PRODUCT_CACHE_TTL_MS = 5 * 60 * 1000;
let allProductsCache: { at: number; data: Promise<CatalogProduct[]> } | null = null;
const productByIdCache = new Map<string, { at: number; data: Promise<CatalogProduct | undefined> }>();

function cacheFresh<T>(entry: { at: number; data: T } | null | undefined): entry is { at: number; data: T } {
  return Boolean(entry && Date.now() - entry.at < PRODUCT_CACHE_TTL_MS);
}

async function loadAllProductsFromApi(): Promise<CatalogProduct[]> {
  const all: CatalogProduct[] = [];
  let page = 1;
  const perPage = 100;
  for (;;) {
    const res = await fetch(`/api/products?page=${page}&perPage=${perPage}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Грешка при зареждане на продукти');
    const batch = (json.data ?? []) as ApiProduct[];
    all.push(
      ...batch
        .map(mapApiToCatalogProduct)
        .filter((p) => !isAccessoryLike(p)),
    );
    if (batch.length < perPage) break;
    page += 1;
  }
  return all;
}

/** Всички продукти (кеш ~5 мин — AI/wizard/блог не дърпат каталога многократно). */
export async function getAllProducts(): Promise<CatalogProduct[]> {
  if (cacheFresh(allProductsCache)) return allProductsCache.data;
  const data = loadAllProductsFromApi();
  allProductsCache = { at: Date.now(), data };
  return data;
}

/** Един продукт по slug или UUID (само публично видими). */
export async function getProductById(id: string): Promise<CatalogProduct | undefined> {
  const key = id.trim().toLowerCase();
  const hit = productByIdCache.get(key);
  if (cacheFresh(hit)) return hit.data;

  const data = (async () => {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
    if (res.status === 404) return undefined;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return undefined;
    if (!json.data) return undefined;
    return mapApiToCatalogProduct(json.data as ApiProduct);
  })();

  productByIdCache.set(key, { at: Date.now(), data });
  return data;
}

/** До 3 подобни продукта от публичния каталог (сървърно ранжиране). */
export async function getSimilarProducts(slug: string, limit = 3): Promise<CatalogProduct[]> {
  const res = await fetch(
    `/api/products/${encodeURIComponent(slug)}/similar?limit=${encodeURIComponent(String(limit))}`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !Array.isArray(json.data)) return [];
  return (json.data as ApiProduct[]).map(mapApiToCatalogProduct).filter((p) => !isAccessoryLike(p));
}

export async function rateProduct(
  productSlug: string,
  stars: number,
): Promise<
  | { ok: true; rating: number; reviewsCount: number }
  | { ok: false; code: 'ALREADY_RATED' | 'RATINGS_NOT_READY' | 'RATE_LIMIT_EXCEEDED' | 'UNKNOWN'; message: string }
> {
  const res = await fetch(`/api/products/${encodeURIComponent(productSlug)}/rating`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stars, website: '' }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.ok) {
    return {
      ok: true,
      rating: Number((json as any)?.data?.rating ?? 0),
      reviewsCount: Number((json as any)?.data?.reviewsCount ?? 0),
    };
  }
  const code = String((json as any)?.error ?? 'UNKNOWN');
  if (code === 'ALREADY_RATED' || code === 'RATINGS_NOT_READY' || code === 'RATE_LIMIT_EXCEEDED') {
    return { ok: false, code, message: code };
  }
  return { ok: false, code: 'UNKNOWN', message: code || 'UNKNOWN' };
}

function isAccessoryLike(p: CatalogProduct) {
  const t = (p.type ?? "").toLowerCase();
  const n = (p.name ?? "").toLowerCase();
  return t.includes("аксес") || t.includes("резерв") || n.includes("филтър") || n.includes("filter");
}

export interface CatalogListParams {
  q?: string;
  cat?: string;
  cond?: "new" | "used";
  brands?: string[];
  /** Номинали BTU (хиляди): 7, 9, 12… */
  btus?: number[];
  energyClasses?: string[];
  features?: string[];
  min?: number;
  max?: number;
  sort?: SortOption;
  page?: number;
  perPage?: number;
}

/** Една страница от каталога (филтри + сортиране на сървъра). */
export async function fetchProductsCatalogPage(
  params: CatalogListParams,
): Promise<{ data: CatalogProduct[]; meta: { page: number; perPage: number; total: number } }> {
  const sp = new URLSearchParams();
  if (params.q?.trim()) sp.set("q", params.q.trim());
  if (params.cat && params.cat !== "all") sp.set("cat", params.cat);
  if (params.cond) sp.set("cond", params.cond);
  if (params.brands?.length) sp.set("b", params.brands.join(","));
  if (params.btus?.length) sp.set("btu", params.btus.join(","));
  if (params.energyClasses?.length) sp.set("e", params.energyClasses.join(","));
  if (params.features?.length) sp.set("f", params.features.join(","));
  if (typeof params.min === "number") sp.set("min", String(params.min));
  if (typeof params.max === "number") sp.set("max", String(params.max));
  if (params.sort && params.sort !== DEFAULT_CATALOG_SORT) sp.set("s", params.sort);
  sp.set("page", String(params.page ?? 1));
  sp.set("perPage", String(params.perPage ?? 24));

  const res = await fetch(`/api/products?${sp.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Грешка при зареждане на продукти");
  const batch = (json.data ?? []) as ApiProduct[];
  return {
    data: batch.map(mapApiToCatalogProduct).filter((p) => !isAccessoryLike(p)),
    meta: json.meta ?? { page: 1, perPage: 24, total: 0 },
  };
}

/** Min/max цена в активния каталог (за слайдера). */
export async function fetchCatalogPriceBounds(cond?: "new" | "used"): Promise<{ min: number; max: number }> {
  const qp = cond ? `?cond=${cond}` : "";
  const res = await fetch(`/api/catalog/price-bounds${qp}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Грешка при ценови граници");
  const min = Number(json.min) || 0;
  const max = Number(json.max) || 0;
  if (min === 0 && max === 0) return { min: 0, max: 50_000 };
  return { min, max };
}

/**
 * Списък с активни марки в базата (с брой публично-видими продукти).
 * Опционално `onlyWithProducts` ограничава до марки с поне 1 продукт.
 */
export async function fetchCatalogBrandOptions(
  cond?: "new" | "used",
  opts?: { onlyWithProducts?: boolean },
): Promise<Array<{ name: string; productCount: number }>> {
  const sp = new URLSearchParams();
  if (cond) sp.set("cond", cond);
  if (opts?.onlyWithProducts !== false) sp.set("onlyWithProducts", "true");
  const qs = sp.toString();
  const res = await fetch(`/api/catalog/brand-options${qs ? `?${qs}` : ""}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Грешка при зареждане на марките");
  const data = (json.data ?? []) as Array<{ name: string; productCount: number }>;
  return data;
}

/** Налични номинали BTU в публичния каталог (с брой продукти). */
export async function fetchCatalogBtuOptions(
  cond?: "new" | "used",
  opts?: { onlyWithProducts?: boolean },
): Promise<Array<{ btu: number; productCount: number }>> {
  const sp = new URLSearchParams();
  if (cond) sp.set("cond", cond);
  if (opts?.onlyWithProducts !== false) sp.set("onlyWithProducts", "true");
  const qs = sp.toString();
  const res = await fetch(`/api/catalog/btu-options${qs ? `?${qs}` : ""}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Грешка при зареждане на BTU опции");
  return (json.data ?? []) as Array<{ btu: number; productCount: number }>;
}

/** Брой уникални модели по категория (един API вместо 6× /api/products). */
export async function fetchCategoryProductCounts(
  opts?: {
    cond?: "new" | "used";
    q?: string;
    brands?: string[];
    btus?: number[];
    energyClasses?: string[];
    features?: string[];
    min?: number;
    max?: number;
  },
): Promise<Record<string, number>> {
  const sp = new URLSearchParams();
  if (opts?.cond) sp.set("cond", opts.cond);
  if (opts?.q?.trim()) sp.set("q", opts.q.trim());
  if (opts?.brands?.length) sp.set("b", opts.brands.join(","));
  if (opts?.btus?.length) sp.set("btu", opts.btus.join(","));
  if (opts?.energyClasses?.length) sp.set("e", opts.energyClasses.join(","));
  if (opts?.features?.length) sp.set("f", opts.features.join(","));
  if (typeof opts?.min === "number") sp.set("min", String(opts.min));
  if (typeof opts?.max === "number") sp.set("max", String(opts.max));
  const qs = sp.toString();
  const res = await fetch(`/api/catalog/category-counts${qs ? `?${qs}` : ""}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Грешка при броене по категории");
  return (json.data ?? { all: 0 }) as Record<string, number>;
}

export type CatalogMeta = {
  priceBounds: { min: number; max: number };
  categoryCounts: Record<string, number>;
  brandOptions: Array<{ name: string; productCount: number }>;
  btuOptions: Array<{ btu: number; productCount: number }>;
};

/** Sidebar meta: цени, категории, марки, BTU — един HTTP round-trip. */
export async function fetchCatalogMeta(cond?: "new" | "used"): Promise<CatalogMeta> {
  const sp = cond ? `?cond=${cond}` : "";
  const res = await fetch(`/api/catalog/meta${sp}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Грешка при зареждане на филтрите");
  const data = json.data as CatalogMeta;
  const min = Number(data.priceBounds?.min) || 0;
  let max = Number(data.priceBounds?.max) || 0;
  if (min === 0 && max === 0) max = 50_000;
  return {
    priceBounds: { min, max },
    categoryCounts: data.categoryCounts ?? { all: 0 },
    brandOptions: data.brandOptions ?? [],
    btuOptions: data.btuOptions ?? [],
  };
}

// ──────────────────────────────────────
// CATEGORY METADATA
// ──────────────────────────────────────

export const CATEGORIES: CategoryMeta[] = [
  {
    id: 'all',
    label: 'Всички',
    icon: 'LayoutGrid',
    accentColor: '#6B7280',
    types: [],
  },
  {
    id: 'wall',
    label: 'Стенни климатици',
    shortLabel: 'Стенни',
    icon: 'Home',
    accentColor: '#FF4D00',
    types: ['Стенен климатик', 'Дизайнерски климатик'],
  },
  {
    id: 'multi',
    label: 'Мулти-сплит системи',
    icon: 'Layers',
    accentColor: '#00B4D8',
    types: ['Мулти-сплит система'],
  },
  {
    id: 'cassette',
    label: 'Касетни климатици',
    shortLabel: 'Касетни',
    icon: 'Building2',
    accentColor: '#7C3AED',
    types: ['Касетъчен климатик'],
  },
  {
    id: 'floor',
    label: 'Подови климатици',
    shortLabel: 'Подови',
    icon: 'ArrowDown',
    accentColor: '#0D9488',
    types: ['Подов климатик'],
  },
  {
    id: 'column',
    label: 'Колонни климатици',
    shortLabel: 'Колонни',
    icon: 'Columns',
    accentColor: '#6366F1',
    types: ['Колонен климатик'],
  },
  {
    id: 'ceiling',
    label: 'Таванни климатици',
    shortLabel: 'Таванни',
    icon: 'ArrowUpFromLine',
    accentColor: '#0891B2',
    types: ['Таванен климатик'],
  },
];

// ──────────────────────────────────────
// BRAND METADATA
// ──────────────────────────────────────

export const BRANDS: BrandMeta[] = [
  { id: 'daikin',             name: 'Daikin',              color: '#0033A0' },
  { id: 'mitsubishi-electric', name: 'Mitsubishi Electric', color: '#E50012' },
  { id: 'mitsubishi-heavy',   name: 'Mitsubishi Heavy',    color: '#B00020' },
  { id: 'samsung',            name: 'Samsung',             color: '#1428A0' },
  { id: 'lg',                 name: 'LG',                  color: '#A50034' },
  { id: 'fujitsu',            name: 'Fujitsu',             color: '#FF0000' },
  { id: 'gree',               name: 'Gree',                color: '#00A84F' },
  { id: 'panasonic',          name: 'Panasonic',           color: '#003087' },
  { id: 'hitachi',            name: 'Hitachi',             color: '#CC0000' },
  { id: 'carrier',            name: 'Carrier',             color: '#003087' },
  { id: 'toshiba',            name: 'Toshiba',             color: '#FF0000' },
];
