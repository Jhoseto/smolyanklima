import type { CatalogProduct } from '../../../data/types/product';
import type { Product, RoomType } from '../types';

const energyEfficiencyMap: Record<string, number> = {
  'A+++': 8.5,
  'A++': 7.5,
  'A+': 6.5,
  A: 5.5,
  B: 4.5,
};

const categoryToRoom: Record<string, RoomType[]> = {
  '—': ['other'],
  Апартамент: ['bedroom', 'living'],
  Къща: ['living', 'bedroom'],
  Офис: ['office'],
  Търговски: ['office'],
  Аксесоари: ['other'],
  Части: ['other'],
};

function parseNum(s: string | undefined, fallback: number) {
  const m = s?.match(/([\d.]+)/);
  return m ? parseFloat(m[1]) : fallback;
}

function parseIntLoose(s: string | undefined, fallback: number) {
  const m = s?.match(/([\d]+)/);
  return m ? parseInt(m[1], 10) : fallback;
}

/** Maps API-backed catalog rows to the AI assistant `Product` shape. */
export function catalogProductsToAI(products: CatalogProduct[]): Product[] {
  return products.map((p) => {
    const coolingCapacity = parseNum(p.coolingPower, 2.5);
    const heatingCapacity = parseNum(p.heatingPower, 3.2);
    const noiseLevel = parseIntLoose(p.noise, 25);
    const coverage = parseIntLoose(p.area, 25);
    const energyEfficiency = energyEfficiencyMap[p.energyCool || 'A'] ?? 6.5;
    const warrantyYears = parseIntLoose(p.warranty, 2);

    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      model: p.type || p.id,
      price: p.price,
      oldPrice: undefined,
      image: p.image,
      description: p.description || '',
      specs: {
        power: p.coolingPower || `${coolingCapacity} kW`,
        coolingCapacity,
        heatingCapacity,
        noiseLevel,
        energyEfficiency,
        seer: energyEfficiency,
        coverage,
      },
      features: p.features || [],
      inStock: p.inStock,
      stockCount: 5,
      rating: p.rating,
      reviewCount: p.reviews,
      energyClass: p.energyCool || 'A',
      warranty: {
        years: warrantyYears,
        compressor: warrantyYears + 2,
        parts: warrantyYears,
        labor: Math.max(0, warrantyYears - 1),
      },
      suitableFor: categoryToRoom[p.category] || ['other'],
      popularityScore: Math.round((p.rating / 5) * 100),
    };
  });
}
