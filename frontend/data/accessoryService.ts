import type { CatalogProduct, ProductSpec, ProductBadge } from './types/product';

type ApiAccessory = {
  slug: string;
  name: string;
  description?: string | null;
  price: number;
  old_price?: number | null;
  kind?: 'accessory' | 'spare_part' | string | null;
  brands?: { name: string } | null;
  accessory_images?: Array<{ url: string; is_main: boolean; sort_order: number }> | null;
};

function fakeRating(seed: string): { rating: number; reviews: number } {
  const hash = seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const rating = +(4.6 + (hash % 4) * 0.1).toFixed(1);
  const reviews = 8 + (hash % 60);
  return { rating, reviews };
}

function resolveKindLabel(kind?: string | null): string {
  if (!kind) return 'Аксесоар';
  if (kind === 'spare_part') return 'Резервна част';
  return kind;
}

function resolveSpecs(): ProductSpec[] {
  return [];
}

function resolveBadge(kind?: string | null): ProductBadge | undefined {
  if (kind === 'spare_part') return { text: 'Оригинал', bg: 'bg-blue-100', textCol: 'text-blue-700' };
  return { text: 'Аксесоар', bg: 'bg-green-100', textCol: 'text-green-700' };
}

function mapApiToCatalogAccessory(raw: ApiAccessory): CatalogProduct {
  const brand = raw.brands?.name ?? '—';
  const image =
    (raw.accessory_images ?? [])
      .slice()
      .sort((a, b) => (b.is_main ? 1 : 0) - (a.is_main ? 1 : 0) || a.sort_order - b.sort_order)[0]
      ?.url ?? `/images/${raw.slug}.jpg`;
  const { rating, reviews } = fakeRating(raw.slug);

  const kindLabel = resolveKindLabel(raw.kind);
  return {
    id: raw.slug,
    name: raw.name,
    brand,
    model: raw.name,
    type: kindLabel,
    category: '—',

    image,
    imgBg: 'bg-gray-50',
    cardBorder: 'border-gray-200',

    energyClass: '—',
    specs: resolveSpecs(),
    extras: [],
    area: undefined,
    noise: undefined,
    wifi: undefined,
    warranty: undefined,
    description: raw.description ?? undefined,
    refrigerant: undefined,
    coolingPower: undefined,
    heatingPower: undefined,

    price: Number(raw.price),
    priceWithMount: Number(raw.price),

    rating,
    reviews,

    badge: resolveBadge(raw.kind),
    inStock: true,

    features: [],
    energyCool: undefined,
    energyHeat: undefined,
  };
}

export async function getAllAccessories(): Promise<CatalogProduct[]> {
  const all: CatalogProduct[] = [];
  let page = 1;
  const perPage = 100;
  for (;;) {
    const res = await fetch(`/api/accessories?page=${page}&perPage=${perPage}`);
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Грешка при зареждане на аксесоари');
    const batch = (json.data ?? []) as ApiAccessory[];
    all.push(...batch.map(mapApiToCatalogAccessory));
    if (batch.length < perPage) break;
    page += 1;
  }
  return all;
}

export async function getAccessoryById(id: string): Promise<CatalogProduct | undefined> {
  const res = await fetch(`/api/accessories/${encodeURIComponent(id)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Грешка при зареждане на аксесоар');
  if (!json.data) return undefined;
  return mapApiToCatalogAccessory(json.data as ApiAccessory);
}

