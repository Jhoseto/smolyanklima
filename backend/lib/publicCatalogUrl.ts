/** URL на публичната продуктова страница (клиентски сайт). */
export function publicProductPageUrl(slug: string): string {
  const origin = (
    process.env.NEXT_PUBLIC_FRONTEND_ORIGIN ??
    process.env.FRONTEND_ORIGIN ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const path = `/product/${encodeURIComponent(slug.trim())}`;
  return `${origin}${path}`;
}
