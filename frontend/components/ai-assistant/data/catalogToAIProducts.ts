import type { CatalogProduct } from '../../../data/types/product';
import type { Product, RoomType } from '../types';

const BTU_OPTIONS = [7, 9, 12, 14, 18, 22, 24, 30, 36, 45, 48, 54, 60, 72, 90] as const;

const typeToRoom: Record<string, RoomType[]> = {
  'Стенен климатик': ['bedroom', 'living'],
  'Дизайнерски климатик': ['living', 'bedroom'],
  'Мулти-сплит система': ['living', 'office'],
  'Касетъчен климатик': ['office'],
  'Подов климатик': ['living', 'office'],
  'Колонен климатик': ['office', 'other'],
  'Таванен климатик': ['office'],
};

function parseNum(s: string | undefined, fallback: number): number {
  const m = s?.match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : fallback;
}

function parseIntLoose(s: string | undefined, fallback: number): number {
  const m = s?.match(/([\d]+)/);
  return m ? parseInt(m[1], 10) : fallback;
}

function inferBtuFromCoolingKw(coolingKw: number): number | undefined {
  if (!Number.isFinite(coolingKw) || coolingKw <= 0) return undefined;
  const nominal = Math.round((coolingKw / 2.64) * 9);
  let best: number | undefined;
  let bestDiff = Infinity;
  for (const opt of BTU_OPTIONS) {
    const diff = Math.abs(opt - nominal);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = opt;
    }
  }
  return bestDiff <= 3 ? best : undefined;
}

function formatDimensions(p: CatalogProduct): string | undefined {
  const parts: string[] = [];
  const inD = p.dimensions?.indoor;
  const outD = p.dimensions?.outdoor;
  if (inD?.lengthMm || inD?.widthMm || inD?.heightMm) {
    parts.push(
      `вътр.${[inD.lengthMm, inD.widthMm, inD.heightMm].filter(Boolean).join('×')}mm`,
    );
  }
  if (outD?.lengthMm || outD?.widthMm || outD?.heightMm) {
    parts.push(
      `външ.${[outD.lengthMm, outD.widthMm, outD.heightMm].filter(Boolean).join('×')}mm`,
    );
  }
  return parts.length ? parts.join('; ') : undefined;
}

function formatWeights(p: CatalogProduct): string | undefined {
  const parts: string[] = [];
  if (p.weightIndoorKg != null) parts.push(`вътр.${p.weightIndoorKg}kg`);
  if (p.weightOutdoorKg != null) parts.push(`външ.${p.weightOutdoorKg}kg`);
  return parts.length ? parts.join(', ') : undefined;
}

function resolveSuitableFor(type: string): RoomType[] {
  for (const [key, rooms] of Object.entries(typeToRoom)) {
    if (type.includes(key.replace(' климатик', '').split('-')[0])) return rooms;
  }
  if (type.includes('Стенен') || type.includes('Дизайнер')) return ['bedroom', 'living'];
  if (type.includes('Офис') || type.includes('Касет') || type.includes('Таван')) return ['office'];
  return ['other'];
}

/** Maps public catalog rows to the AI assistant `Product` shape with full specs. */
export function catalogProductsToAI(products: CatalogProduct[]): Product[] {
  return products.map((p) => {
    const coolingCapacity = parseNum(p.coolingPower, 0);
    const heatingCapacity = parseNum(p.heatingPower, 0);
    const noiseLevel = parseIntLoose(p.noise, 0);
    const coverage = parseIntLoose(p.area, 0);
    const seer = p.seer ?? 0;
    const scop = p.scop ?? 0;
    const warrantyYears = Math.max(1, parseIntLoose(p.warranty, 2));
    const warrantyMonths = warrantyYears * 12;
    const btu = coolingCapacity > 0 ? inferBtuFromCoolingKw(coolingCapacity) : undefined;

    return {
      id: p.id,
      slug: p.id,
      name: p.name,
      brand: p.brand,
      model: p.name,
      type: p.type || '—',
      condition: p.condition,
      price: p.price,
      priceWithMount: p.priceWithMount,
      image: p.image,
      description: p.description || '',
      specs: {
        power: p.coolingPower || (coolingCapacity ? `${coolingCapacity} kW` : '—'),
        coolingCapacity,
        heatingCapacity,
        noiseLevel,
        energyEfficiency: seer,
        seer,
        scop,
        coverage,
        btu,
        refrigerant: p.refrigerant,
        wifi: p.wifi,
        energyClassHeat: p.energyHeat,
      },
      features: p.features || [],
      inStock: p.inStock,
      rating: p.rating,
      reviewCount: p.reviews,
      energyClass: p.energyCool || p.energyClass || '—',
      energyClassHeat: p.energyHeat,
      refrigerant: p.refrigerant,
      wifi: p.wifi,
      dimensions: formatDimensions(p),
      weights: formatWeights(p),
      warranty: {
        years: warrantyYears,
        months: warrantyMonths,
        compressor: warrantyYears + 2,
        parts: warrantyYears,
        labor: Math.max(0, warrantyYears - 1),
      },
      suitableFor: resolveSuitableFor(p.type),
      popularityScore: Math.round((p.rating / 5) * 100),
    };
  });
}
