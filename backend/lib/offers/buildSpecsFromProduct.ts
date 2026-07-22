/** Преобразува product_specs в редактируем [{label, value}] списък за оферта. */

export type OfferSpecRow = { label: string; value: string };

type ProductSpecsLike = {
  btu?: number | null;
  coverage_m2?: number | null;
  cooling_power_kw?: number | null;
  heating_power_kw?: number | null;
  noise_db?: number | null;
  refrigerant?: string | null;
  wifi?: boolean | null;
  energy_class_cool?: string | null;
  energy_class_heat?: string | null;
  seer?: number | null;
  scop?: number | null;
  warranty_months?: number | null;
  weight_indoor_kg?: number | null;
  weight_outdoor_kg?: number | null;
  dim_indoor_length_mm?: number | null;
  dim_indoor_width_mm?: number | null;
  dim_indoor_height_mm?: number | null;
  dim_outdoor_length_mm?: number | null;
  dim_outdoor_width_mm?: number | null;
  dim_outdoor_height_mm?: number | null;
};

function num(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(Number(v))) return null;
  return String(v);
}

function dims(
  l?: number | null,
  w?: number | null,
  h?: number | null,
): string | null {
  if (l == null && w == null && h == null) return null;
  return `${l ?? "—"} × ${w ?? "—"} × ${h ?? "—"}`;
}

export function buildSpecsFromProduct(specs: ProductSpecsLike | null | undefined): OfferSpecRow[] {
  if (!specs) return [];
  const rows: OfferSpecRow[] = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value == null || String(value).trim() === "") return;
    rows.push({ label, value: String(value).trim() });
  };

  push("BTU", specs.btu != null ? `${specs.btu} 000` : null);
  push("Площ на покритие, m²", num(specs.coverage_m2));
  push("Охладителен капацитет, kW", num(specs.cooling_power_kw));
  push("Отоплителен капацитет, kW", num(specs.heating_power_kw));
  push("Ниво на шум (вътрешно), dB(A)", num(specs.noise_db));

  const energy =
    specs.energy_class_cool || specs.energy_class_heat
      ? `${specs.energy_class_cool ?? "—"}/${specs.energy_class_heat ?? "—"}`
      : null;
  push("Енергиен клас", energy);

  const seerScop =
    specs.seer != null || specs.scop != null
      ? `${specs.seer ?? "—"}/${specs.scop ?? "—"}`
      : null;
  push("SEER/SCOP", seerScop);

  push("Хладилен агент", specs.refrigerant);
  push("Wi-Fi", specs.wifi === true ? "Да" : specs.wifi === false ? "Не" : null);
  push("Гаранция, месеци", num(specs.warranty_months));
  push("Тегло вътрешно, kg", num(specs.weight_indoor_kg));
  push("Тегло външно, kg", num(specs.weight_outdoor_kg));
  push(
    "Размери вътрешно (Д/Ш/В), mm",
    dims(specs.dim_indoor_length_mm, specs.dim_indoor_width_mm, specs.dim_indoor_height_mm),
  );
  push(
    "Размери външно (Д/Ш/В), mm",
    dims(specs.dim_outdoor_length_mm, specs.dim_outdoor_width_mm, specs.dim_outdoor_height_mm),
  );

  return rows;
}

/** Стандартна цена за монтаж, когато липсва price_with_mount. */
export const DEFAULT_INSTALL_PRICE_EUR = 150;

export function resolveInstallPrice(
  price: number | null | undefined,
  priceWithMount: number | null | undefined,
): number {
  const p = Number(price);
  const pwm = Number(priceWithMount);
  if (Number.isFinite(pwm) && Number.isFinite(p) && pwm > p) {
    return Math.round((pwm - p) * 100) / 100;
  }
  return DEFAULT_INSTALL_PRICE_EUR;
}
