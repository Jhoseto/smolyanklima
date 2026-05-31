/** Ниво на топлоизолация — споделено с калкулаторите в каталога. */
export type InsulationLevel = 'good' | 'poor';

/** Референтна височина на таван (м) — корекция при по-високи помещения. */
export const DEFAULT_CEILING_M = 2.6;

/**
 * Средна охлаждаваща нужда (kW) на m² — типични стаи в България.
 * ~0.10 kW/m² ≈ 100 W/m² ≈ 340 BTU/m² (добра ETICS / нови прозорци).
 * ~0.13 kW/m² — стари сгради, големи прозорци, слаба изолация.
 */
export const COOLING_KW_PER_M2: Record<InsulationLevel, number> = {
  good: 0.1,
  poor: 0.13,
};

/** Потребителски номинали (хиляди BTU) — съвпадат с филтрите в каталога. */
export const RECOMMENDED_BTU_NOMINALS = [7, 9, 12, 14, 18, 24, 30] as const;

export type BtuNominal = (typeof RECOMMENDED_BTU_NOMINALS)[number];

const BTU_TO_KW = 1 / 3412.14;

export function btuNominalToKw(nominal: number): number {
  return nominal * 1000 * BTU_TO_KW;
}

/** Реална термична нужда (kW), без закръгляне към номинал. */
export function roomCoolingLoadKw(
  areaM2: number,
  insulation: InsulationLevel,
  ceilingM = DEFAULT_CEILING_M,
): number {
  if (areaM2 <= 0) return 0;
  const heightFactor = Math.max(0.85, Math.min(ceilingM / DEFAULT_CEILING_M, 1.35));
  const kw = areaM2 * COOLING_KW_PER_M2[insulation] * heightFactor;
  return Math.round(kw * 100) / 100;
}

export function roomCoolingLoadBtu(
  areaM2: number,
  insulation: InsulationLevel,
  ceilingM = DEFAULT_CEILING_M,
): number {
  return Math.round(roomCoolingLoadKw(areaM2, insulation, ceilingM) * 3412.14);
}

/**
 * Най-малкият стандартен номинал, който покрива нуждата (закръгляване нагоре).
 */
export function recommendBtuNominal(
  areaM2: number,
  insulation: InsulationLevel,
  ceilingM = DEFAULT_CEILING_M,
): BtuNominal {
  const requiredKw = roomCoolingLoadKw(areaM2, insulation, ceilingM);
  for (const nominal of RECOMMENDED_BTU_NOMINALS) {
    if (btuNominalToKw(nominal) >= requiredKw - 0.01) {
      return nominal;
    }
  }
  return RECOMMENDED_BTU_NOMINALS[RECOMMENDED_BTU_NOMINALS.length - 1];
}

export function formatBtuLabel(nominal: number): string {
  const n = nominal * 1000;
  return `${n.toLocaleString('bg-BG')} BTU`;
}

export type RoomSizingResult = {
  areaM2: number;
  insulation: InsulationLevel;
  requiredKw: number;
  requiredBtu: number;
  nominal: BtuNominal;
  label: string;
  /** Типична площ, която номиналът обслужва при същата изолация (ориентир). */
  typicalMaxM2: number;
};

export function calculateRoomSizing(
  areaM2: number,
  insulation: InsulationLevel,
  ceilingM = DEFAULT_CEILING_M,
): RoomSizingResult {
  const requiredKw = roomCoolingLoadKw(areaM2, insulation, ceilingM);
  const requiredBtu = roomCoolingLoadBtu(areaM2, insulation, ceilingM);
  const nominal = recommendBtuNominal(areaM2, insulation, ceilingM);
  const kwPerM2 = COOLING_KW_PER_M2[insulation];
  const typicalMaxM2 = Math.round(btuNominalToKw(nominal) / kwPerM2);

  return {
    areaM2,
    insulation,
    requiredKw,
    requiredBtu,
    nominal,
    label: formatBtuLabel(nominal),
    typicalMaxM2,
  };
}
