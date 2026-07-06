import { CLIMACOM_WC_API, type ClimacomWcProduct } from "./parseClimacomProduct";

const UA = "SmolyanKlimaCatalogSync/1.0";

/** Климатици за дома: стенни, мултисплит, касетъчни. */
export const CLIMACOM_CLIMATE_CATEGORY_SLUGS = [
  "stenni-klimatici",
  "multisplit-sistemi",
  "chetiristruini-kaseti",      // 4-stream cassette
  "ednostruyna-kaseta-mlz-kp",  // 1-stream cassette MLZ-KP
  "kolonen-tip",                // PSA-M column units (Standard + Power Inverter)
] as const;

/** Wi‑Fi модули, дистанционни управления и аксесоари. */
export const CLIMACOM_ACCESSORY_CATEGORY_SLUGS = [
  "wi-fi-moduli-mitsubishi-electric",
  "distancionni-upravlenia-mitsubishi-electric",
] as const;

async function fetchWcPage(url: string): Promise<ClimacomWcProduct[]> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Climacom API ${res.status}: ${url}`);
  return res.json() as Promise<ClimacomWcProduct[]>;
}

async function collectCategory(
  categorySlug: string,
  limit?: number,
  onProgress?: (message: string) => void,
): Promise<ClimacomWcProduct[]> {
  const out: ClimacomWcProduct[] = [];
  let page = 1;
  while (true) {
    if (limit != null && out.length >= limit) break;
    const perPage = limit != null ? Math.min(100, limit - out.length) : 100;
    const url = `${CLIMACOM_WC_API}/products?category=${encodeURIComponent(categorySlug)}&per_page=${perPage}&page=${page}`;
    onProgress?.(`Категория „${categorySlug}“ — страница ${page}…`);
    const batch = await fetchWcPage(url);
    if (!batch.length) break;
    out.push(...batch);
    if (batch.length < perPage) break;
    page++;
    await new Promise((r) => setTimeout(r, 300));
  }
  return limit != null ? out.slice(0, limit) : out;
}

export async function collectClimacomCatalogProducts(opts?: {
  limit?: number;
  onProgress?: (message: string) => void;
}): Promise<ClimacomWcProduct[]> {
  const slugs = [...CLIMACOM_CLIMATE_CATEGORY_SLUGS, ...CLIMACOM_ACCESSORY_CATEGORY_SLUGS];
  const byId = new Map<number, ClimacomWcProduct>();

  for (const slug of slugs) {
    const batch = await collectCategory(slug, undefined, opts?.onProgress);
    for (const p of batch) byId.set(p.id, p);
  }

  const all = [...byId.values()];
  return opts?.limit != null ? all.slice(0, opts.limit) : all;
}
