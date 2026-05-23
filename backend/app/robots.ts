import type { MetadataRoute } from 'next';

const SITE = process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, '') || 'https://smolyanklima.com';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/login'],
      },
      {
        userAgent: 'GPTBot',
        allow: ['/', '/blog/', '/catalog', '/product/', '/llms.txt'],
        disallow: ['/admin/', '/api/'],
      },
      {
        userAgent: 'ChatGPT-User',
        allow: ['/', '/blog/', '/catalog', '/product/', '/llms.txt'],
        disallow: ['/admin/', '/api/'],
      },
      {
        userAgent: 'Google-Extended',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
      {
        userAgent: 'ClaudeBot',
        allow: ['/', '/blog/', '/catalog', '/product/', '/llms.txt'],
        disallow: ['/admin/', '/api/'],
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/', '/blog/', '/catalog', '/product/', '/llms.txt'],
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE.replace(/^https:\/\//, ''),
  };
}
