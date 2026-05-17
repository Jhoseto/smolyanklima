import type { CondexParsedProduct } from "./parseCondexProduct";

const ACCESSORY_LISTING_PATH =
  /vatreshni-tela|vanshni-tela|products-vatreshni|products-vanshni|aksesoar|wi-fi|modul-wi/i;

const ACCESSORY_PRODUCT_URL =
  /vatreshni|vanshni|aksesoar|wi-fi-modul|distancion|pompa|markuch|kabel-kanal/i;

const KLIMA_NAME =
  /\b(инверторен\s+)?климатик\b|сплит\s+система|мультисплит\s+систем/i;

const CONDEX_UNIT_ONLY_NAME =
  /\bвътрешно\s+тяло\b|\bвъншно\s+тяло\b|\bвътрешен\s+агрегат\b|\bвъншен\s+агрегат\b/i;

const ACCESSORY_NAME =
  /\bкондензн[ао]\s+помпа\b|\bмаркуч\b|\bwi-?fi\s+модул\b|\bдистанционно\b|\bдистанцион\b|\bфилтър\s+за\b|\bаксесоар\b|\bкабел\s+канал\b|\bдренаж\b/i;

type ClimateSpecs = CondexParsedProduct["specs"];

function hasClimateSpecs(specs: ClimateSpecs): boolean {
  return (
    specs.cooling_power_kw != null ||
    specs.heating_power_kw != null ||
    specs.btu != null ||
    specs.coverage_m2 != null ||
    (specs.energy_class_cool != null && specs.energy_class_cool.length > 0)
  );
}

function isCompleteSplitKitName(name: string): boolean {
  return /\b[A-Z]{2,}\s*\/\s*[A-Z]{2,}\s+\d+/i.test(name);
}

/** Климатик (комплект/RAC) → products; вътрешни/външни тела, Wi‑Fi, помпи → accessories. */
export function classifyCondexCatalogItem(
  item: CondexParsedProduct,
  sourceUrl: string,
  listingCategoryPath?: string | null,
): "climate" | "accessory" {
  const url = sourceUrl.toLowerCase();
  const name = item.name;
  const pathHay = `${listingCategoryPath ?? ""} ${url}`.toLowerCase();

  if (ACCESSORY_LISTING_PATH.test(pathHay) || ACCESSORY_PRODUCT_URL.test(url)) {
    return "accessory";
  }

  if (CONDEX_UNIT_ONLY_NAME.test(name)) {
    return "accessory";
  }

  if (ACCESSORY_NAME.test(name) && !KLIMA_NAME.test(name)) {
    return "accessory";
  }

  if (KLIMA_NAME.test(name) || (isCompleteSplitKitName(name) && !CONDEX_UNIT_ONLY_NAME.test(name))) {
    return "climate";
  }

  if (/\bscm\s*\d/i.test(name) && !/вътрешн/i.test(name) && !KLIMA_NAME.test(name)) {
    return "accessory";
  }

  if (hasClimateSpecs(item.specs) && !CONDEX_UNIT_ONLY_NAME.test(name)) {
    return "climate";
  }

  if (ACCESSORY_NAME.test(name)) return "accessory";

  return "climate";
}

export function inferCondexAccessoryKind(name: string): "accessory" | "spare_part" | "consumable" {
  if (/\bwi-?fi\b/i.test(name)) return "accessory";
  if (/\bпомпа\b|\bмаркуч\b|\bфилтър\b/i.test(name)) return "spare_part";
  if (/вътрешно|външно/i.test(name)) return "spare_part";
  return "accessory";
}
