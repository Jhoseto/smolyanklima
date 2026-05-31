import type { CatalogProduct } from '../../data/types/product';
import type { InsulationLevel } from './roomSizing';
import { roomCoolingLoadKw } from './roomSizing';

export type { InsulationLevel };
export { roomCoolingLoadKw };
export type OldUnitTier = 'very_old' | 'old' | 'average' | 'good';
export type SizingStatus = 'undersized' | 'good' | 'oversized' | 'severely_oversized';

/** КЕВР Решение № Ц-25 от 01.07.2025 — EVN България (Югоизток), с ДДС. */
export const EVN_TARIFF = {
  provider: 'EVN България',
  kevrDecision: 'Ц-25 / 01.07.2025',
  dayBgnPerKwh: 0.2931,
  nightBgnPerKwh: 0.17348,
  bgnPerEur: 1.95583,
} as const;

const DAYS_PER_MONTH = 30;
const AC_DAY_SHARE_DEFAULT = 0.82;

/** SEER при номинал за стар уред (без inverter mult — инверторът е в k-кривата). */
export const OLD_TIER_SEER: Record<OldUnitTier, number> = {
  very_old: 2.2,
  old: 2.9,
  average: 3.6,
  good: 4.5,
};

export function bgnToEur(bgn: number): number {
  return bgn / EVN_TARIFF.bgnPerEur;
}

export function evnEffectivePriceEur(dayShare = AC_DAY_SHARE_DEFAULT): number {
  const dayEur = bgnToEur(EVN_TARIFF.dayBgnPerKwh);
  const nightEur = bgnToEur(EVN_TARIFF.nightBgnPerKwh);
  return dayShare * dayEur + (1 - dayShare) * nightEur;
}

export function parseCoolingKw(kwStr?: string | null): number | null {
  if (kwStr == null) return null;
  const m = String(kwStr).match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
}

/** Приблизителен SEER от енергиен клас (EN 14825 минимални прагове). */
export function seerFromEnergyClass(energyClass: string): number {
  const ec = (energyClass ?? '').toUpperCase();
  if (ec.includes('A+++')) return 7.0;
  if (ec.includes('A++')) return 6.0;
  if (ec.includes('A+')) return 5.0;
  if (ec.includes('A')) return 4.0;
  if (ec.includes('B')) return 3.2;
  return 2.8;
}

export function resolveProductSeer(product: CatalogProduct): number {
  const fromClass = seerFromEnergyClass(product.energyClass);
  const db = product.seer;
  if (db != null && Number.isFinite(db) && db >= 2.5 && db <= 12) {
    const floor = fromClass * 0.88;
    const ceil = fromClass + 1.4;
    return Math.max(floor, Math.min(db, ceil));
  }
  return fromClass * 0.95;
}

/** Базов SEER на стар уред по tier (инверторът се отразява в seerCorrectionFactor). */
export function effectiveOldSeer(tier: OldUnitTier): number {
  return OLD_TIER_SEER[tier];
}

export function coolingLoadFraction(
  roomLoadKw: number,
  ratedCoolingKw: number | null,
): number | null {
  if (ratedCoolingKw == null || ratedCoolingKw <= 0) return null;
  return roomLoadKw / ratedCoolingKw;
}

export function sizingStatusFromLoadFraction(lf: number | null): SizingStatus | null {
  if (lf == null) return null;
  if (lf > 1.05) return 'undersized';
  if (lf < 0.22) return 'severely_oversized';
  if (lf < 0.55) return 'oversized';
  return 'good';
}

/**
 * Корекция върху SEER при конкретно натоварване (отклонение от EN 14825 профил).
 * effectiveCOP = SEER × k; drawKw = roomLoad / effectiveCOP
 */
export function seerCorrectionFactor(loadFraction: number, hasInverter: boolean): number {
  const lf = Math.max(0.03, loadFraction);

  if (lf > 1.0) {
    const overload = Math.min(lf - 1.0, 0.8);
    return Math.max(0.52, 0.92 - overload * 0.5);
  }

  if (hasInverter) {
    if (lf >= 0.65) {
      return Math.max(0.88, 1.02 - (lf - 0.65) * 0.4);
    }
    if (lf >= 0.35) {
      return 0.97 + ((lf - 0.35) / 0.3) * 0.05;
    }
    if (lf >= 0.15) {
      return 0.82 + ((lf - 0.15) / 0.2) * 0.15;
    }
    return 0.62 + (lf / 0.15) * 0.2;
  }

  if (lf >= 0.85) {
    return 0.94 + ((lf - 0.85) / 0.15) * 0.06;
  }
  if (lf >= 0.55) {
    return 0.72 + ((lf - 0.55) / 0.3) * 0.22;
  }
  if (lf >= 0.30) {
    return 0.52 + ((lf - 0.3) / 0.25) * 0.2;
  }
  return 0.36 + (lf / 0.3) * 0.16;
}

/**
 * Средна електрическа мощност (kW): P = Q_room / (SEER × k).
 */
export function averageElectricalDrawKw(
  roomLoadKw: number,
  ratedCoolingKw: number | null,
  seer: number,
  hasInverterUnit: boolean,
): { drawKw: number; loadFraction: number; correctionFactor: number } {
  const seerSafe = Math.max(2.0, Math.min(seer, 11.0));
  const rated = ratedCoolingKw != null && ratedCoolingKw > 0 ? ratedCoolingKw : roomLoadKw;
  const loadFraction = roomLoadKw / rated;
  const correctionFactor = seerCorrectionFactor(loadFraction, hasInverterUnit);
  const effectiveCOP = seerSafe * correctionFactor;
  const drawKw = Math.max(0.05, Math.round((roomLoadKw / effectiveCOP) * 1000) / 1000);
  return { drawKw, loadFraction, correctionFactor };
}

export function isOldUnitUndersized(roomLoadKw: number, oldRatedKw: number): boolean {
  const lf = coolingLoadFraction(roomLoadKw, oldRatedKw);
  return lf != null && lf > 1.05;
}

export function defaultOldCoolingKw(areaM2: number, insulation: InsulationLevel): number {
  const load = roomCoolingLoadKw(areaM2, insulation);
  const steps = [1.8, 2.5, 3.5, 5.0, 7.0];
  return steps.find((s) => s >= load * 0.9) ?? 7.0;
}

function hasInverter(product: CatalogProduct): boolean {
  return product.features?.some((f) => /инвертор/i.test(f)) ?? true;
}

export function monthlyElectricityCostEur(
  drawKw: number,
  hoursPerDay: number,
  pricePerKwhEur = evnEffectivePriceEur(),
): number {
  return Math.round(drawKw * hoursPerDay * DAYS_PER_MONTH * pricePerKwhEur * 100) / 100;
}

export type ProductEnergyCompare = {
  product: CatalogProduct;
  drawKw: number;
  seerUsed: number;
  loadFraction: number | null;
  correctionFactor: number | null;
  sizingStatus: SizingStatus | null;
  monthlyCostEur: number;
  monthlyDeltaEur: number;
  /** @deprecated use sizingStatus */
  oversized: boolean;
};

export function compareProductsVsOldUnit(
  products: CatalogProduct[],
  params: {
    areaM2: number;
    insulation: InsulationLevel;
    hoursPerDay: number;
    oldCoolingKw: number;
    oldTier: OldUnitTier;
    oldHasInverter: boolean;
  },
): {
  roomLoadKw: number;
  oldDrawKw: number;
  oldSeerUsed: number;
  oldLoadFraction: number;
  oldCorrectionFactor: number;
  oldMonthlyEur: number;
  oldUndersized: boolean;
  rows: ProductEnergyCompare[];
} {
  const roomLoadKw = roomCoolingLoadKw(params.areaM2, params.insulation);
  const priceEur = evnEffectivePriceEur();

  const oldSeerUsed = effectiveOldSeer(params.oldTier);
  const oldCalc = averageElectricalDrawKw(
    roomLoadKw,
    params.oldCoolingKw,
    oldSeerUsed,
    params.oldHasInverter,
  );
  const oldUndersized = isOldUnitUndersized(roomLoadKw, params.oldCoolingKw);
  const oldMonthlyEur = monthlyElectricityCostEur(oldCalc.drawKw, params.hoursPerDay, priceEur);

  const rows: ProductEnergyCompare[] = products.map((product) => {
    const rated = parseCoolingKw(product.coolingPower);
    const seerUsed = resolveProductSeer(product);
    const invUnit = hasInverter(product);
    const calc = averageElectricalDrawKw(roomLoadKw, rated, seerUsed, invUnit);
    const lf = coolingLoadFraction(roomLoadKw, rated);
    const sizingStatus = sizingStatusFromLoadFraction(lf);
    const monthlyCostEur = monthlyElectricityCostEur(calc.drawKw, params.hoursPerDay, priceEur);

    return {
      product,
      drawKw: calc.drawKw,
      seerUsed,
      loadFraction: lf,
      correctionFactor: calc.correctionFactor,
      sizingStatus,
      monthlyCostEur,
      monthlyDeltaEur: Math.round((oldMonthlyEur - monthlyCostEur) * 100) / 100,
      oversized: sizingStatus === 'oversized' || sizingStatus === 'severely_oversized',
    };
  });

  return {
    roomLoadKw,
    oldDrawKw: oldCalc.drawKw,
    oldSeerUsed,
    oldLoadFraction: oldCalc.loadFraction,
    oldCorrectionFactor: oldCalc.correctionFactor,
    oldMonthlyEur,
    oldUndersized,
    rows,
  };
}

export const SIZING_STATUS_LABEL: Record<SizingStatus, string> = {
  undersized: 'недостатъчен',
  good: 'подходящ',
  oversized: 'преразмерен',
  severely_oversized: 'силно преразмерен',
};

/** Пълноценен стаен климатик — не външно тяло за мултисплит и не аксесоар. */
export function isEnergyCompareEligible(product: CatalogProduct): boolean {
  const type = (product.type ?? '').toLowerCase();
  const text = `${product.name} ${product.model} ${product.description ?? ''}`.toLowerCase();

  if (type.includes('аксес') || type.includes('резерв')) return false;
  if (/външн[оа]?\s*тяло/i.test(text) && /мулти|multi/i.test(`${type} ${text}`)) {
    return false;
  }
  if (text.includes('външно тяло за мултисплит') || text.includes('външно тяло за мулти')) {
    return false;
  }
  return true;
}
