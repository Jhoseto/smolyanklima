import type { BulclimaParsedProduct } from "./parseBulclimaHtml";

const ACCESSORY_LISTING_URL = /aksesoar|wi-fi-i-aksesoari|aksesoari-za-klimatici/i;

const ACCESSORY_PRODUCT_URL =
  /kondenzna-pompa|condezna-pompa|markuch|pompa-aspen|wi-fi-modul|modul-wi|aksesoar|dalnovezen|kabel-kanal/i;

const KLIMA_NAME =
  /\b(инверторен\s+)?климатик\b|мультисплит|multisplit|сплит\s+систем|vrf\b|vrv\b/i;

const ACCESSORY_NAME =
  /\bкондензн[ао]\s+помпа\b|\bмаркуч\b|\bвинилов\s+маркуч\b|\bwi-?fi\s+модул\b|\bдистанционно\b|\bдистанцион\b|\bфилтър\s+за\b|\bаксесоар\b|\bкабел\s+канал\b|\bдренаж\b|\bпомпа\s+aspen\b/i;

function hasClimateSpecs(specs: ClimateSpecs): boolean {
  return (
    specs.cooling_power_kw != null ||
    specs.heating_power_kw != null ||
    specs.btu != null ||
    specs.coverage_m2 != null ||
    (specs.energy_class_cool != null && specs.energy_class_cool.length > 0)
  );
}

type ClimateSpecs = BulclimaParsedProduct["specs"];

/** Климатик → products; помпи, маркучи, Wi‑Fi модули и др. → accessories. */
export function classifyBulclimaCatalogItem(
  item: BulclimaParsedProduct,
  sourceUrl: string,
): "climate" | "accessory" {
  const url = sourceUrl.toLowerCase();
  const name = item.name;

  if (ACCESSORY_LISTING_URL.test(url) || ACCESSORY_PRODUCT_URL.test(url)) {
    return "accessory";
  }

  if (KLIMA_NAME.test(name)) {
    return "climate";
  }

  if (hasClimateSpecs(item.specs)) {
    return "climate";
  }

  if (ACCESSORY_NAME.test(name)) {
    return "accessory";
  }

  return "climate";
}

/** За вече записани редове в `products` (без Bulclima URL) — само при ясни сигнали за аксесоар. */
export function shouldMoveStoredProductToAccessories(
  name: string,
  slug: string,
  specs: ClimateSpecs,
): boolean {
  if (KLIMA_NAME.test(name)) return false;
  if (hasClimateSpecs(specs)) return false;
  if (ACCESSORY_NAME.test(name)) return true;
  const pseudoUrl = `/product/${slug.toLowerCase()}`;
  return ACCESSORY_PRODUCT_URL.test(pseudoUrl);
}

export function inferAccessoryKind(name: string): "accessory" | "spare_part" | "consumable" {
  if (/\bпомпа\b|\bмаркуч\b|\bфилтър\b/i.test(name)) return "spare_part";
  return "accessory";
}
