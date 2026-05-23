import { NextResponse } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { SITE_ORIGIN } from '@/lib/seo/site';

export async function GET() {
  const supabase = createSupabaseServiceRoleClient();
  const { data } = await supabase
    .from('articles')
    .select('slug,title,excerpt,published_at')
    .eq('is_published', true)
    .order('published_at', { ascending: false })
    .limit(30);

  const items = (data ?? []).map((a) => {
    const row = a as { slug: string; title: string; excerpt?: string | null; published_at?: string };
    return `
    <item>
      <title><![CDATA[${row.title}]]></title>
      <link>${SITE_ORIGIN}/blog/${row.slug}</link>
      <guid isPermaLink="true">${SITE_ORIGIN}/blog/${row.slug}</guid>
      <description><![CDATA[${row.excerpt ?? ''}]]></description>
      <pubDate>${row.published_at ? new Date(row.published_at).toUTCString() : new Date().toUTCString()}</pubDate>
    </item>`;
  }).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Smolyan Klima Blog</title>
    <link>${SITE_ORIGIN}/blog</link>
    <description>Експертни съвети за климатици — Смолян Клима</description>
    <language>bg</language>
    <atom:link href="${SITE_ORIGIN}/rss.xml" rel="self" type="application/rss+xml"/>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
