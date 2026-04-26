/**
 * productService.ts – Изолиращ слой между данните и UI компонентите
 * ──────────────────────────────────────────────────────────────────
 * ВАЖНО: UI компонентите НИКОГА не четат директно от db.ts или products масива.
 * Те извикват само функциите от този файл.
 *
 * За смяна с реален backend: замени само тялото на функциите тук.
 * Нищо друго в UI не се пипа.
 */

import { products as rawProducts } from './db';
import type {
  DbProduct,
  CatalogProduct,
  CatalogFilters,
  ProductSpec,
  ProductBadge,
  CategoryMeta,
  BrandMeta,
} from './types/product';

// ──────────────────────────────────────
// IMAGE POOL (6 налични снимки за всички продукти)
// При backend → снимките идват от API/CDN
// ──────────────────────────────────────

const IMAGE_POOL = [
  '/images/daikin-perfera.jpg',
  '/images/daikin-sensira.jpg',
  '/images/fujitsu-asyg.jpg',
  '/images/gree-fairy.jpg',
  '/images/mitsubishi-msz.jpg',
  '/images/samsung-windfree.jpg',
];

/** Детерминирано (стабилно при всяко зареждане) разпределение по ID hash */
function resolveImage(id: string): string {
  const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return IMAGE_POOL[hash % IMAGE_POOL.length];
}

// ──────────────────────────────────────
// CARD BORDER & BG MAP
// ──────────────────────────────────────

function resolveBorderAndBg(brand: string, energyCool?: string): { cardBorder: string; imgBg: string } {
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

function resolveBadge(product: DbProduct): ProductBadge | undefined {
  const features = product.features ?? [];
  if (product.id.includes('perfera') || product.id.includes('ln25')) {
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

function resolveSpecs(product: DbProduct): ProductSpec[] {
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

function fakeRating(id: string): { rating: number; reviews: number } {
  const hash = id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rating = +(4.5 + (hash % 5) * 0.1).toFixed(1);
  const reviews = 15 + (hash % 100);
  return { rating, reviews };
}

// ──────────────────────────────────────
// PRICE WITH MOUNT
// ──────────────────────────────────────

function resolveInstallPrice(product: DbProduct): number {
  const type = product.type ?? '';
  if (type.includes('Мулти')) return product.price + 250;
  if (type.includes('Касетъ')) return product.price + 350;
  if (type.includes('Подов')) return product.price + 200;
  return product.price + 150; // стенен / default
}

// ──────────────────────────────────────
// MAIN MAPPING FUNCTION
// ──────────────────────────────────────

function mapToCatalogProduct(raw: DbProduct): CatalogProduct {
  const { cardBorder, imgBg } = resolveBorderAndBg(raw.brand, raw.energyCool);
  const { rating, reviews } = fakeRating(raw.id);

  return {
    id: raw.id,
    name: raw.name,
    brand: raw.brand,
    model: raw.name,
    type: raw.type,
    category: raw.category,

    image: resolveImage(raw.id),
    imgBg,
    cardBorder,

    energyClass: raw.energyCool ?? 'A+',
    specs: resolveSpecs(raw),
    extras: (raw.features ?? []).slice(0, 4),
    area: raw.area,
    noise: raw.noise,
    wifi: raw.wifi,
    warranty: raw.warranty,
    description: raw.description,
    refrigerant: raw.refrigerant,
    coolingPower: raw.coolingPower,
    heatingPower: raw.heatingPower,

    price: raw.price,
    priceWithMount: resolveInstallPrice(raw),

    rating,
    reviews,

    badge: resolveBadge(raw),
    inStock: true, // временно, при backend → реална наличност

    features: raw.features ?? [],
    energyCool: raw.energyCool,
    energyHeat: raw.energyHeat,
  };
}

// ──────────────────────────────────────
// CACHED MAPPED PRODUCTS
// ──────────────────────────────────────

const catalogProducts: CatalogProduct[] = (rawProducts as DbProduct[])
  // Пропускаме аксесоари и части за сега (без energyCool)
  // При backend → отделни endpoint-и
  .filter(p => p.type && !p.type.includes('Аксесоар') && !p.type.includes('Резерв'))
  .map(mapToCatalogProduct);

// ──────────────────────────────────────
// PUBLIC SERVICE FUNCTIONS
// ── Замени САМО ТУК при реален backend ──
// ──────────────────────────────────────

/** Всички продукти */
export function getAllProducts(): CatalogProduct[] {
  // При backend → return await fetch('/api/products').then(r => r.json())
  return catalogProducts;
}

/** Един продукт по ID */
export function getProductById(id: string): CatalogProduct | undefined {
  // При backend → return await fetch(`/api/products/${id}`).then(r => r.json())
  return catalogProducts.find(p => p.id === id);
}

/** Продукти по тип (категория) */
export function getProductsByType(type: string): CatalogProduct[] {
  if (type === 'all') return catalogProducts;
  return catalogProducts.filter(p => p.type === type);
}

/** Продукти по марка */
export function getProductsByBrand(brand: string): CatalogProduct[] {
  return catalogProducts.filter(p => p.brand.toLowerCase() === brand.toLowerCase());
}

/** Всички уникални марки */
export function getAllBrands(): string[] {
  return [...new Set(catalogProducts.map(p => p.brand))].sort();
}

/** Ценови диапазон (min/max) */
export function getPriceRange(): { min: number; max: number } {
  const prices = catalogProducts.map(p => p.price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Комплексно филтриране + сортиране */
export function getFilteredProducts(filters: Partial<CatalogFilters>): CatalogProduct[] {
  let result = [...catalogProducts];

  // Search
  if (filters.search && filters.search.trim()) {
    const q = filters.search.toLowerCase().trim();
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.brand.toLowerCase().includes(q) ||
      p.type.toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q)
    );
  }

  // Brands
  if (filters.brands && filters.brands.length > 0) {
    result = result.filter(p =>
      filters.brands!.some(b => p.brand.toLowerCase().includes(b.toLowerCase()))
    );
  }

  // Types
  if (filters.types && filters.types.length > 0) {
    result = result.filter(p => filters.types!.includes(p.type));
  }

  // Energy classes
  if (filters.energyClasses && filters.energyClasses.length > 0) {
    result = result.filter(p => filters.energyClasses!.includes(p.energyClass));
  }

  // Features (WiFi, etc.)
  if (filters.features && filters.features.length > 0) {
    result = result.filter(p =>
      filters.features!.every(f =>
        p.features.some(pf => pf.toLowerCase().includes(f.toLowerCase()))
      )
    );
  }

  // Price range
  if (filters.priceMin !== undefined) {
    result = result.filter(p => p.price >= filters.priceMin!);
  }
  if (filters.priceMax !== undefined) {
    result = result.filter(p => p.price <= filters.priceMax!);
  }

  // Sort
  switch (filters.sortBy) {
    case 'price-asc':
      result.sort((a, b) => a.price - b.price);
      break;
    case 'price-desc':
      result.sort((a, b) => b.price - a.price);
      break;
    case 'energy-class':
      result.sort((a, b) => a.energyClass.localeCompare(b.energyClass));
      break;
    case 'noise-asc':
      result.sort((a, b) => {
        const noiseA = parseInt(a.noise ?? '99');
        const noiseB = parseInt(b.noise ?? '99');
        return noiseA - noiseB;
      });
      break;
    case 'rating-desc':
      result.sort((a, b) => b.rating - a.rating);
      break;
    default: // 'recommended' – no change
      break;
  }

  return result;
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
