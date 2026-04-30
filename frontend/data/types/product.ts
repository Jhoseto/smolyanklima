/**
 * TypeScript интерфейси за каталога на SmolyanKlima
 * ─────────────────────────────────────────────────
 * DbProduct → оригиналната структура от db.ts (временна за тестване)
 * CatalogProduct → пълна карта-ready структура, използвана от UI компонентите
 *
 * Когато се добави реален backend, заменя се само productService.ts
 * UI компонентите остават НЕПРОМЕНЕНИ.
 */

// ──────────────────────────────────────
// RAW DB STRUCTURE (от db.ts)
// ──────────────────────────────────────

export interface DbProduct {
  id: string;
  name: string;
  brand: string;
  type: string;             // 'Стенен климатик', 'Мулти-сплит система', etc.
  category: string;         // 'Апартамент', 'Къща', 'Офис', 'Търговски'
  area?: string;            // 'до 25 м²'
  energyCool?: string;      // 'A+++'
  energyHeat?: string;      // 'A++'
  noise?: string;           // '19 dB'
  coolingPower?: string;    // '2.5 kW'
  heatingPower?: string;    // '3.2 kW'
  refrigerant?: string;     // 'R-32'
  wifi?: boolean;
  warranty?: string;        // '3 г. гаранция'
  description?: string;
  features?: string[];      // ['Инвертор', 'WiFi управление', ...]
  price: number;            // EUR (converted from BGN at 1.95 rate)
}

// ──────────────────────────────────────
// CARD-READY STRUCTURE (за UI компоненти)
// ──────────────────────────────────────

export interface ProductSpec {
  icon: string;   // emoji или lucide icon name
  text: string;
}

export interface ProductBadge {
  text: string;
  bg: string;       // Tailwind class, e.g. 'bg-yellow-100'
  textCol: string;  // Tailwind class, e.g. 'text-yellow-700'
}

export interface CatalogProduct {
  // Core identity
  id: string;
  name: string;
  brand: string;
  model: string;        // Same as name, for display
  type: string;
  category: string;
  condition: "new" | "used";

  // Display & media
  image: string;        // Resolved path to image
  images?: string[];    // Optional gallery (main first)
  imgBg: string;        // Background color for image area
  cardBorder: string;   // Border/shadow class for the card

  // Energy & specs
  energyClass: string;  // Derived from energyCool
  specs: ProductSpec[]; // Up to 3 icons with text
  extras: string[];     // Feature chips (from features[])
  area?: string;
  noise?: string;
  wifi?: boolean;
  warranty?: string;
  description?: string;
  refrigerant?: string;
  coolingPower?: string;
  heatingPower?: string;

  // Pricing
  price: number;           // EUR, base price (converted from BGN at 1.95 rate)
  priceWithMount: number;  // EUR, price including installation

  // Social proof (hardcoded until backend)
  rating: number;
  reviews: number;

  // UI state
  badge?: ProductBadge;
  inStock: boolean;

  // For filtering
  features: string[];      // Full features list
  energyCool?: string;
  energyHeat?: string;
}

// ──────────────────────────────────────
// FILTER STATE
// ──────────────────────────────────────

export interface CatalogFilters {
  search: string;
  brands: string[];
  categories: string[];
  types: string[];
  energyClasses: string[];
  features: string[];
  priceMin: number;
  priceMax: number;
  inStock: boolean | null;
  sortBy: SortOption;
}

export type SortOption =
  | 'recommended'
  | 'price-asc'
  | 'price-desc'
  | 'energy-class'
  | 'noise-asc'
  | 'rating-desc';

// ──────────────────────────────────────
// CATEGORY & BRAND METADATA
// ──────────────────────────────────────

export interface CategoryMeta {
  id: string;
  label: string;
  icon: string;       // Lucide icon name
  accentColor: string;
  types: string[];    // Which `type` values belong here
}

export interface BrandMeta {
  id: string;
  name: string;
  color: string;      // Brand accent color
  logo?: string;      // Optional logo path
}
