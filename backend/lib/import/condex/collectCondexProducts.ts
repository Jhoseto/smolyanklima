import { fetchCondexHtml } from "./parseCondexProduct";

export const CONDEX_RAC_HUB = "https://condex.bg/products/za-doma-i-ofisa/";

/** Стенни RAC серии за синхронизация (по заявка). */
export const CONDEX_DEFAULT_SYNC_LISTING_URLS = [
  "https://condex.bg/products/seria-diamond-zsx-zmx/",
  "https://condex.bg/products/seria-diamond-zr/",
  "https://condex.bg/products/seria-premium-pro-bg/",
  "https://condex.bg/products/seria-premium-zs/",
  "https://condex.bg/products/smart-plus/",
  "https://condex.bg/products/seria-standart-zsp/",
  "https://condex.bg/products/kolonni-modeli/",
] as const;

/** Серии от RAC hub (за дома и офиса) + multi-split поддърво. */
export const CONDEX_LISTING_ROOTS: readonly string[] = [
  "https://condex.bg/products/seria-standart-zsp/",
  "https://condex.bg/products/smart-plus/",
  "https://condex.bg/products/seria-premium-zs/",
  "https://condex.bg/products/seria-premium-pro-bg/",
  "https://condex.bg/products/seria-diamond-zsx-zmx/",
  "https://condex.bg/products/seria-diamond-zr/",
  "https://condex.bg/products/seria-diamond-srf/",
  "https://condex.bg/products/%d1%81%d0%b5%d1%80%d0%b8%d1%8f-srr-slim-%d0%ba%d0%b0%d0%bd%d0%b0%d0%bb%d0%b5%d0%bd-%d1%82%d0%b8%d0%bf-%d0%b8%d0%bd%d0%b2%d0%b5%d1%80%d1%82%d0%be%d1%80%d0%bd%d0%b8-%d0%bc%d0%be%d0%b4%d0%b5/",
  "https://condex.bg/products/%d1%81%d0%b5%d1%80%d0%b8%d1%8f-fdtc-%d0%ba%d0%be%d0%bc%d0%bf%d0%b0%d0%ba%d1%82%d0%b5%d0%bd-%d0%ba%d0%b0%d1%81%d0%b5%d1%82%d1%8a%d1%87%d0%b5%d0%bd-%d1%82%d0%b8%d0%bf-%d0%b8%d0%bd%d0%b2%d0%b5%d1%80%d1%82%d0%be%d1%80%d0%bd%d0%b8-%d0%bc%d0%be%d0%b4%d0%b5/",
  "https://condex.bg/products/multi-split/",
  "https://condex.bg/products/vatreshni-tela-za-multi-split/",
  "https://condex.bg/products/vanshni-tela-za-multi-split-sistemi/",
];

/** Листинги извън „За дома и офиса (RAC)“ — не обхождаме. */
const EXCLUDED_LISTING_PATH =
  /sistemi-vazduh-voda|vazduh-voda|termo|teplo|promishlen|klimatizirane|promocia|mitsubishi-heavy-industries|%d0%bd%d0%b0%d0%b9/i;

/** Вътрешни/външни тела само за RAC мултисплит (част от Za doma i ofisa). */
const RAC_MULTI_SPLIT_LISTING = /vatreshni-tela-za-multi-split|vanshni-tela-za-multi-split-sistemi/;

const CRAWL_DELAY_MS = Number(process.env.CONDEX_CRAWL_DELAY_MS) || 350;

export type CondexCrawlProgressHandler = (info: { message: string; discovered: number }) => void;

export type CondexCatalogEntry = {
  url: string;
  listingCategoryPath: string | null;
};

function normalizeProductUrl(href: string): string | null {
  let u = href.trim();
  if (!u) return null;
  if (u.startsWith("/")) u = `https://condex.bg${u}`;
  if (!u.includes("condex.bg/product-details/")) return null;
  if (u.includes("/en/product-details/")) return null;
  try {
    const parsed = new URL(u.split("#")[0]!);
    parsed.hash = "";
    parsed.search = "";
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}/`;
  } catch {
    return null;
  }
}

/** URL от една product card (`product_item_holder`) — по-точен от глобален regex. */
function extractProductUrlFromListingCard(block: string): string | null {
  const detail =
    block.match(/class=["'][^"']*\bdetails\b[^"']*["'][^>]*href=["']([^"']+)["']/i)?.[1] ??
    block.match(/class=["']clean_heading["'][\s\S]*?href=["']([^"']+product-details\/[^"']+)["']/i)?.[1] ??
    block.match(/class=["']imgeffect[^"']*["'][^>]*href=["']([^"']+product-details\/[^"']+)["']/i)?.[1];
  return detail ? normalizeProductUrl(detail) : null;
}

export function extractProductUrlsFromListing(html: string): string[] {
  const out = new Set<string>();
  const cardRe =
    /class=["']col product_item_holder[\s\S]*?(?=class=["']col product_item_holder|<div class=["']row clearfix|<ul class=["']page-numbers)/gi;
  let card: RegExpExecArray | null;
  while ((card = cardRe.exec(html)) !== null) {
    const norm = extractProductUrlFromListingCard(card[0]);
    if (norm) out.add(norm);
  }

  const re = /href=["']([^"']*\/product-details\/[^"'#?]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const norm = normalizeProductUrl(m[1]!);
    if (norm) out.add(norm);
  }
  return [...out];
}

/** Премахва /page/N от края на listing пътя. */
export function stripListingPaginationPath(pathname: string): string {
  return pathname.replace(/\/page\/\d+\/?$/i, "").replace(/\/$/, "") || pathname;
}

function listingPageUrl(origin: string, listingRootPath: string, page: number): string {
  const base = stripListingPaginationPath(listingRootPath);
  if (page <= 1) return `${origin}${base}/`;
  return `${origin}${base}/page/${page}/`;
}

/** Само {root} или {root}/page/N — без вложени /page/2/page/3/. */
function isPaginationForListing(abs: URL, listingRootPath: string): number | null {
  const root = stripListingPaginationPath(listingRootPath);
  const path = abs.pathname.replace(/\/$/, "");
  if (path === root) return 1;
  const m = path.match(new RegExp(`^${root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/page/(\\d+)$`, "i"));
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export function extractPaginationUrls(html: string, listingRootUrl: string): string[] {
  const root = new URL(listingRootUrl);
  const listingRootPath = stripListingPaginationPath(root.pathname);
  const origin = root.origin;

  let maxPage = 1;
  const hrefRe = /href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    const href = m[1]!.trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    try {
      const abs = new URL(href, listingRootUrl);
      if (!abs.hostname.includes("condex.bg")) continue;
      const pageNum = isPaginationForListing(abs, listingRootPath);
      if (pageNum != null && pageNum > maxPage) maxPage = pageNum;
    } catch {
      /* skip */
    }
  }

  // Само page=N в контекст на същия listing root (не глобално в целия HTML)
  const scopedRe = new RegExp(
    `${listingRootPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/page/(\\d+)`,
    "gi",
  );
  let pm: RegExpExecArray | null;
  while ((pm = scopedRe.exec(html)) !== null) {
    const n = Number(pm[1]);
    if (Number.isFinite(n) && n > maxPage && n <= 30) maxPage = n;
  }

  const pages: string[] = [];
  for (let p = 2; p <= maxPage; p++) {
    pages.push(listingPageUrl(origin, listingRootPath, p));
  }
  return pages;
}

/** Всички листинг URL-и (страница 1 + /page/N/) за дадена серия. */
export function buildCondexListingPageUrls(listingRootUrl: string, firstPageHtml: string): string[] {
  const root = new URL(listingRootUrl);
  const listingRootPath = stripListingPaginationPath(root.pathname);
  const origin = root.origin;
  const pages = new Set<string>();
  pages.add(listingPageUrl(origin, listingRootPath, 1));
  for (const p of extractPaginationUrls(firstPageHtml, listingRootUrl)) {
    pages.add(p);
  }
  return [...pages].sort((a, b) => {
    const pa = isPaginationForListing(new URL(a), listingRootPath) ?? 1;
    const pb = isPaginationForListing(new URL(b), listingRootPath) ?? 1;
    return pa - pb;
  });
}

export type CollectCondexUrlsOptions = {
  limit?: number;
  /** Листинг URL-и; по подразбиране шестте стенни RAC серии. */
  listingUrls?: readonly string[];
};

/** Hub RAC е индекс — обхождаме само сериите от „За дома и офиса“, не hub/page/feed и не други раздели. */
function isSeriesListingUrl(url: string): boolean {
  try {
    const p = new URL(url).pathname.toLowerCase();
    if (!p.startsWith("/products/")) return false;
    if (p.includes("/product-details/")) return false;
    if (/\/page\/\d+/.test(p)) return false;
    if (p.endsWith("/feed") || p.includes("/feed/")) return false;
    if (p === "/products/za-doma-i-ofisa/" || p === "/products/za-doma-i-ofisa") return false;
    if (EXCLUDED_LISTING_PATH.test(p)) return false;
    if (RAC_MULTI_SPLIT_LISTING.test(p)) return true;
    // Други vatreshni/vanshni каталози (извън RAC multi) — не
    if (/vatreshni-tela|vanshni-tela/.test(p)) return false;
    return true;
  } catch {
    return false;
  }
}

function listingCategorySpecificity(path: string | null): number {
  if (!path) return 0;
  const p = path.toLowerCase();
  if (p.includes("za-doma-i-ofisa") && !p.includes("seria") && !p.includes("multi")) return 1;
  if (
    p.includes("seria") ||
    p.includes("smart-plus") ||
    p.includes("srr") ||
    p.includes("fdtc") ||
    p.includes("kolonni") ||
    p.includes("fdf") ||
    p.includes("multi-split") ||
    p.includes("vatreshni") ||
    p.includes("vanshni")
  ) {
    return 3;
  }
  return 2;
}

async function discoverListingRootsFromHub(): Promise<string[]> {
  const roots = new Set<string>();
  for (const u of CONDEX_LISTING_ROOTS) {
    if (isSeriesListingUrl(u)) roots.add(u.endsWith("/") ? u : `${u}/`);
  }
  try {
    const html = await fetchCondexHtml(CONDEX_RAC_HUB);
    const re = /href=["'](https:\/\/condex\.bg\/products\/[^"'#?]+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const u = m[1]!.endsWith("/") ? m[1]! : `${m[1]}/`;
      if (u.includes("/en/products/")) continue;
      if (isSeriesListingUrl(u)) roots.add(u);
    }
  } catch {
    /* hub optional */
  }
  return [...roots];
}

async function crawlCondexListingSeries(
  rootUrl: string,
  productEntries: Map<string, CondexCatalogEntry>,
  limit: number | undefined,
  onProgress?: CondexCrawlProgressHandler,
): Promise<boolean> {
  const listingRootPath = stripListingPaginationPath(new URL(rootUrl).pathname);
  const listingRootUrl = listingPageUrl(new URL(rootUrl).origin, listingRootPath, 1);
  const listingPath = listingRootPath;

  const seedHtml = await fetchCondexHtml(listingRootUrl);
  const pageUrls = buildCondexListingPageUrls(listingRootUrl, seedHtml);
  onProgress?.({
    message: `Серия ${listingPath}: ${pageUrls.length} страници листинг`,
    discovered: productEntries.size,
  });

  for (let i = 0; i < pageUrls.length; i++) {
    const pageUrl = pageUrls[i]!;
    try {
      const html = i === 0 ? seedHtml : await fetchCondexHtml(pageUrl);
      const before = productEntries.size;
      for (const u of extractProductUrlsFromListing(html)) {
        const prev = productEntries.get(u);
        const spec = listingCategorySpecificity(listingPath);
        const prevSpec = listingCategorySpecificity(prev?.listingCategoryPath ?? null);
        if (!prev || spec > prevSpec) {
          productEntries.set(u, { url: u, listingCategoryPath: listingPath });
        }
        if (limit && productEntries.size >= limit) {
          onProgress?.({
            message: `Намерени ${productEntries.size} продукта (лимит ${limit})`,
            discovered: productEntries.size,
          });
          return true;
        }
      }
      if (productEntries.size > before) {
        onProgress?.({
          message: `Листинг ${listingPath} (${i + 1}/${pageUrls.length}) — ${productEntries.size} продукта`,
          discovered: productEntries.size,
        });
      }
    } catch (e: unknown) {
      onProgress?.({
        message: `Пропуснат листинг ${pageUrl}: ${e instanceof Error ? e.message : String(e)}`,
        discovered: productEntries.size,
      });
    }
    await new Promise((r) => setTimeout(r, CRAWL_DELAY_MS));
  }
  return false;
}

export async function collectCondexProductUrls(
  limitOrOpts?: number | CollectCondexUrlsOptions,
  onProgress?: CondexCrawlProgressHandler,
): Promise<CondexCatalogEntry[]> {
  const opts: CollectCondexUrlsOptions =
    typeof limitOrOpts === "number" || limitOrOpts === undefined
      ? { limit: limitOrOpts }
      : limitOrOpts;
  const limit = opts.limit;

  let listingRoots: string[];
  if (opts.listingUrls?.length) {
    listingRoots = opts.listingUrls.map((u) => (u.endsWith("/") ? u : `${u}/`));
    onProgress?.({
      message: `Обхождане на ${listingRoots.length} серии: ${listingRoots.map((u) => new URL(u).pathname).join(", ")}`,
      discovered: 0,
    });
  } else {
    onProgress?.({ message: "Зареждане на RAC серии от condex.bg…", discovered: 0 });
    listingRoots = await discoverListingRootsFromHub();
    onProgress?.({
      message: `Обхождане на ${listingRoots.length} листинга (RAC + multi-split)…`,
      discovered: 0,
    });
  }

  const productEntries = new Map<string, CondexCatalogEntry>();

  for (const rootUrl of listingRoots) {
    const hitLimit = await crawlCondexListingSeries(rootUrl, productEntries, limit, onProgress);
    if (hitLimit) return [...productEntries.values()];
  }

  onProgress?.({
    message: `Обходът приключи — ${productEntries.size} продукта`,
    discovered: productEntries.size,
  });
  return [...productEntries.values()];
}
