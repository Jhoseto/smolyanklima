import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextResponse } from 'next/server';

const LLMS_PATHS = [
  join(/* turbopackIgnore: true */ process.cwd(), 'public', 'llms.txt'),
  join(/* turbopackIgnore: true */ process.cwd(), '..', 'public', 'llms.txt'),
];

export async function GET() {
  for (const p of LLMS_PATHS) {
    try {
      const body = readFileSync(p, 'utf8');
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'public, max-age=86400',
        },
      });
    } catch {
      /* try next */
    }
  }
  return new NextResponse('# Smolyan Klima\nhttps://smolyanklima.com\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
