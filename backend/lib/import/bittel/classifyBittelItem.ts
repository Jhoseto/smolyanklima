import type { BittelParsedProduct } from "./parseBittelProduct";
export { resolveBittelProductClassification as resolveBittelCategoryAndType } from "./parseBittelProduct";

/** Листинг пътища от bittel.bg за климатична техника. */
const CLIMATE_LISTING_PATH = /\/c\/klimatici\/invertorni-klimatici|\/c\/klimatici\/invertorni-multisplit-sistemi|\/c\/klimatici\/profesionalni\/kolonni-klimatici/i;
const MULTISPLIT_LISTING_PATH = /\/c\/klimatici\/invertorni-multisplit-sistemi/i;
const ACCESSORY_LISTING_PATH = /\/c\/klimatici\/aksesoari/i;

const KLIMA_NAME =
  /\b(инверторен\s+)?климатик\b|\bсплит\s+систем|мулти[\s-]*сплит|multi[\s-]*split/i;

const MULTISPLIT_NAME = /мулти[\s-]*сплит|multi[\s-]*split|\bмулти\s+систем/i;

const ACCESSORY_NAME =
  /\bwi-?fi\s+контролер\b|\bwi-?fi\s+модул\b|\bдистанционно\b|\bконтролер\b|\bадаптер\b|\bаксесоар\b/i;

type ClimateSpecs = BittelParsedProduct["specs"];

function hasClimateSpecs(specs: ClimateSpecs): boolean {
  return (
    specs.cooling_power_kw != null ||
    specs.btu != null ||
    specs.energy_class_cool != null
  );
}

export function classifyBittelCatalogItem(
  item: BittelParsedProduct,
  sourceUrl: string,
  listingCategoryPath?: string | null,
): "climate" | "accessory" {
  const pathHay = `${listingCategoryPath ?? ""} ${sourceUrl}`.toLowerCase();
  const name = item.name;

  if (ACCESSORY_LISTING_PATH.test(pathHay)) return "accessory";
  if (ACCESSORY_NAME.test(name) && !KLIMA_NAME.test(name)) return "accessory";

  if (CLIMATE_LISTING_PATH.test(pathHay)) return "climate";
  if (KLIMA_NAME.test(name)) return "climate";
  if (hasClimateSpecs(item.specs)) return "climate";

  return "climate";
}

export function inferBittelAccessoryKind(name: string): "accessory" | "spare_part" | "consumable" {
  if (/wi-?fi/i.test(name)) return "accessory";
  if (/помпа|маркуч|филтър/i.test(name)) return "spare_part";
  return "accessory";
}
