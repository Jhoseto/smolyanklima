import { NextResponse } from 'next/server';

/** Bing Webmaster Tools — XML file verification (https://www.bing.com/webmasters) */
const BING_SITE_AUTH_XML = `<?xml version="1.0"?>
<users>
  <user>6FEC69AC0B3F6DF5EEBEEB3D1C5796C3</user>
</users>`;

export async function GET() {
  return new NextResponse(BING_SITE_AUTH_XML, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
