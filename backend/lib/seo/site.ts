export const SITE_DOMAIN = process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/^https?:\/\//, '').replace(/\/$/, '')
  || process.env.FRONTEND_ORIGIN?.replace(/^https?:\/\//, '').replace(/\/$/, '')
  || 'smolyanklima.com';

export const SITE_ORIGIN = `https://${SITE_DOMAIN}`;

export function absoluteUrl(path = ''): string {
  if (!path) return SITE_ORIGIN;
  return `${SITE_ORIGIN}${path.startsWith('/') ? path : `/${path}`}`;
}
