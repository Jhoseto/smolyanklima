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

// ──────────────────────────────────────
// IMAGE POOL (6 налични снимки за всички продукти)
// При backend → снимките идват от API/CDN
// ──────────────────────────────────────

function resolveBorderAndBg(brand: string): { cardBorder: string; imgBg: string } {
  const brandLower = brand.toLowerCase();
  if (brandLower.includes('daikin'))    return { cardBorder: 'border-blue-200 shadow-blue-50', imgBg: 'bg-gray-50' };
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

function resolveBadge(product: { slug: string; price: number; energyCool?: string; features: string[] }): ProductBadge | undefined {
  const features = product.features ?? [];
  if (product.slug.includes('perfera') || product.slug.includes('ln25')) {
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

// ──────────────────────────────────────
// PRICE WITH MOUNT
// ──────────────────────────────────────

function resolveInstallPrice(product: { type?: string; price: number }): number {
  const type = product.type ?? '';
  if (type.includes('Мулти')) return product.price + 250;
  if (type.includes('Касетъ')) return product.price + 350;
  if (type.includes('Подов')) return product.price + 200;
  return product.price + 150; // стенен / default
}

// ──────────────────────────────────────
// MAIN MAPPING FUNCTION
// ──────────────────────────────────────

type ApiProduct = {
  slug: string;
  name: string;
  description?: string | null;
  price: number;
  brands?: { name: string } | null;
  product_types?: { name: string } | null;
  product_specs?: Array<{
    coverage_m2?: number | null;
    noise_db?: number | null;
    cooling_power_kw?: number | null;
    heating_power_kw?: number | null;
    refrigerant?: string | null;
    wifi?: boolean | null;
    energy_class_cool?: string | null;
    energy_class_heat?: string | null;
    warranty_months?: number | null;
  }> | null;
  product_images?: Array<{ url: string; is_main: boolean; sort_order: number }> | null;
  product_features?: Array<{ features?: { name?: string } | null }> | null;
};

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
  const image = sortedImages[0] ?? `/images/${raw.slug}.jpg`;

  const { cardBorder, imgBg } = resolveBorderAndBg(brand);
  const { rating, reviews } = fakeRating(raw.slug);

  const coolingPower = specs0?.cooling_power_kw ? `${specs0.cooling_power_kw} kW` : undefined;
  const heatingPower = specs0?.heating_power_kw ? `${specs0.heating_power_kw} kW` : undefined;
  const noise = specs0?.noise_db ? `${specs0.noise_db} dB` : undefined;
  const area = specs0?.coverage_m2 ? `до ${Math.round(specs0.coverage_m2)} м²` : undefined;
  const warranty = specs0?.warranty_months ? `${Math.round(specs0.warranty_months / 12)} г. гаранция` : undefined;

  return {
    id: raw.slug,
    name: raw.name,
    brand,
    model: raw.name,
    type,
    category: '—',

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

    price: Number(raw.price),
    priceWithMount: resolveInstallPrice({ type, price: Number(raw.price) }),

    rating,
    reviews,

    badge: resolveBadge({ slug: raw.slug, price: Number(raw.price), energyCool, features }),
    inStock: true,

    features,
    energyCool,
    energyHeat,
  };
}

// ──────────────────────────────────────
// PUBLIC SERVICE FUNCTIONS
// ── Замени САМО ТУК при реален backend ──
// ──────────────────────────────────────

/** Всички продукти */
export async function getAllProducts(): Promise<CatalogProduct[]> {
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
        // Каталогът показва основните продукти (климатици). Аксесоари/части се отделят по-късно.
        .filter((p) => !isAccessoryLike(p)),
    );
    if (batch.length < perPage) break;
    page += 1;
  }
  return all;
}

/** Един продукт по ID */
export async function getProductById(id: string): Promise<CatalogProduct | undefined> {
  const res = await fetch(`/api/products/${encodeURIComponent(id)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Грешка при зареждане на продукт');
  if (!json.data) return undefined;
  return mapApiToCatalogProduct(json.data as ApiProduct);
}

function isAccessoryLike(p: CatalogProduct) {
  const t = (p.type ?? "").toLowerCase();
  const n = (p.name ?? "").toLowerCase();
  return t.includes("аксес") || t.includes("резерв") || n.includes("филтър") || n.includes("filter");
}

export interface CatalogListParams {
  q?: string;
  cat?: string;
  brands?: string[];
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
  if (params.brands?.length) sp.set("b", params.brands.join(","));
  if (params.energyClasses?.length) sp.set("e", params.energyClasses.join(","));
  if (params.features?.length) sp.set("f", params.features.join(","));
  if (typeof params.min === "number") sp.set("min", String(params.min));
  if (typeof params.max === "number") sp.set("max", String(params.max));
  if (params.sort && params.sort !== "recommended") sp.set("s", params.sort);
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
export async function fetchCatalogPriceBounds(): Promise<{ min: number; max: number }> {
  const res = await fetch("/api/catalog/price-bounds");
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Грешка при ценови граници");
  const min = Number(json.min) || 0;
  const max = Number(json.max) || 0;
  if (min === 0 && max === 0) return { min: 0, max: 50_000 };
  return { min, max };
}

/** Брой продукти по категория (без други филтри), за чиповете. */
export async function fetchCategoryProductCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = { all: 0 };
  const [allRes, ...perCat] = await Promise.all([
    fetchProductsCatalogPage({ page: 1, perPage: 1 }),
    ...CATEGORIES.filter((c) => c.id !== "all").map((c) =>
      fetchProductsCatalogPage({ cat: c.id, page: 1, perPage: 1 }),
    ),
  ]);
  counts.all = allRes.meta.total;
  CATEGORIES.filter((c) => c.id !== "all").forEach((c, i) => {
    counts[c.id] = perCat[i]?.meta.total ?? 0;
  });
  return counts;
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
    icon: 'Building2',
    accentColor: '#7C3AED',
    types: ['Касетъчен климатик'],
  },
  {
    id: 'floor',
    label: 'Подови климатици',
    icon: 'ArrowDown',
    accentColor: '#0D9488',
    types: ['Подов климатик'],
  },
  {
    id: 'office',
    label: 'Офис системи',
    icon: 'Briefcase',
    accentColor: '#2563EB',
    types: ['Офис климатик'],
  },
];

// ──────────────────────────────────────
// BRAND METADATA
// ──────────────────────────────────────

export const BRANDS: BrandMeta[] = [
  { id: 'daikin',      name: 'Daikin',             color: '#0033A0' },
  { id: 'mitsubishi',  name: 'Mitsubishi Electric', color: '#E50012' },
  { id: 'samsung',     name: 'Samsung',             color: '#1428A0' },
  { id: 'lg',          name: 'LG',                  color: '#A50034' },
  { id: 'fujitsu',     name: 'Fujitsu',             color: '#FF0000' },
  { id: 'gree',        name: 'Gree',                color: '#00A84F' },
  { id: 'panasonic',   name: 'Panasonic',           color: '#003087' },
  { id: 'hitachi',     name: 'Hitachi',             color: '#CC0000' },
  { id: 'carrier',     name: 'Carrier',             color: '#003087' },
  { id: 'toshiba',     name: 'Toshiba',             color: '#FF0000' },
];
