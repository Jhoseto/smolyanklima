import { absoluteUrl } from './site';
import type { SeoPage } from './pages';

import { escapeHtml as esc } from '@/lib/security/htmlEscape';

export function renderSeoHtml(page: SeoPage, schemas: Record<string, unknown>[] = []): string {
  const canonical = absoluteUrl(page.canonicalPath);
  const ogImage = absoluteUrl(page.ogImage ?? '/images/hero-new.jpg');
  const robots = page.noindex ? 'noindex, follow' : 'index, follow';
  const keywords = page.keywords?.length ? `<meta name="keywords" content="${esc(page.keywords.join(', '))}" />` : '';
  const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const googleMeta = googleVerification
    ? `<meta name="google-site-verification" content="${esc(googleVerification)}" />`
    : '';
  const schemaScripts = schemas
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join('\n  ');
  const ogType = page.ogType ?? 'website';
  const ogImageType = page.ogImageType ?? (ogImage.endsWith('.png') ? 'image/png' : 'image/jpeg');
  const ogImageAlt = page.ogImageAlt ?? page.title.split('|')[0].trim();

  return `<!DOCTYPE html>
<html lang="bg">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(page.title)}</title>
  <meta name="description" content="${esc(page.description)}" />
  ${keywords}
  <meta name="robots" content="${robots}" />
  ${googleMeta}
  <link rel="canonical" href="${esc(canonical)}" />
  <link rel="alternate" hreflang="bg" href="${esc(canonical)}" />
  <meta property="og:title" content="${esc(page.title)}" />
  <meta property="og:description" content="${esc(page.description)}" />
  <meta property="og:type" content="${ogType}" />
  <meta property="og:url" content="${esc(canonical)}" />
  <meta property="og:image" content="${esc(ogImage)}" />
  <meta property="og:image:secure_url" content="${esc(ogImage)}" />
  <meta property="og:image:type" content="${esc(ogImageType)}" />
  <meta property="og:image:alt" content="${esc(ogImageAlt)}" />
  ${page.ogImageWidth ? `<meta property="og:image:width" content="${page.ogImageWidth}" />` : ''}
  ${page.ogImageHeight ? `<meta property="og:image:height" content="${page.ogImageHeight}" />` : ''}
  <link rel="image_src" href="${esc(ogImage)}" />
  <meta property="og:locale" content="bg_BG" />
  <meta property="og:site_name" content="Smolyan Klima" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${esc(page.title)}" />
  <meta name="twitter:description" content="${esc(page.description)}" />
  <meta name="twitter:image" content="${esc(ogImage)}" />
  <link rel="alternate" type="application/rss+xml" title="Smolyan Klima Blog" href="${esc(absoluteUrl('/rss.xml'))}" />
  <link rel="alternate" type="text/plain" href="${esc(absoluteUrl('/llms.txt'))}" title="LLM site summary" />
  ${schemaScripts}
</head>
<body>
  <main>${page.bodyHtml ?? `<h1>${esc(page.title.split('|')[0].trim())}</h1><p>${esc(page.description)}</p>`}</main>
  <p><a href="${esc(canonical)}">Виж пълната страница на smolyanklima.com</a></p>
</body>
</html>`;
}
