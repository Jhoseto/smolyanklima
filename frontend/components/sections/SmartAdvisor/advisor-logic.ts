import type { CatalogProduct } from '../../../data/types/product';
import type { WizardAnswers, ScoredProduct, ResultTier } from './types';

// ── Area → required kW cooling power ──────────────────────────────────────────
const AREA_TO_KW: Record<string, number> = {
  tiny:   2.5,   // до 20 м²
  small:  3.2,   // 20–30 м²
  medium: 4.5,   // 30–45 м²
  large:  6.0,   // 45–60 м²
  xlarge: 8.0,   // над 60 м²
};

// ── Budget → EUR max price ─────────────────────────────────────────────────────
const BUDGET_MAX_EUR: Record<string, number> = {
  budget:  461,   // до ~900 лв.
  mid:     718,   // 900–1400 лв.
  comfort: 1128,  // 1400–2200 лв.
  premium: 9999,  // над 2200 лв.
};

// ── Installation cost calculation (in EUR) ─────────────────────────────────────
const FLOOR_EXTRA: Record<string, number> = {
  ground: 0,
  low:    0,
  mid:    40,
  high:   100,
};

const BUILDING_EXTRA: Record<string, number> = {
  panel:  10,
  brick:  0,
  house:  0,
  office: 25,
  new:    -10,
};

export function calcInstallCost(
  product: CatalogProduct,
  floor?: string,
  buildingType?: string,
): number {
  const base = product.type?.includes('Мулти') ? 250
    : product.type?.includes('Касетъ') ? 350
    : 150;
  const floorExtra = FLOOR_EXTRA[floor ?? 'ground'] ?? 0;
  const buildingExtra = BUILDING_EXTRA[buildingType ?? 'brick'] ?? 0;
  return base + floorExtra + buildingExtra;
}

// ── Parse product area ceiling from string ────────────────────────────────────
function parseProductMaxArea(areaStr?: string): number {
  if (!areaStr) return 35;
  const nums = areaStr.match(/\d+/g);
  if (!nums) return 35;
  return Math.max(...nums.map(Number));
}

// ── Parse cooling kW from string ──────────────────────────────────────────────
function parsekW(kwStr?: string): number {
  if (!kwStr) return 3.5;
  const m = kwStr.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : 3.5;
}

// ── Estimated annual savings vs A-class unit (EUR/year) ──────────────────────
export function calcAnnualSavings(product: CatalogProduct): number {
  const ec = product.energyClass ?? '';
  if (ec.includes('A+++')) return 85;
  if (ec.includes('A++')) return 55;
  if (ec.includes('A+')) return 30;
  return 0;
}

// ── Main scoring function ──────────────────────────────────────────────────────
export function scoreProduct(product: CatalogProduct, answers: WizardAnswers): {
  score: number;
  reasons: string[];
} {
  let score = 0;
  const reasons: string[] = [];

  // 1. Area / power match (25 pts)
  if (answers.area) {
    const neededKW = AREA_TO_KW[answers.area] ?? 3.5;
    const productKW = parsekW(product.coolingPower);
    const productMaxArea = parseProductMaxArea(product.area);
    const areaNeeded = { tiny: 20, small: 30, medium: 45, large: 60, xlarge: 80 }[answers.area] ?? 40;

    if (productMaxArea >= areaNeeded && productKW >= neededKW * 0.85) {
      score += 25;
      reasons.push(`Покрива помещение до ${productMaxArea} м²`);
    } else if (productKW >= neededKW * 0.7) {
      score += 12;
    }
  }

  // 2. Budget fit (20 pts)
  if (answers.budget) {
    const maxEur = BUDGET_MAX_EUR[answers.budget] ?? 9999;
    if (product.price <= maxEur) {
      score += 20;
    } else if (product.price <= maxEur * 1.15) {
      score += 8;
    }
  }

  // 3. Priorities (up to 30 pts, 10 each)
  const prios = answers.priorities ?? [];
  for (const p of prios) {
    if (p === 'quiet') {
      const db = parseFloat(product.noise ?? '99');
      if (db <= 20) { score += 10; reasons.push('Ултра тих — ≤ 20 dB'); }
      else if (db <= 24) { score += 5; }
    }
    if (p === 'efficiency') {
      const ec = product.energyClass ?? '';
      if (ec.includes('A+++')) { score += 10; reasons.push('A+++ енергиен клас'); }
      else if (ec.includes('A++')) { score += 7; reasons.push('A++ енергиен клас'); }
    }
    if (p === 'wifi') {
      if (product.wifi) { score += 10; reasons.push('WiFi управление включено'); }
    }
    if (p === 'purification') {
      if (product.features?.some(f => /фил|purif|pm2|hepa|clean/i.test(f))) {
        score += 10; reasons.push('Пречистване на въздух');
      } else {
        score += 2;
      }
    }
    if (p === 'design') {
      if (product.type?.includes('Стенен')) { score += 7; }
    }
    if (p === 'fast') {
      score += 5;
    }
  }

  // 4. Usage match (15 pts)
  if (answers.usage) {
    const hasInverter = product.features?.some(f => /инвертор/i.test(f));
    if (answers.usage === 'heating' || answers.usage === 'both') {
      if (hasInverter) { score += 15; reasons.push('Инверторна технология за отопление'); }
      else { score += 5; }
    } else {
      score += 10; // cooling only — all units work
    }
  }

  // 5. Room type bonus (10 pts)
  if (answers.roomType) {
    const cat = product.category ?? '';
    const type = product.type ?? '';
    if (answers.roomType === 'commercial' && (cat.includes('Търговски') || type.includes('Касетъ'))) {
      score += 10; reasons.push('Подходящ за търговски обект');
    } else if (answers.roomType === 'office' && (cat.includes('Офис') || cat.includes('Търговски'))) {
      score += 10; reasons.push('Офис серия');
    } else if (['bedroom', 'kids', 'living'].includes(answers.roomType) && cat.includes('Апартамент')) {
      score += 10; reasons.push('Идеален за дома');
    } else if (answers.roomType === 'kids') {
      // extra bonus for quiet & purification
      if (product.wifi) score += 3;
    }
  }

  // 6. Building type bonus (5 pts)
  if (answers.buildingType) {
    if (answers.buildingType === 'office' && product.type?.includes('Касетъ')) {
      score += 5; reasons.push('Касетъчен монтаж за офис');
    } else if (answers.buildingType === 'house' && product.type?.includes('Мулти')) {
      score += 5; reasons.push('Мулти-сплит за целия дом');
    }
  }

  // 7. Orientation bonus (5 pts)
  if (answers.orientation === 'south' || answers.orientation === 'top') {
    const kw = parsekW(product.coolingPower);
    if (kw >= 3.5) { score += 5; reasons.push('Достатъчна мощност за слънчева стая'); }
  }

  // Deduplicate reasons & cap
  const uniqueReasons = [...new Set(reasons)].slice(0, 3);
  return { score: Math.min(score, 100), reasons: uniqueReasons };
}

// ── Three-tier selection ───────────────────────────────────────────────────────
export function getThreeTiers(products: CatalogProduct[], answers: WizardAnswers): ResultTier[] | null {
  if (!products.length) return null;

  const budgetMax = BUDGET_MAX_EUR[answers.budget ?? 'comfort'] ?? 9999;

  const scored: ScoredProduct[] = products.map(p => {
    const { score, reasons } = scoreProduct(p, answers);
    return {
      product: p,
      score,
      matchReasons: reasons,
      installCost: calcInstallCost(p, answers.floor, answers.buildingType),
      annualSavings: calcAnnualSavings(p),
    };
  });

  // Sort by score desc, then price asc as tiebreaker
  scored.sort((a, b) => b.score - a.score || a.product.price - b.product.price);

  // Three price tiers based on stated budget
  const lowThreshold  = Math.min(budgetMax * 0.65, 400);
  const highThreshold = budgetMax * 0.88;

  const budgetPool    = scored.filter(s => s.product.price <= lowThreshold);
  const midPool       = scored.filter(s => s.product.price > lowThreshold && s.product.price <= highThreshold);
  const premiumPool   = scored.filter(s => s.product.price > highThreshold);

  // Best in each tier
  const pick = (pool: ScoredProduct[], fallback: ScoredProduct[]): ScoredProduct =>
    pool[0] ?? fallback[0] ?? scored[0];

  const budget    = pick(budgetPool, scored);
  const recommended = pick(midPool, scored);
  const premium   = pick(premiumPool, scored);

  // Ensure distinct products
  const usedIds = new Set<string>();
  const dedup = (s: ScoredProduct, altPool: ScoredProduct[]): ScoredProduct => {
    if (!usedIds.has(s.product.id)) { usedIds.add(s.product.id); return s; }
    const alt = altPool.find(a => !usedIds.has(a.product.id));
    if (alt) { usedIds.add(alt.product.id); return alt; }
    return s;
  };

  const b = dedup(budget, scored);
  const r = dedup(recommended, scored);
  const p = dedup(premium, scored);

  // Sort by price ascending so layout is budget | recommended | premium
  const tiers: [ScoredProduct, string, string, boolean][] = [
    [b, 'Икономичен', '💰', false],
    [r, 'Препоръчан', '⭐', true],
    [p, 'Премиум', '✨', false],
  ];

  tiers.sort((a, b) => a[0].product.price - b[0].product.price);

  return tiers.map(([scored, tierLabel, tierBadge, highlighted]) => ({
    tierLabel,
    tierBadge,
    highlighted,
    scored,
  }));
}
