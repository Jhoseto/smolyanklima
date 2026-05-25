import type { CatalogProduct } from '../../../data/types/product';
import type { WizardAnswers, ScoredProduct, ResultTier } from './types';

export function formatEur(amount: number): string {
  return `€${amount.toLocaleString('bg-BG')}`;
}

export function formatBudgetRange(min?: number, max?: number): string {
  if (min == null || max == null || min <= 0 || max <= 0) return '—';
  return `${formatEur(min)} – ${formatEur(max)}`;
}

const OPEN_BUDGET_MAX = 50000;

export function resolveBudgetFromAnswers(answers: WizardAnswers): { budgetMin: number; budgetMax: number } {
  const min = answers.budgetMin ?? 0;
  const max = answers.budgetMax ?? 0;
  if (min > 0 && max > 0 && min <= max) {
    return { budgetMin: min, budgetMax: max };
  }
  return { budgetMin: 800, budgetMax: 2500 };
}

export function getCatalogTotalCostBounds(products: CatalogProduct[]): { min: number; max: number } | null {
  const totals = products
    .filter((p) => p.price > 0)
    .map((p) => p.price + calcInstallCost(p));
  if (!totals.length) return null;
  return { min: Math.min(...totals), max: Math.max(...totals) };
}

export function suggestBudgetRange(products: CatalogProduct[]): { min: number; max: number } {
  const totals = products
    .filter((p) => p.price > 0)
    .map((p) => p.price + calcInstallCost(p))
    .sort((a, b) => a - b);
  if (!totals.length) return { min: 800, max: 2500 };
  const pick = (p: number) => totals[Math.max(0, Math.min(totals.length - 1, Math.floor((totals.length * p) / 100) - 1))] ?? totals[0];
  const round50 = (n: number) => Math.round(n / 50) * 50;
  return {
    min: round50(pick(25)),
    max: round50(pick(75)),
  };
}

// ── Installation cost (EUR) ────────────────────────────────────────────────────
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
    : product.type?.includes('Касетъ') || product.type?.includes('Таван') ? 350
    : product.type?.includes('Подов') ? 200
    : 150;
  const floorExtra = FLOOR_EXTRA[floor ?? 'ground'] ?? 0;
  const buildingExtra = BUILDING_EXTRA[buildingType ?? 'brick'] ?? 0;
  return base + floorExtra + buildingExtra;
}

// ── Product metrics (normalized from catalog fields) ───────────────────────────

interface ProductMetrics {
  coolingKw: number;
  heatingKw: number;
  coverageM2: number;
  btu: number;
  noiseDb: number;
  seer: number;
  scop: number;
  hasInverter: boolean;
  hasPurification: boolean;
  isDesigner: boolean;
  isCompact: boolean;
  warrantyYears: number;
}

function parseProductMaxArea(areaStr?: string): number | undefined {
  if (!areaStr) return undefined;
  const nums = areaStr.match(/\d+/g);
  if (!nums) return undefined;
  return Math.max(...nums.map(Number));
}

function parsekWFromString(kwStr?: string): number | undefined {
  if (!kwStr) return undefined;
  const m = kwStr.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : undefined;
}

function parseNoiseDb(noiseStr?: string): number | undefined {
  if (!noiseStr) return undefined;
  const m = noiseStr.match(/[\d.]+/);
  return m ? parseFloat(m[0]) : undefined;
}

function inferBtuFromKw(kw: number): number {
  const nominal = [7, 9, 12, 14, 18, 22, 24, 30, 36];
  const raw = kw / 0.000293071;
  let best = nominal[0];
  for (const n of nominal) {
    if (Math.abs(n * 1000 - raw) < Math.abs(best * 1000 - raw)) best = n;
  }
  return best;
}

function normalizeBtu(raw?: number): number | undefined {
  if (raw == null || !Number.isFinite(raw)) return undefined;
  return raw < 100 ? Math.round(raw) : Math.round(raw / 1000);
}

function btuNominalToKw(nominal: number): number {
  return (nominal * 1000) * 0.000293071;
}

function extractMetrics(product: CatalogProduct): ProductMetrics {
  let coolingKw = product.coolingKw ?? parsekWFromString(product.coolingPower);
  let heatingKw = product.heatingKw ?? parsekWFromString(product.heatingPower);
  let coverageM2 = product.coverageM2 ?? parseProductMaxArea(product.area);
  let btu = normalizeBtu(product.btu);
  let noiseDb = product.noiseDb ?? parseNoiseDb(product.noise);

  if (btu == null && coolingKw != null) btu = inferBtuFromKw(coolingKw);
  if (coolingKw == null && btu != null) coolingKw = btuNominalToKw(btu);
  if (coverageM2 == null && coolingKw != null) {
    coverageM2 = Math.round(coolingKw / 0.11);
  }

  const features = product.features ?? [];
  const featureText = features.join(' ').toLowerCase();
  const typeLower = (product.type ?? '').toLowerCase();

  const hasInverter = features.some(f => /инвертор|inverter/i.test(f))
    || /инвертор|inverter/i.test(product.description ?? '')
    || /инвертор|inverter/i.test(product.name ?? '');

  const hasPurification = features.some(f =>
    /фил|purif|pm2|hepa|clean|пречист|ion|плазма|стерil/i.test(f),
  );

  const indoorH = product.dimensions?.indoor?.heightMm;
  const isCompact = indoorH != null && indoorH > 0 && indoorH <= 290;
  const isDesigner = typeLower.includes('дизайн') || /perfera|stylish|design/i.test(product.name ?? '');

  let warrantyYears = 0;
  const wm = product.warranty?.match(/\d+/);
  if (wm) warrantyYears = parseInt(wm[0], 10);

  return {
    coolingKw: coolingKw ?? 3.5,
    heatingKw: heatingKw ?? (coolingKw ?? 3.5) * 1.1,
    coverageM2: coverageM2 ?? 30,
    btu: btu ?? inferBtuFromKw(coolingKw ?? 3.5),
    noiseDb: noiseDb ?? 99,
    seer: product.seer ?? 0,
    scop: product.scop ?? 0,
    hasInverter,
    hasPurification,
    isDesigner,
    isCompact,
    warrantyYears,
  };
}

// ── User profile from wizard answers ───────────────────────────────────────────

interface UserProfile {
  targetSqm: number;
  minSqm: number;
  requiredCoolingKw: number;
  requiredHeatingKw: number;
  budgetMin: number;
  budgetMax: number;
  needsHeating: boolean;
  priorities: string[];
  roomType?: string;
  orientation?: string;
  buildingType?: string;
  floor?: string;
}

const AREA_PROFILE: Record<string, { target: number; min: number }> = {
  tiny:   { target: 16, min: 20 },
  small:  { target: 25, min: 30 },
  medium: { target: 38, min: 45 },
  large:  { target: 52, min: 60 },
  xlarge: { target: 72, min: 80 },
};

function buildUserProfile(answers: WizardAnswers): UserProfile {
  const areaKey = answers.area ?? 'medium';
  const area = AREA_PROFILE[areaKey] ?? AREA_PROFILE.medium;

  let loadFactor = 1;
  if (answers.orientation === 'south') loadFactor *= 1.15;
  if (answers.orientation === 'top') loadFactor *= 1.12;
  if (answers.roomType === 'kitchen') loadFactor *= 1.18;
  if (answers.roomType === 'commercial') loadFactor *= 1.22;
  if (answers.orientation === 'unknown') loadFactor *= 1.05;

  const baseCoolingKw = area.target * 0.11 * loadFactor;
  const requiredCoolingKw = Math.round(baseCoolingKw * 10) / 10;
  const requiredHeatingKw = requiredCoolingKw * (answers.usage === 'heating' ? 1.08 : 1.0);

  const budget = resolveBudgetFromAnswers(answers);

  return {
    targetSqm: area.target,
    minSqm: area.min,
    requiredCoolingKw,
    requiredHeatingKw,
    budgetMin: budget.budgetMin,
    budgetMax: budget.budgetMax,
    needsHeating: answers.usage === 'heating' || answers.usage === 'both',
    priorities: answers.priorities ?? [],
    roomType: answers.roomType,
    orientation: answers.orientation,
    buildingType: answers.buildingType,
    floor: answers.floor,
  };
}

// ── Hard filters & compatibility ───────────────────────────────────────────────

type FilterMode = 'strict' | 'relaxed' | 'fallback';

function isCommercialType(type: string): boolean {
  return /касет|таван|подов|канал/i.test(type.toLowerCase());
}

function isResidentialWallType(type: string): boolean {
  const t = type.toLowerCase();
  return t.includes('стенен') || t.includes('дизайн') || t === '';
}

function isTypeCompatible(product: CatalogProduct, profile: UserProfile, mode: FilterMode): boolean {
  const type = product.type ?? '';
  const room = profile.roomType;

  if (room === 'commercial') {
    return isCommercialType(type) || type.includes('Мулти') || isResidentialWallType(type);
  }
  if (room === 'office') {
    if (mode === 'strict' && type.includes('Подов') && profile.targetSqm > 35) return false;
    return true;
  }
  if (['bedroom', 'living', 'kids', 'kitchen'].includes(room ?? '')) {
    if (mode === 'strict' && isCommercialType(type)) return false;
    if (room === 'kitchen' && type.includes('Мулти')) return false;
    return true;
  }
  return true;
}

function powerAdequacy(metrics: ProductMetrics, profile: UserProfile, mode: FilterMode): boolean {
  const minCoolRatio = mode === 'strict' ? 0.88 : mode === 'relaxed' ? 0.78 : 0.68;
  const minCoverageRatio = mode === 'strict' ? 0.92 : mode === 'relaxed' ? 0.82 : 0.72;

  const kwOk = metrics.coolingKw >= profile.requiredCoolingKw * minCoolRatio;
  const areaOk = metrics.coverageM2 >= profile.targetSqm * minCoverageRatio;

  if (!kwOk && !areaOk) return false;

  if (profile.needsHeating) {
    const heatMin = mode === 'strict' ? 0.85 : mode === 'relaxed' ? 0.72 : 0.62;
    const heatOk = metrics.heatingKw >= profile.requiredHeatingKw * heatMin;
    const inverterOk = metrics.hasInverter && metrics.scop >= 3.5;
    if (!heatOk && !inverterOk && mode === 'strict') return false;
  }

  return true;
}

function budgetAdequacy(totalCost: number, profile: UserProfile, mode: FilterMode): boolean {
  const stretchHigh = mode === 'strict' ? 1.05 : mode === 'relaxed' ? 1.12 : 1.25;
  const stretchLow = mode === 'strict' ? 0.92 : mode === 'relaxed' ? 0.85 : 0.75;
  const min = profile.budgetMin > 0 ? profile.budgetMin * stretchLow : 0;
  const max = profile.budgetMax >= OPEN_BUDGET_MAX ? Number.POSITIVE_INFINITY : profile.budgetMax * stretchHigh;
  return totalCost >= min && totalCost <= max;
}

function isEligible(
  product: CatalogProduct,
  profile: UserProfile,
  installCost: number,
  mode: FilterMode,
): boolean {
  const metrics = extractMetrics(product);
  const totalCost = product.price + installCost;

  if (!isTypeCompatible(product, profile, mode)) return false;
  if (!powerAdequacy(metrics, profile, mode)) return false;
  if (!budgetAdequacy(totalCost, profile, mode)) return false;

  return true;
}

// ── Scoring components (0–1 each, weighted to 100) ────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function scoreSizing(metrics: ProductMetrics, profile: UserProfile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const kwRatio = metrics.coolingKw / profile.requiredCoolingKw;
  const areaRatio = metrics.coverageM2 / profile.targetSqm;

  let kwScore: number;
  if (kwRatio >= 0.95 && kwRatio <= 1.15) kwScore = 1;
  else if (kwRatio >= 0.88 && kwRatio <= 1.25) kwScore = 0.82;
  else if (kwRatio >= 0.78 && kwRatio <= 1.35) kwScore = 0.55;
  else if (kwRatio >= 0.68) kwScore = 0.3;
  else kwScore = 0.05;

  let areaScore: number;
  if (areaRatio >= 1) areaScore = 1;
  else if (areaRatio >= 0.92) areaScore = 0.85;
  else if (areaRatio >= 0.85) areaScore = 0.6;
  else areaScore = 0.25;

  const combined = kwScore * 0.55 + areaScore * 0.45;

  if (combined >= 0.85) {
    reasons.push(`Оптимална мощност ${metrics.coolingKw} kW за ~${profile.targetSqm} м²`);
  } else if (combined >= 0.55) {
    reasons.push(`Покрива до ${Math.round(metrics.coverageM2)} м²`);
  }

  return { score: combined, reasons };
}

function scoreBudget(totalCost: number, profile: UserProfile): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const { budgetMin, budgetMax } = profile;
  if (budgetMax >= OPEN_BUDGET_MAX) {
    return { score: 0.85, reasons: [] };
  }

  const span = Math.max(1, budgetMax - budgetMin);
  const mid = budgetMin + span / 2;
  const dist = Math.abs(totalCost - mid) / (span / 2);

  let s: number;
  if (totalCost >= budgetMin && totalCost <= budgetMax) {
    if (dist <= 0.35) s = 1;
    else if (dist <= 0.7) s = 0.88;
    else s = 0.72;
    reasons.push('В диапазона на бюджета ви (с монтаж)');
  } else if (totalCost <= budgetMax * 1.05) {
    s = 0.45;
  } else {
    s = 0.1;
  }

  return { score: s, reasons };
}

function scoreEnergyClass(ec: string): number {
  if (ec.includes('A+++')) return 1;
  if (ec.includes('A++')) return 0.82;
  if (ec.includes('A+')) return 0.62;
  if (ec.includes('A')) return 0.4;
  return 0.2;
}

function scorePriority(
  priority: string,
  product: CatalogProduct,
  metrics: ProductMetrics,
  needsHeating: boolean,
): { score: number; reason?: string } {
  switch (priority) {
    case 'quiet': {
      if (metrics.noiseDb <= 19) return { score: 1, reason: `Ултра тих — ${metrics.noiseDb} dB` };
      if (metrics.noiseDb <= 21) return { score: 0.88, reason: `Много тих — ${metrics.noiseDb} dB` };
      if (metrics.noiseDb <= 24) return { score: 0.62, reason: `Тих режим — ${metrics.noiseDb} dB` };
      if (metrics.noiseDb <= 27) return { score: 0.35 };
      return { score: 0.1 };
    }
    case 'efficiency': {
      const ec = product.energyClass ?? '';
      const ecScore = scoreEnergyClass(ec);
      const seerBonus = metrics.seer >= 8.5 ? 0.15 : metrics.seer >= 7 ? 0.08 : 0;
      const scopBonus = needsHeating && metrics.scop >= 4.5 ? 0.12 : metrics.scop >= 4 ? 0.06 : 0;
      const total = clamp01(ecScore * 0.7 + seerBonus + scopBonus);
      if (total >= 0.85) return { score: total, reason: ec.includes('A+++') ? 'A+++ енергиен клас' : 'Висока енергийна ефективност' };
      if (total >= 0.65) return { score: total, reason: `${ec} енергиен клас` };
      return { score: total };
    }
    case 'wifi':
      if (product.wifi) return { score: 1, reason: 'WiFi управление' };
      if (product.features?.some(f => /wifi|wi-fi|smart|app|интернет/i.test(f))) {
        return { score: 0.75, reason: 'Smart управление' };
      }
      return { score: 0.05 };
    case 'purification':
      if (metrics.hasPurification) return { score: 1, reason: 'Пречистване / филтриране на въздуха' };
      return { score: 0.08 };
    case 'design': {
      let s = 0.2;
      if (metrics.isDesigner) s = 0.95;
      else if (metrics.isCompact) s = 0.78;
      else if ((product.type ?? '').includes('Стенен')) s = 0.55;
      if (s >= 0.75) return { score: s, reason: 'Елегантен и компактен дизайн' };
      return { score: s };
    }
    case 'fast': {
      const type = product.type ?? '';
      const easyMount = type.includes('Стенен') && !type.includes('Мулти');
      return { score: easyMount ? 0.72 : 0.45, reason: easyMount ? 'Стандартен бърз монтаж' : undefined };
    }
    default:
      return { score: 0.5 };
  }
}

function scorePriorities(
  product: CatalogProduct,
  metrics: ProductMetrics,
  priorities: string[],
  needsHeating: boolean,
): { score: number; reasons: string[] } {
  if (!priorities.length) return { score: 0.7, reasons: [] };

  const reasons: string[] = [];
  let total = 0;
  for (const p of priorities) {
    const { score, reason } = scorePriority(p, product, metrics, needsHeating);
    total += score;
    if (reason) reasons.push(reason);
  }
  return { score: total / priorities.length, reasons };
}

function scoreUsage(
  product: CatalogProduct,
  metrics: ProductMetrics,
  profile: UserProfile,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  if (!profile.needsHeating) {
    return { score: metrics.hasInverter ? 0.85 : 0.72, reasons: [] };
  }

  let s = 0;
  if (metrics.hasInverter) { s += 0.35; reasons.push('Инвертор — ефективно отопление'); }
  if (metrics.heatingKw >= profile.requiredHeatingKw * 0.9) {
    s += 0.3;
    reasons.push(`Отоплителна мощност ${metrics.heatingKw} kW`);
  }
  const heatClass = product.energyHeat ?? '';
  if (heatClass.includes('A++')) s += 0.2;
  else if (heatClass.includes('A+')) s += 0.12;
  if (metrics.scop >= 4.2) s += 0.15;

  return { score: clamp01(s), reasons };
}

function scoreRoomFit(
  product: CatalogProduct,
  metrics: ProductMetrics,
  profile: UserProfile,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  const type = product.type ?? '';
  const cat = product.category ?? '';
  const room = profile.roomType;
  let s = 0.5;

  if (room === 'commercial') {
    if (isCommercialType(type)) { s = 0.95; reasons.push('Промишлен/търговски тип'); }
    else if (type.includes('Мулти')) { s = 0.75; }
  } else if (room === 'office') {
    if (type.includes('Касетъ') || type.includes('Таван')) { s = 0.92; reasons.push('Подходящ за офис'); }
    else if (type.includes('Стенен')) { s = 0.78; }
  } else if (['bedroom', 'living', 'kids'].includes(room ?? '')) {
    if (cat.includes('Апартамент') || type.includes('Стенен')) { s = 0.88; reasons.push('Идеален за дома'); }
    if (room === 'kids' && metrics.hasPurification) { s = Math.min(1, s + 0.12); reasons.push('Подходящ за детска стая'); }
    if (room === 'bedroom' && metrics.noiseDb <= 22) { s = Math.min(1, s + 0.1); }
  } else if (room === 'kitchen') {
    if (metrics.coolingKw >= profile.requiredCoolingKw) { s = 0.9; reasons.push('Достатъчна мощност за кухня'); }
  }

  if (profile.buildingType === 'office' && type.includes('Касетъ')) s = Math.min(1, s + 0.08);
  if (profile.buildingType === 'house' && type.includes('Мулти')) {
    s = Math.min(1, s + 0.15);
    reasons.push('Мулти-сплит за по-голям дом');
  }

  return { score: clamp01(s), reasons };
}

function scoreQuality(product: CatalogProduct, metrics: ProductMetrics): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let s = 0;

  s += clamp01((product.rating - 3.5) / 1.5) * 0.35;
  s += clamp01(Math.min(product.reviews, 80) / 80) * 0.15;
  s += scoreEnergyClass(product.energyClass ?? '') * 0.2;
  if (metrics.seer >= 7) s += 0.08;
  if (metrics.scop >= 4) s += 0.07;
  if (metrics.warrantyYears >= 3) { s += 0.1; reasons.push(`${metrics.warrantyYears} г. гаранция`); }
  if (product.refrigerant && /r32|r290|r454/i.test(product.refrigerant)) s += 0.05;

  if (product.condition === 'used') s *= 0.82;

  return { score: clamp01(s), reasons };
}

// ── Main scoring ───────────────────────────────────────────────────────────────

const WEIGHTS = {
  sizing: 0.28,
  budget: 0.18,
  priorities: 0.24,
  usage: 0.12,
  roomFit: 0.10,
  quality: 0.08,
} as const;

export function scoreProduct(product: CatalogProduct, answers: WizardAnswers): {
  score: number;
  reasons: string[];
} {
  const profile = buildUserProfile(answers);
  const metrics = extractMetrics(product);
  const installCost = calcInstallCost(product, answers.floor, answers.buildingType);
  const totalCost = product.price + installCost;

  const sizing = scoreSizing(metrics, profile);
  const budget = scoreBudget(totalCost, profile);
  const priorities = scorePriorities(product, metrics, profile.priorities, profile.needsHeating);
  const usage = scoreUsage(product, metrics, profile);
  const roomFit = scoreRoomFit(product, metrics, profile);
  const quality = scoreQuality(product, metrics);

  const raw =
    sizing.score * WEIGHTS.sizing +
    budget.score * WEIGHTS.budget +
    priorities.score * WEIGHTS.priorities +
    usage.score * WEIGHTS.usage +
    roomFit.score * WEIGHTS.roomFit +
    quality.score * WEIGHTS.quality;

  const allReasons = [
    ...sizing.reasons,
    ...priorities.reasons,
    ...usage.reasons,
    ...roomFit.reasons,
    ...budget.reasons,
    ...quality.reasons,
  ];

  const uniqueReasons = [...new Set(allReasons)].slice(0, 4);
  return { score: Math.round(raw * 100), reasons: uniqueReasons };
}

// ── Annual savings (SEER/SCOP aware) ───────────────────────────────────────────

export function calcAnnualSavings(product: CatalogProduct): number {
  const metrics = extractMetrics(product);
  let base = 0;

  const ec = product.energyClass ?? '';
  if (ec.includes('A+++')) base = 75;
  else if (ec.includes('A++')) base = 50;
  else if (ec.includes('A+')) base = 28;
  else if (ec.includes('A')) base = 12;

  if (metrics.seer >= 8.5) base += 25;
  else if (metrics.seer >= 7.5) base += 15;
  else if (metrics.seer >= 6.5) base += 8;

  if (metrics.scop >= 4.5) base += 12;
  else if (metrics.scop >= 4) base += 6;

  return Math.round(base);
}

// ── Three-tier selection ───────────────────────────────────────────────────────

function totalCost(scored: ScoredProduct): number {
  return scored.product.price + scored.installCost;
}

function pickBest(pool: ScoredProduct[], usedIds: Set<string>): ScoredProduct | undefined {
  return pool.find(s => !usedIds.has(s.product.id));
}

function dedup(
  primary: ScoredProduct,
  alternates: ScoredProduct[],
  usedIds: Set<string>,
): ScoredProduct {
  if (!usedIds.has(primary.product.id)) {
    usedIds.add(primary.product.id);
    return primary;
  }
  const alt = pickBest(alternates, usedIds);
  if (alt) {
    usedIds.add(alt.product.id);
    return alt;
  }
  usedIds.add(primary.product.id);
  return primary;
}

function buildScoredList(products: CatalogProduct[], answers: WizardAnswers): ScoredProduct[] {
  return products.map(p => {
    const { score, reasons } = scoreProduct(p, answers);
    return {
      product: p,
      score,
      matchReasons: reasons,
      installCost: calcInstallCost(p, answers.floor, answers.buildingType),
      annualSavings: calcAnnualSavings(p),
    };
  });
}

function filterEligible(
  products: CatalogProduct[],
  answers: WizardAnswers,
  mode: FilterMode,
): CatalogProduct[] {
  const profile = buildUserProfile(answers);
  return products.filter(p => {
    const install = calcInstallCost(p, answers.floor, answers.buildingType);
    return isEligible(p, profile, install, mode);
  });
}

export function getThreeTiers(products: CatalogProduct[], answers: WizardAnswers): ResultTier[] | null {
  if (!products.length) return null;

  const profile = buildUserProfile(answers);
  let eligible = filterEligible(products, answers, 'strict');
  if (eligible.length < 5) eligible = filterEligible(products, answers, 'relaxed');
  if (eligible.length < 3) eligible = filterEligible(products, answers, 'fallback');
  if (!eligible.length) eligible = products;

  const scored = buildScoredList(eligible, answers);
  scored.sort((a, b) => b.score - a.score || totalCost(a) - totalCost(b));

  const minViableScore = Math.max(42, scored[0]?.score ? scored[0].score - 25 : 42);
  const viable = scored.filter(s => s.score >= minViableScore);
  const pool = viable.length >= 3 ? viable : scored;

  const isOpenBudget = profile.budgetMax >= OPEN_BUDGET_MAX;
  let budgetPick: ScoredProduct;
  let recommendedPick: ScoredProduct;
  let premiumPick: ScoredProduct;

  if (isOpenBudget) {
    const byPrice = [...pool].sort((a, b) => totalCost(a) - totalCost(b));
    const third = Math.max(1, Math.floor(byPrice.length / 3));
    const lowPrice = byPrice.slice(0, third);
    const midPrice = byPrice.slice(third, third * 2);
    const highPrice = byPrice.slice(third * 2);

    budgetPick = [...lowPrice].sort((a, b) => b.score - a.score)[0] ?? pool[0];
    recommendedPick = pool[0];
    premiumPick = [...highPrice].sort((a, b) => b.score - a.score)[0]
      ?? [...pool].sort((a, b) => b.score - a.score)[0]
      ?? pool[0];
  } else {
    const min = profile.budgetMin;
    const max = profile.budgetMax;
    const span = Math.max(1, max - min);
    const lowCut = min + span * 0.33;
    const midCut = min + span * 0.66;

    const inRange = pool.filter((s) => totalCost(s) >= min && totalCost(s) <= max * 1.05);
    const rangePool = inRange.length >= 3 ? inRange : pool.filter((s) => totalCost(s) <= max * 1.05);

    const budgetPool = rangePool.filter((s) => totalCost(s) <= lowCut);
    const midPool = rangePool.filter((s) => totalCost(s) > lowCut && totalCost(s) <= midCut);
    const premiumPool = rangePool.filter((s) => totalCost(s) > midCut && totalCost(s) <= max * 1.05);

    budgetPick = budgetPool[0] ?? rangePool[0] ?? pool[0];
    recommendedPick = midPool.sort((a, b) => b.score - a.score)[0] ?? pool[0];
    premiumPick = premiumPool.sort((a, b) => b.score - a.score)[0] ?? rangePool[rangePool.length - 1] ?? pool[0];
  }

  const usedIds = new Set<string>();
  const b = dedup(budgetPick, pool, usedIds);
  const r = dedup(recommendedPick, pool, usedIds);
  const p = dedup(premiumPick, pool, usedIds);

  const tiers: [ScoredProduct, string, string, boolean][] = [
    [b, 'Икономичен', '💰', false],
    [r, 'Препоръчан', '⭐', true],
    [p, 'Премиум', '✨', false],
  ];

  tiers.sort((a, b) => a[0].product.price - b[0].product.price);

  return tiers.map(([scoredItem, tierLabel, tierBadge, highlighted]) => ({
    tierLabel,
    tierBadge,
    highlighted,
    scored: scoredItem,
  }));
}
