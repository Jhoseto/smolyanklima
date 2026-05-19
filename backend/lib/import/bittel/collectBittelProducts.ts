import { fetchBittelHtml, BITTEL_BASE_URL } from "./parseBittelProduct";

/** Listing pages to crawl (climate + multisplit + accessories). */
export const BITTEL_LISTING_ROOTS = [
  { url: `${BITTEL_BASE_URL}/c/klimatici/invertorni-klimatici`, path: "/c/klimatici/invertorni-klimatici" },
  { url: `${BITTEL_BASE_URL}/c/klimatici/invertorni-multisplit-sistemi`, path: "/c/klimatici/invertorni-multisplit-sistemi" },
  { url: `${BITTEL_BASE_URL}/c/klimatici/aksesoari`, path: "/c/klimatici/aksesoari" },
] as const;

const CRAWL_DELAY_MS = Number(process.env.BITTEL_CRAWL_DELAY_MS) || 500;

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
  const hrefRe = /href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    const norm = normalizeProductUrl(m[1]!);
    if (norm) out.add(norm);
  }
  return [...out];
}

/** Find max page number from pagination links.
 * Bittel uses: ?page=2, ?page=3, etc. */
function extractMaxPage(html: string, listingUrl: string): number {
  let maxPage = 1;

  // Look for ?page=N in href attributes
  const pageRe = /href=["'][^"']*\?(?:[^"']*&)?page=(\d+)[^"']*["']/gi;
  let m: RegExpExecArray | null;
  while ((m = pageRe.exec(html)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > maxPage && n <= 100) maxPage = n;
  }

  // Also look for page numbers in text "от 255" / "12 от 255" → 255/12 ≈ 22 pages
  if (maxPage === 1) {
    const countMatch = html.match(/до\s+(\d+)\s+от\s+(\d+)/i) ?? html.match(/(\d+)\s+от\s+(\d+)/i);
    if (countMatch?.[1] && countMatch?.[2]) {
      const perPage = Number(countMatch[1]);
      const total = Number(countMatch[2]);
      if (perPage > 0 && total > 0) {
        maxPage = Math.ceil(total / perPage);
      }
    }
  }

  void listingUrl;
  return maxPage;
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

        if (page === 1) {
          maxPage = extractMaxPage(html, listingRootUrl);
        }

        const urls = extractProductUrlsFromListing(html);
        for (const u of urls) {
          if (!productEntries.has(u)) {
            productEntries.set(u, { url: u, listingCategoryPath: listingPath });
          }
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
