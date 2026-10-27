export const TEMPEX_BASE_URL = "https://tempex.bg";

export class TempexRateLimitError extends Error {
  constructor() { super("Tempex временно ограничи достъпа. Синхронизацията е спряна; опитайте отново по-късно."); }
}

let nextRequestAt = 0;
let readerActive = false;
async function throttle(reader = false): Promise<void> {
  const configured = Number(process.env.TEMPEX_REQUEST_INTERVAL_MS);
  const interval = Math.max(reader ? 3300 : 2000, Number.isFinite(configured) && configured >= 1500 ? configured : 0);
  const scheduled = Math.max(Date.now(), nextRequestAt);
  nextRequestAt = scheduled + interval;
  if (scheduled > Date.now()) await new Promise((resolve) => setTimeout(resolve, scheduled - Date.now()));
}

/** Public HTML only: never forward cookies, authorization headers or private URLs to the reader. */
async function fetchReaderHtml(url: URL): Promise<string> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await throttle(true);
      const response = await fetch(`https://r.jina.ai/${url.href}`, {
        headers: { "X-Return-Format": "html", "X-No-Cache": "true", "X-Wait-For-Selector": url.pathname.endsWith(".html") ? "[data-product]" : "article[data-id-product]" },
        redirect: "error", cache: "no-store", signal: AbortSignal.timeout(90_000),
      });
      if (response.status === 429) throw new TempexRateLimitError();
      if (!response.ok) throw new Error(`Публичен HTML четец: HTTP ${response.status} за ${url.href}`);
      const html = await response.text();
      if (!isTempexCatalogHtml(html, url)) throw new Error(`Не е заредено продуктовото съдържание от Tempex: ${url.href}`);
      return html;
    } catch (error) {
      if (error instanceof TempexRateLimitError) throw error;
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)));
    }
  }
  throw lastError;
}

export function isTempexCatalogHtml(html: string, url: URL): boolean {
  return /<html\b/i.test(html) && /tempex\.bg/i.test(html)
    && (url.pathname.endsWith(".html") ? /\bdata-product="/.test(html) : /<article\b[^>]*data-id-product=/.test(html));
}

export function tempexUrl(href: string, base = TEMPEX_BASE_URL): URL {
  const url = new URL(href.replace(/&amp;/g, "&"), base);
  if (url.protocol !== "https:" || !["tempex.bg", "www.tempex.bg"].includes(url.hostname) || url.username || url.password) {
    throw new Error(`Невалиден Tempex адрес: ${href}`);
  }
  url.hostname = "tempex.bg";
  url.hash = "";
  return url;
}

/** Bounded retries; TLS verification stays enabled. Never follow redirects off the supplier's site. */
export async function fetchTempexHtml(href: string): Promise<string> {
  const publicUrl = tempexUrl(href);
  if (!/^\/bg\/(?:[a-z0-9-]+(?:\.html)?|)$/.test(publicUrl.pathname) || [...publicUrl.searchParams.keys()].some((key) => !/^(?:page|resultsPerPage|group\[\d+\])$/.test(key))) {
    throw new Error(`Неподдържан публичен каталожен адрес: ${publicUrl.href}`);
  }
  if (process.env.TEMPEX_FETCH_MODE === "reader" || readerActive) return fetchReaderHtml(publicUrl);
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let url = tempexUrl(href);
      for (let redirect = 0; redirect <= 4; redirect++) {
        await throttle();
        const response = await fetch(url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; SmolyanKlimaCatalog/1.0)", "Accept-Language": "bg,en;q=0.8" },
          redirect: "manual",
          cache: "no-store",
          signal: AbortSignal.timeout(30_000),
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          if (!location) throw new Error("Tempex пренасочва без адрес.");
          if (new URL(location, url).hostname.replace(/^www\./, "") === "google.com") throw new TempexRateLimitError();
          url = tempexUrl(location, url.href);
          continue;
        }
        if ([403, 429].includes(response.status)) throw new TempexRateLimitError();
        if (!response.ok) throw new Error(`Tempex HTTP ${response.status}: ${url.href}`);
        const html = await response.text();
        if (!/<html\b/i.test(html)) throw new Error(`Tempex върна невалидна HTML страница: ${url.href}`);
        return html;
      }
      throw new Error("Твърде много пренасочвания от Tempex.");
    } catch (error) {
      // Stop immediately on supplier throttling. Do not keep trying hundreds of blocked product URLs.
      if (error instanceof TempexRateLimitError) {
        if (process.env.TEMPEX_FETCH_MODE === "direct") throw error;
        readerActive = true;
        return fetchReaderHtml(publicUrl);
      }
      lastError = error;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
  if (process.env.TEMPEX_FETCH_MODE !== "direct") {
    readerActive = true;
    return fetchReaderHtml(publicUrl);
  }
  throw lastError;
}
