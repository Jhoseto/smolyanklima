import type { CondexParsedProduct } from "./parseCondexProduct";

/** RAC мултисплит под „За дома и офиса“ — климатици, не аксесоари. */
const RAC_ZA_DOMA_MULTI_LISTING =
  /vatreshni-tela-za-multi-split|vanshni-tela-za-multi-split-sistemi/;

/** Под-листинги с вътрешни/външни тела (напр. Diamond SRK-ZSX за multi). */
const RAC_MULTI_UNIT_LISTING =
  /diamond-srk-zsx|diamond-srk-zr|products-vatreshni-tela-srk|vatreshni-tela-(?:srk|zr|srf|srr|fdtc|fden|fdum)|vanshni-tela(?:-|$)/i;

/** Само аксесоарни каталози — не „products-vatreshni-tela-srk-*“ (multi тела). */
const ACCESSORY_LISTING_PATH = /aksesoar|wi-fi|modul-wi/i;

/** Condex URL на вътрешно multi-split тяло (SRK 25 ZSX-WB), не RAC SRK/SRC комплект. */
const CONDEX_MULTI_INNER_UNIT_URL =
  /\/product-details\/srk-\d+-z[sxyr][a-z0-9-]*-w/i;

const CONDEX_RAC_KIT_URL = /\/product-details\/srk-src-/i;

const ACCESSORY_PRODUCT_URL = /aksesoar|wi-fi-modul|distancion|pompa|markuch|kabel-kanal/i;

const KLIMA_NAME =
  /\b(инверторен\s+)?климатик\b|сплит\s+система|мультисплит|мулти[\s-]*сплит|multi[\s-]*split/i;

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

  if (CONDEX_MULTI_INNER_UNIT_URL.test(url) && !CONDEX_RAC_KIT_URL.test(url)) {
    return "climate";
  }

  if (RAC_ZA_DOMA_MULTI_LISTING.test(pathHay) || RAC_MULTI_UNIT_LISTING.test(pathHay)) {
    return "climate";
  }

  if (ACCESSORY_LISTING_PATH.test(pathHay) || ACCESSORY_PRODUCT_URL.test(url)) {
    return "accessory";
  }

  if (CONDEX_UNIT_ONLY_NAME.test(name)) {
    if (
      KLIMA_NAME.test(name) ||
      RAC_ZA_DOMA_MULTI_LISTING.test(pathHay) ||
      RAC_MULTI_UNIT_LISTING.test(pathHay)
    ) {
      return "climate";
    }
    return "accessory";
  }

  if (ACCESSORY_NAME.test(name) && !KLIMA_NAME.test(name)) {
    return "accessory";
  }

  if (KLIMA_NAME.test(name) || (isCompleteSplitKitName(name) && !CONDEX_UNIT_ONLY_NAME.test(name))) {
    return "climate";
  }

  if (/\bscm\s*\d/i.test(name) && !/вътрешн/i.test(name) && !KLIMA_NAME.test(name)) {
    if (RAC_ZA_DOMA_MULTI_LISTING.test(pathHay)) return "climate";
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
