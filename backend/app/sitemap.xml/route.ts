import { NextResponse } from 'next/server';
import { buildSitemapEntries, renderSitemapXml, type SitemapEntry } from '@/lib/seo/sitemapXml';
import { SITE_ORIGIN } from '@/lib/seo/site';

export const dynamic = 'force-dynamic';

const FALLBACK: SitemapEntry[] = [
  { loc: `${SITE_ORIGIN}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${SITE_ORIGIN}/catalog`, changefreq: 'daily', priority: '0.95' },
  { loc: `${SITE_ORIGIN}/blog`, changefreq: 'daily', priority: '0.9' },
];

export async function GET() {
  try {
    const entries = await buildSitemapEntries();
    return new NextResponse(renderSitemapXml(entries.length ? entries : FALLBACK), {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
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
