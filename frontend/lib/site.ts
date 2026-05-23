/** Публичен домейн на сайта — един източник на истина за SEO, legal и споделяне. */
export const SITE_DOMAIN = 'smolyanklima.com';
export const SITE_ORIGIN = `https://${SITE_DOMAIN}`;

export function absoluteUrl(path = ''): string {
  if (!path) return SITE_ORIGIN;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
