import { NextRequest, NextResponse } from 'next/server';
import { resolveSeoForPath } from '@/lib/seo/resolveSeo';
import { renderSeoHtml } from '@/lib/seo/renderHtml';
import { allowPublicPost, getClientIdFromRequest } from '@/lib/rate-limit';

const MAX_PATH_LEN = 256;
const ALLOWED_PATH = /^\/[a-zA-Z0-9/_\-%.]*$/;

export async function GET(req: NextRequest) {
  const clientId = getClientIdFromRequest(req);
  if (!allowPublicPost(`seo-render:${clientId}`, 60, 60 * 1000)) {
    return new NextResponse('Too Many Requests', { status: 429 });
  }

  const rawPath = req.nextUrl.searchParams.get('path') ?? '/';
  const path = rawPath.split('?')[0].slice(0, MAX_PATH_LEN) || '/';
  if (!ALLOWED_PATH.test(path)) {
    return new NextResponse('Bad Request', { status: 400 });
  }

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
