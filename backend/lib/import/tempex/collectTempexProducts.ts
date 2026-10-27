import { fetchTempexHtml, TEMPEX_BASE_URL, tempexUrl } from "./tempexHttp";

export const TEMPEX_CATEGORIES = [
  { path: "stenni-klimatici", slug: "wall", type: "Стенен", label: "Стенни климатици" },
  { path: "podovi-klimatici", slug: "floor", type: "Подов", label: "Подови климатици" },
  { path: "kolonni-klimatici", slug: "column", type: "Колонен", label: "Колонни климатици" },
  { path: "multi-split-sistemi", slug: "multi", type: "Мулти", label: "Мулти-сплит системи" },
] as const;

export type TempexCategory = (typeof TEMPEX_CATEGORIES)[number];
export type TempexCatalogEntry = { url: string; category: TempexCategory; sourceId: string; name?: string; listingHasPrice?: boolean };

export function parseTempexListing(html: string, category: TempexCategory): { entries: TempexCatalogEntry[]; pages: number[] } {
  const entries: TempexCatalogEntry[] = [];
  // Only product cards: navigation, recommendations and banner links are deliberately excluded.
  for (const match of html.matchAll(/<article\b([^>]*)>([\s\S]*?)<\/article>/gi)) {
    const id = match[1]!.match(/\bdata-id-product=["'](\d+)["']/)?.[1];
    const href = match[2]!.match(/<h[23]\b[^>]*class=["'][^"']*product-title[^"']*["'][^>]*>\s*<a\b[^>]*href=["']([^"']+)/i)?.[1];
    if (!id || !href) continue;
    const url = tempexUrl(href);
    if (!/^\/bg\/[^/]+\.html$/.test(url.pathname)) throw new Error(`Неочакван продуктов адрес: ${url.href}`);
    url.search = "";
    const title = match[2]!.match(/<h[23]\b[^>]*class=["'][^"']*product-title[^"']*["'][^>]*>[\s\S]*?<a\b[^>]*>([\s\S]*?)<\/a>/i)?.[1];
    const priceBlock = match[2]!.match(/<div\b[^>]*class=["'][^"']*product-price-and-shipping[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
    const priceSpan = priceBlock ? [...priceBlock.matchAll(/<span\b([^>]*)>([\s\S]*?)<\/span>/gi)].find((span) => {
      const classes = span[1]!.match(/\bclass=["']([^"']*)/i)?.[1].split(/\s+/) ?? [];
      return classes.includes("product-price");
    }) : undefined;
    if (priceBlock && !priceSpan) throw new Error(`Променен формат на цената в Tempex: ${url.href}`);
    const rawAmount = priceSpan?.[1].match(/\bcontent=["']([\d.]+)["']/i)?.[1];
    const amount = Number(rawAmount ?? 0);
    const isEuro = Boolean(priceSpan && /€|EUR|&#(?:8364|x20ac);/i.test(priceSpan[2]!));
    if (priceBlock && (rawAmount === undefined || !Number.isFinite(amount) || !isEuro)) {
      throw new Error(`Променен формат на цената в Tempex: ${url.href}`);
    }
    const listingHasPrice = amount > 0 && isEuro;
    entries.push({ url: url.href, sourceId: id, category, name: title?.replace(/<[^>]*>/g, "").trim(), listingHasPrice });
  }
  const pages = new Set<number>([1]);
  const pagination = html.match(/<nav\b[^>]*class=["'][^"']*pagination[^"']*["'][^>]*>([\s\S]*?)<\/nav>/i)?.[1] ?? "";
  for (const match of pagination.matchAll(/href=["']([^"']+)["']/g)) {
    const url = tempexUrl(match[1]!);
    if (url.pathname !== `/bg/${category.path}`) continue;
    const page = Number(url.searchParams.get("page") ?? 1);
    if (Number.isInteger(page) && page >= 1 && page <= 100) pages.add(page);
    else throw new Error(`Невалидно странициране: ${url.href}`);
  }
  return { entries, pages: [...pages] };
}

export async function collectTempexProductUrls(
  limit?: number,
  onProgress?: (message: string, discovered: number) => void,
  fetchHtml: typeof fetchTempexHtml = fetchTempexHtml,
): Promise<TempexCatalogEntry[]> {
  const entries = new Map<string, TempexCatalogEntry>();
  for (const category of TEMPEX_CATEGORIES) {
    let lastPage = 1;
    let categoryCount = 0;
    const fingerprints = new Set<string>();
    for (let page = 1; page <= lastPage; page++) {
      const url = `${TEMPEX_BASE_URL}/bg/${category.path}${page > 1 ? `?page=${page}` : ""}`;
      const parsed = parseTempexListing(await fetchHtml(url), category);
      if (!parsed.entries.length) throw new Error(`Липсват продуктови карти: ${url}. Синхронизацията е спряна за проверка.`);
      const fingerprint = parsed.entries.map((entry) => entry.sourceId).sort().join(",");
      if (fingerprints.has(fingerprint)) throw new Error(`Tempex повтаря страница ${page} в ${category.label}.`);
      fingerprints.add(fingerprint);
      lastPage = Math.max(lastPage, ...parsed.pages);
      for (const entry of parsed.entries) {
        const existing = entries.get(entry.sourceId);
        if (existing && existing.category.slug !== category.slug) {
          throw new Error(`Продукт ${entry.url} присъства в различни категории — необходима е проверка.`);
        }
        entries.set(entry.sourceId, entry);
        categoryCount++;
        if (limit && entries.size >= limit) return [...entries.values()];
      }
      onProgress?.(`${category.label}: страница ${page}/${lastPage}, ${categoryCount} продукта`, entries.size);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  const collected = [...entries.values()];
  if (!collected.some((entry) => entry.listingHasPrice)) {
    throw new Error("Tempex не върна нито една публикувана цена. Проверете формата на каталога; съществуващите продукти не са деактивирани.");
  }
  return collected;
}
