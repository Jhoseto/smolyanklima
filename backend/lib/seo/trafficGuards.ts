/** Fast checks for scanner/exploit traffic — does not affect normal browsers. */

const EXPLOIT_PATH =
  /ajaxpro|\.ashx|wp-admin|wp-login|phpmyadmin|xmlrpc\.php|\/\.env|vendor\/phpunit|\.php\.|\/cgi-bin\//i;

const SECURITY_SCANNER_UA =
  /zgrab\/|censys|xpanse|palo\s*alto|l9tcpid|l9explore|leakix|masscan|nikto|sqlmap/i;

/** SEO tools that crawl infinite ?page=&tag= variants — not in isSeoBot (no DB seo-render). */
const AGGRESSIVE_SEO_CRAWLER_UA = /serpstatbot|serpstat\.com/i;

/** Old import URLs (--slug, ---slug) — bots only in practice. */
const LEGACY_SLUG_PATH = /^\/-{2,}[^/]*/;

/** Paths where real users legitimately use query strings. */
const USER_QUERY_PATHS = ["/catalog", "/blog/tursi"];

export function isExploitProbe(pathname: string): boolean {
  return EXPLOIT_PATH.test(pathname);
}

export function isSecurityScanner(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return SECURITY_SCANNER_UA.test(userAgent);
}

export function isAggressiveSeoCrawler(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return AGGRESSIVE_SEO_CRAWLER_UA.test(userAgent);
}

export function isLegacySlugPath(pathname: string): boolean {
  return LEGACY_SLUG_PATH.test(pathname);
}

/** Aggressive crawlers: strip ?… everywhere except catalog/blog search (humans use normal UAs). */
export function shouldRedirectAggressiveBotQuery(pathname: string, hasQuery: boolean): boolean {
  if (!hasQuery) return false;
  if (USER_QUERY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }
  return true;
}
