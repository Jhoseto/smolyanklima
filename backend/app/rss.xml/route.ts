import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/server';
import { SITE_ORIGIN } from '@/lib/seo/site';

export const dynamic = 'force-dynamic';

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function cdata(value: string): string {
  return `<![CDATA[${value.replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;
}

function emptyRss(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Smolyan Klima Blog</title>
    <link>${escapeXml(`${SITE_ORIGIN}/blog`)}</link>
    <description>Експертни съвети за климатици — Смолян Клима</description>
    <language>bg</language>
    <atom:link href="${escapeXml(`${SITE_ORIGIN}/rss.xml`)}" rel="self" type="application/rss+xml"/>
  </channel>
</rss>`;
}

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from('articles')
      .select('slug,title,excerpt,published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(30);

    if (error) {
      return new NextResponse(emptyRss(), {
        status: 200,
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    const items = (data ?? []).map((a) => {
      const row = a as { slug: string; title: string; excerpt?: string | null; published_at?: string };
      const pubDate = row.published_at ? new Date(row.published_at).toUTCString() : new Date().toUTCString();
      return `
    <item>
      <title>${cdata(row.title)}</title>
      <link>${escapeXml(`${SITE_ORIGIN}/blog/${row.slug}`)}</link>
      <guid isPermaLink="true">${escapeXml(`${SITE_ORIGIN}/blog/${row.slug}`)}</guid>
      <description>${cdata(row.excerpt ?? '')}</description>
      <pubDate>${escapeXml(pubDate)}</pubDate>
    </item>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Smolyan Klima Blog</title>
    <link>${escapeXml(`${SITE_ORIGIN}/blog`)}</link>
    <description>Експертни съвети за климатици — Смолян Клима</description>
    <language>bg</language>
    <atom:link href="${escapeXml(`${SITE_ORIGIN}/rss.xml`)}" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

    return new NextResponse(xml, {
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new NextResponse(emptyRss(), {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
}
