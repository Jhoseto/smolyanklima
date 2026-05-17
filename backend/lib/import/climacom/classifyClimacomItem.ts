import type { ClimacomParsedProduct } from "./parseClimacomProduct";

const WIFI_ACCESSORY_SLUGS = new Set([
  "wi-fi-moduli-mitsubishi-electric",
  "distancionni-upravlenia-aksesoari-wifi",
]);

const WIFI_NAME = /\bwi-?fi\s*(модул|адаптер|adapter)\b|\bmelcloud\b|\bmac-\d+/i;

/** Wi‑Fi модули → accessories; всичко останало от избраните категории → products. */
export function classifyClimacomCatalogItem(item: ClimacomParsedProduct): "climate" | "accessory" {
  if (item.categorySlugs.some((s) => WIFI_ACCESSORY_SLUGS.has(s))) return "accessory";
  if (WIFI_NAME.test(item.name)) return "accessory";
  return "climate";
}

export function inferClimacomAccessoryKind(name: string): "accessory" | "spare_part" | "consumable" {
  if (/\bwi-?fi\b/i.test(name)) return "accessory";
  return "accessory";
}
