import { NextRequest, NextResponse } from 'next/server';
import { resolveSeoForPath } from '@/lib/seo/resolveSeo';
import { renderSeoHtml } from '@/lib/seo/renderHtml';

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path') ?? '/';
  try {
    const { page, schemas } = await resolveSeoForPath(path);
    const html = renderSeoHtml(page, schemas);
    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch {
    return new NextResponse('Service unavailable', { status: 503 });
  }
}
