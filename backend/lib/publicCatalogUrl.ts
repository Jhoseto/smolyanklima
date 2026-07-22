import { COMPANY_INFO } from "@/lib/company/companyInfo";

function normalizeOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return defaultPublicFrontendOrigin();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function defaultPublicFrontendOrigin(): string {
  if (process.env.NODE_ENV === "production") {
    return COMPANY_INFO.websiteUrl.replace(/\/$/, "");
  }
  return "http://localhost:3000";
}

/** Origin от env (build / server). */
export function getPublicFrontendOriginFromEnv(): string {
  const raw =
    process.env.NEXT_PUBLIC_SITE_ORIGIN ??
    process.env.NEXT_PUBLIC_FRONTEND_ORIGIN ??
    process.env.FRONTEND_ORIGIN;
  if (raw?.trim()) return normalizeOrigin(raw);
  return defaultPublicFrontendOrigin();
}

function isLocalAdminDevOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    if (u.port !== "3001") return false;
    return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  } catch {
    return false;
  }
}

/** Линкове за клиенти — canonical domain, не вътрешен Cloud Run / dev admin host. */
function shouldUseCanonicalPublicOrigin(origin: string): boolean {
  if (isLocalAdminDevOrigin(origin)) return true;
  try {
    const u = new URL(origin);
    if (u.hostname.endsWith(".run.app")) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * Origin за линкове към публичния каталог.
 * Production (smolyanklima.com): admin + сайт на един origin → window.location.origin.
 * Local dev: админ :3001 → Vite :3000. Cloud Run *.run.app → FRONTEND_ORIGIN / smolyanklima.com.
 */
export function resolvePublicFrontendOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    const origin = window.location.origin.replace(/\/$/, "");
    if (shouldUseCanonicalPublicOrigin(origin)) {
      return getPublicFrontendOriginFromEnv();
    }
    return origin;
  }
  return getPublicFrontendOriginFromEnv();
}

export function publicProductPagePath(slug: string): string {
  return `/product/${encodeURIComponent(slug.trim())}`;
}

export function publicCatalogPath(): string {
  return "/catalog";
}

export function publicOfferPagePath(token: string): string {
  return `/oferta/${encodeURIComponent(token.trim())}`;
}

export function publicCatalogUrl(): string {
  return `${resolvePublicFrontendOrigin()}${publicCatalogPath()}`;
}

/** Пълен URL на публичната оферта (клиентски сайт). */
export function publicOfferPageUrl(token: string): string {
  return `${resolvePublicFrontendOrigin()}${publicOfferPagePath(token)}`;
}

/** Пълен URL на публичната продуктова страница (клиентски сайт). */
export function publicProductPageUrl(slug: string): string {
  return `${resolvePublicFrontendOrigin()}${publicProductPagePath(slug)}`;
}

/** URL към продукт или каталог по налични полета от админ запис. */
export function publicProductOrCatalogUrl(prod: {
  slug?: string | null;
  id?: string | null;
} | null | undefined): string {
  const base = resolvePublicFrontendOrigin();
  if (!prod) return `${base}${publicCatalogPath()}`;
  if (prod.slug?.trim()) return publicProductPageUrl(prod.slug.trim());
  if (prod.id) return publicProductPageUrl(prod.id);
  return `${base}${publicCatalogPath()}`;
}
