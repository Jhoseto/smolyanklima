import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { applyPublicCatalogFilter } from '@/lib/catalog/publicProductVisibility';
import { SITE_ORIGIN } from '@/lib/seo/site';

export const dynamic = 'force-dynamic';

type SitemapEntry = {
  loc: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
};

const STATIC_PAGES: SitemapEntry[] = [
  { loc: `${SITE_ORIGIN}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${SITE_ORIGIN}/catalog`, changefreq: 'daily', priority: '0.95' },
  { loc: `${SITE_ORIGIN}/services`, changefreq: 'monthly', priority: '0.85' },
  { loc: `${SITE_ORIGIN}/contact`, changefreq: 'monthly', priority: '0.85' },
  { loc: `${SITE_ORIGIN}/za-nas`, changefreq: 'monthly', priority: '0.8' },
  { loc: `${SITE_ORIGIN}/blog`, changefreq: 'daily', priority: '0.9' },
  { loc: `${SITE_ORIGIN}/klimatik-smolyan`, changefreq: 'monthly', priority: '0.92' },
  { loc: `${SITE_ORIGIN}/klimatik-rudozem`, changefreq: 'monthly', priority: '0.88' },
  { loc: `${SITE_ORIGIN}/klimatik-madan`, changefreq: 'monthly', priority: '0.88' },
  { loc: `${SITE_ORIGIN}/klimatik-devin`, changefreq: 'monthly', priority: '0.88' },
  { loc: `${SITE_ORIGIN}/klimatik-chepelare`, changefreq: 'monthly', priority: '0.88' },
  { loc: `${SITE_ORIGIN}/montaj-klimatik-smolyan`, changefreq: 'monthly', priority: '0.93' },
  { loc: `${SITE_ORIGIN}/politika-za-poveritelnost`, changefreq: 'yearly', priority: '0.2' },
  { loc: `${SITE_ORIGIN}/biskvitki`, changefreq: 'yearly', priority: '0.2' },
  { loc: `${SITE_ORIGIN}/obshti-usloviya`, changefreq: 'yearly', priority: '0.2' },
];

function safeIsoDate(value?: string | null): string {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderSitemap(entries: SitemapEntry[]): string {
  const now = new Date().toISOString();
  const urls = entries.map((entry) => {
    const lastmod = entry.lastmod ?? now;
    const parts = [
      '  <url>',
      `    <loc>${escapeXml(entry.loc)}</loc>`,
      `    <lastmod>${lastmod}</lastmod>`,
    ];
    if (entry.changefreq) parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
    if (entry.priority) parts.push(`    <priority>${entry.priority}</priority>`);
    parts.push('  </url>');
    return parts.join('\n');
  });

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
}

export async function GET() {
  const now = new Date().toISOString();
  const entries: SitemapEntry[] = STATIC_PAGES.map((entry) => ({ ...entry, lastmod: now }));

  try {
    const supabase = createSupabaseServiceRoleClient();

    const { data: products, error: productsError } = await applyPublicCatalogFilter(
      supabase.from('products').select('slug, updated_at').order('updated_at', { ascending: false }),
    ).limit(2000);

    if (!productsError) {
      for (const row of products ?? []) {
        const slug = String((row as { slug?: string | null }).slug ?? '').trim();
        if (!slug) continue;
        entries.push({
          loc: `${SITE_ORIGIN}/product/${encodeURIComponent(slug)}`,
          lastmod: safeIsoDate((row as { updated_at?: string | null }).updated_at),
          changefreq: 'weekly',
          priority: '0.75',
        });
      }
    }

    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('slug, modified_at, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(500);

    if (!articlesError) {
      for (const row of articles ?? []) {
        const slug = String((row as { slug?: string | null }).slug ?? '').trim();
        if (!slug) continue;
        const article = row as { modified_at?: string | null; published_at?: string | null };
        entries.push({
          loc: `${SITE_ORIGIN}/blog/${encodeURIComponent(slug)}`,
          lastmod: safeIsoDate(article.modified_at ?? article.published_at),
          changefreq: 'monthly',
          priority: '0.7',
        });
      }
    }

    const { data: accessories, error: accessoriesError } = await supabase
      .from('accessories')
      .select('id, slug, updated_at')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(500);

    if (!accessoriesError) {
      for (const row of accessories ?? []) {
        const accessory = row as { id: string; slug?: string | null; updated_at?: string | null };
        const key = String(accessory.slug ?? accessory.id).trim();
        if (!key) continue;
        entries.push({
          loc: `${SITE_ORIGIN}/aksesoar/${encodeURIComponent(key)}`,
          lastmod: safeIsoDate(accessory.updated_at),
          changefreq: 'monthly',
          priority: '0.6',
        });
      }
    }
  } catch {
    // Static pages only if Supabase is unavailable.
  }

  return new NextResponse(renderSitemap(entries), {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
