import type { ClimacomParsedProduct } from "./parseClimacomProduct";

const ACCESSORY_CATEGORY_SLUGS = new Set([
  "wi-fi-moduli-mitsubishi-electric",
  "distancionni-upravlenia-mitsubishi-electric",
  "distancionni-upravlenia-aksesoari-wifi",
]);

const ACCESSORY_NAME =
  /\bwi-?fi\s*(модул|адаптер|adapter)\b|\bmelcloud\b|\bmac-\d+|дистанционно\s+управ|par-\w+|pac-yt|pac-ct|pac-sl|pac-mmk|pac-mk\d|pac-sk|декоративен\s+панел|\bslp-\w|\baksesoar/i;

/** Wi‑Fi модули и дистанционни управления → accessories; всичко останало → products. */
export function classifyClimacomCatalogItem(item: ClimacomParsedProduct): "climate" | "accessory" {
  if (item.categorySlugs.some((s) => ACCESSORY_CATEGORY_SLUGS.has(s))) return "accessory";
  if (ACCESSORY_NAME.test(item.name)) return "accessory";
  return "climate";
}

export function inferClimacomAccessoryKind(name: string): "accessory" | "spare_part" | "consumable" {
  return "accessory";
}
