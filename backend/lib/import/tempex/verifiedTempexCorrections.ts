export type TempexSourceCorrection = { field: string; sourceValue: number; catalogValue: number; reference: string; reason: string };

// Catalog btu is a nominal model class (in thousands), not the maximum connected indoor capacity.
// Each correction is guarded by both the known source value and the manufacturer's rated cooling output.
const VERIFIED_NOMINAL_CLASSES: Record<string, { sourceBtu: number; btu: number; coolingKw: number; reference: string }> = {
  FTXZ50N: { sourceBtu: 12, btu: 18, coolingKw: 5, reference: "https://www.daikin.eu/en_us/products/product.table.html/FTXZ-N---RXZ-N.html" },
  ROG18LAC2: { sourceBtu: 24, btu: 18, coolingKw: 5, reference: "https://www.fujitsu-general.com/global/data/support/erp/00393109-01.pdf" },
  ROG18LAT3: { sourceBtu: 30, btu: 18, coolingKw: 5.4, reference: "https://www.fujitsu-general.com/global/data/support/erp/00393118-01.pdf" },
  ROG24LAT3: { sourceBtu: 36, btu: 24, coolingKw: 6.8, reference: "https://www.fujitsu-general.com/global/data/support/erp/00393239-01.pdf" },
  ROG30LAT4: { sourceBtu: 48, btu: 30, coolingKw: 8, reference: "https://www.fujitsu-general.com/global/data/support/erp/00393242-01.pdf" },
};

export function verifiedTempexBtuCorrection(model: string, sourceBtu: number | null | undefined, coolingKw: number | null | undefined): TempexSourceCorrection | null {
  const verified = VERIFIED_NOMINAL_CLASSES[model.toUpperCase()];
  if (!verified || verified.sourceBtu !== sourceBtu || verified.coolingKw !== coolingKw) return null;
  return { field: "btu", sourceValue: verified.sourceBtu, catalogValue: verified.btu, reference: verified.reference,
    reason: `Номинален BTU клас ${verified.btu} за ${model}; номинално охлаждане ${verified.coolingKw} kW, потвърдено с техническа документация на производителя.` };
}
