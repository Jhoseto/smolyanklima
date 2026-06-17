import { NextResponse } from 'next/server';
import { buildSitemapEntries, renderSitemapXml, type SitemapEntry } from '@/lib/seo/sitemapXml';
import { SITE_ORIGIN } from '@/lib/seo/site';

export const dynamic = 'force-dynamic';

const FALLBACK: SitemapEntry[] = [
  { loc: `${SITE_ORIGIN}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${SITE_ORIGIN}/catalog`, changefreq: 'daily', priority: '0.95' },
  { loc: `${SITE_ORIGIN}/blog`, changefreq: 'daily', priority: '0.9' },
];

// Module-level cache — SEO bots hit sitemap 10+ times/hour; each hit without cache
// costs ~900ms CPU + 3 Supabase queries. Cache resets on instance restart (desired).
let _cache: { xml: string; builtAt: number } | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const XML_HEADERS = {
  'Content-Type': 'application/xml; charset=utf-8',
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

export async function GET() {
  if (_cache && Date.now() - _cache.builtAt < CACHE_TTL_MS) {
    return new NextResponse(_cache.xml, { headers: XML_HEADERS });
  }

  try {
    const entries = await buildSitemapEntries();
    const xml = renderSitemapXml(entries.length ? entries : FALLBACK);
    _cache = { xml, builtAt: Date.now() };
    return new NextResponse(xml, { headers: XML_HEADERS });
  } catch {
    return new NextResponse(renderSitemapXml(FALLBACK), {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
}
