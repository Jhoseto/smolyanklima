import { fetchBittelHtml, BITTEL_BASE_URL } from "./parseBittelProduct";

/** Listing pages to crawl (climate + multisplit + accessories). */
export const BITTEL_LISTING_ROOTS = [
  { url: `${BITTEL_BASE_URL}/c/klimatici/invertorni-klimatici`, path: "/c/klimatici/invertorni-klimatici" },
  { url: `${BITTEL_BASE_URL}/c/klimatici/invertorni-multisplit-sistemi`, path: "/c/klimatici/invertorni-multisplit-sistemi" },
  { url: `${BITTEL_BASE_URL}/c/klimatici/profesionalni/kolonni-klimatici`, path: "/c/klimatici/profesionalni/kolonni-klimatici" },
  { url: `${BITTEL_BASE_URL}/c/klimatici/aksesoari`, path: "/c/klimatici/aksesoari" },
] as const;

const CRAWL_DELAY_MS = Number(process.env.BITTEL_CRAWL_DELAY_MS) || 150;

/** Top-level paths that are NOT product pages */
const NON_PRODUCT_PATH = /^\/c\/|^\/terms\/|^\/novini\/|^\/news\/|^\/o-nas\/|^\/contacts?\/|^\/kontakti\/|^\/web\/|^\/search|^\/logoff|^\/login|^\/cart|^\/wishlist|^\/compare|^\/profile|^\/staff\/|^\/about|^\/delivery|^\/warranty|^\/dostavka|^\/reklamacia|^\/sertifi/i;

export type BittelCatalogEntry = {
  url: string;
  listingCategoryPath: string;
};

export type BittelCrawlProgressHandler = (info: { message: string; discovered: number }) => void;

function normalizeProductUrl(href: string, baseUrl = BITTEL_BASE_URL): string | null {
  let u = href.trim();
  if (!u || u.startsWith("#") || u.startsWith("javascript:") || u.startsWith("mailto:")) return null;
  if (u.startsWith("//")) u = `https:${u}`;
  if (u.startsWith("/")) u = `${baseUrl}${u}`;

  try {
    const parsed = new URL(u);
    if (!parsed.hostname.includes("bittel.bg")) return null;
    const path = parsed.pathname;

    // Must be a top-level path (one segment) — product slugs are top-level on bittel.bg
    const segments = path.replace(/^\/|\/$/g, "").split("/");
    if (segments.length !== 1 || !segments[0]) return null;

    // Exclude known non-product paths
    if (NON_PRODUCT_PATH.test(path)) return null;

    // Exclude pagination paths
    if (/^\?|page=|\/page\//i.test(path)) return null;

    // Clean URL
    parsed.hash = "";
    parsed.search = "";
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

function extractProductUrlsFromListing(html: string): string[] {
  const out = new Set<string>();

  // Prefer listing card data-url (authoritative product links)
  const dataUrlRe = /data-url=["'](https?:\/\/[^"']+|\/[^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = dataUrlRe.exec(html)) !== null) {
    const norm = normalizeProductUrl(m[1]!);
    if (norm) out.add(norm);
  }

  const hrefRe = /href=["']([^"']+)["']/gi;
  while ((m = hrefRe.exec(html)) !== null) {
    const norm = normalizeProductUrl(m[1]!);
    if (norm) out.add(norm);
  }
  return [...out];
}

/**
 * Max listing page. Bittel pagination often only shows nearby page links (1–5),
 * while the counter shows the real total ("1 до 16 от 267"). Always prefer the
 * counter when present, otherwise fall back to the highest ?page=N link.
 */
function extractMaxPage(html: string, listingUrl: string): number {
  let maxPage = 1;

  // Counter: "Показани 1 до 16 от 267" (may span whitespace/newlines)
  const countMatch =
    html.match(/до\s+(\d+)\s+от\s+(\d+)/i) ?? html.match(/(\d{1,3})\s+от\s+(\d{2,4})\b/i);
  if (countMatch?.[1] && countMatch?.[2]) {
    const perPage = Number(countMatch[1]);
    const total = Number(countMatch[2]);
    if (perPage > 0 && total > 0 && total >= perPage) {
      maxPage = Math.max(maxPage, Math.ceil(total / perPage));
    }
  }

  // Also consider ?page=N links / <link rel="next">
  const pageRe = /(?:href|content)=["'][^"']*\?(?:[^"']*&)?page=(\d+)[^"']*["']/gi;
  let m: RegExpExecArray | null;
  while ((m = pageRe.exec(html)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxPage && n <= 100) maxPage = n;
  }

  void listingUrl;
  return Math.min(maxPage, 100);
}

function listingHasNextPage(html: string, currentPage: number): boolean {
  if (/<li[^>]*class=["'][^"']*\bnext\b[^"']*["'][^>]*>\s*<a\s[^>]*href=/i.test(html)) {
    return true;
  }
  const nextLink = html.match(/<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)["']/i);
  if (nextLink?.[1] && /[?&]page=\d+/i.test(nextLink[1])) return true;
  const pageRe = /[?&]page=(\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = pageRe.exec(html)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > currentPage) return true;
  }
  return false;
}

function listingPageUrl(baseUrl: string, page: number): string {
  if (page <= 1) return baseUrl;
  return `${baseUrl}?page=${page}`;
}

export async function collectBittelProductUrls(
  limit?: number,
  onProgress?: BittelCrawlProgressHandler,
): Promise<BittelCatalogEntry[]> {
  const productEntries = new Map<string, BittelCatalogEntry>();

  for (const { url: listingRootUrl, path: listingPath } of BITTEL_LISTING_ROOTS) {
    onProgress?.({
      message: `Обхождане на ${listingPath}…`,
      discovered: productEntries.size,
    });

    let page = 1;
    let maxPage = 1;

    while (page <= maxPage) {
      const pageUrl = listingPageUrl(listingRootUrl, page);
      try {
        const html = await fetchBittelHtml(pageUrl);

        const pageEstimate = extractMaxPage(html, listingRootUrl);
        if (pageEstimate > maxPage) maxPage = pageEstimate;

        const urls = extractProductUrlsFromListing(html);
        // Empty page past page 1 → end of listing
        if (page > 1 && urls.length === 0) {
          onProgress?.({
            message: `${listingPath} стр.${page} празна — край на обхода`,
            discovered: productEntries.size,
          });
          break;
        }

        for (const u of urls) {
          if (!productEntries.has(u)) {
            productEntries.set(u, { url: u, listingCategoryPath: listingPath });
          }
        }

        // Pagination UI often truncates (shows only 1–5). If a "next" link exists
        // at the current max, keep going one page further.
        if (page >= maxPage && listingHasNextPage(html, page) && maxPage < 100) {
          maxPage = page + 1;
        }

        onProgress?.({
          message: `${listingPath} стр.${page}/${maxPage} — ${productEntries.size} продукта`,
          discovered: productEntries.size,
        });

        if (limit && productEntries.size >= limit) {
          return [...productEntries.values()].slice(0, limit);
        }
      } catch (e: unknown) {
        onProgress?.({
          message: `Грешка при ${pageUrl}: ${e instanceof Error ? e.message : String(e)}`,
          discovered: productEntries.size,
        });
      }

      page++;
      if (page <= maxPage) {
        await new Promise((r) => setTimeout(r, CRAWL_DELAY_MS));
      }
    }
  }

  onProgress?.({
    message: `Обходът приключи — ${productEntries.size} продукта`,
    discovered: productEntries.size,
  });

  return [...productEntries.values()];
}
