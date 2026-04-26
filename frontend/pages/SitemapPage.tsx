/**
 * Dynamic Sitemap.xml Generator
 * Serves sitemap.xml for search engines
 */

import { articles } from '../data/blog';
import { categories } from '../data/blog/categories';

export default function SitemapPage() {
  // Static pages
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'weekly' },
    { url: '/blog', priority: '0.9', changefreq: 'daily' },
    { url: '/catalog', priority: '0.8', changefreq: 'weekly' },
    { url: '/services', priority: '0.8', changefreq: 'monthly' },
    { url: '/contact', priority: '0.7', changefreq: 'monthly' },
  ];

  // Generate sitemap XML
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static Pages -->
  ${staticPages.map(page => `
  <url>
    <loc>https://smolyanklima.bg${page.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
  `).join('')}
  
  <!-- Blog Categories -->
  ${categories.map(category => `
  <url>
    <loc>https://smolyanklima.bg/blog/kategoria/${category.slug}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  `).join('')}
  
  <!-- Blog Articles -->
  ${articles.map(article => `
  <url>
    <loc>https://smolyanklima.bg/blog/${article.slug}</loc>
    <lastmod>${article.modifiedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  `).join('')}
</urlset>`;

  // Return as XML response
  return (
    <pre className="hidden">
      {sitemap}
    </pre>
  );
}

// Export the sitemap generation function for use in other components
export function generateSitemapXML(): string {
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'weekly' },
    { url: '/blog', priority: '0.9', changefreq: 'daily' },
    { url: '/catalog', priority: '0.8', changefreq: 'weekly' },
    { url: '/services', priority: '0.8', changefreq: 'monthly' },
    { url: '/contact', priority: '0.7', changefreq: 'monthly' },
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticPages.map(page => `  <url>
    <loc>https://smolyanklima.bg${page.url}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')}
${categories.map(category => `  <url>
    <loc>https://smolyanklima.bg/blog/kategoria/${category.slug}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')}
${articles.map(article => `  <url>
    <loc>https://smolyanklima.bg/blog/${article.slug}</loc>
    <lastmod>${article.modifiedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`;
}
