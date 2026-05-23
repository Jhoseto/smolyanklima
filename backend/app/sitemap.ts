import type { MetadataRoute } from 'next';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { applyPublicCatalogFilter } from '@/lib/catalog/publicProductVisibility';

const SITE = process.env.NEXT_PUBLIC_SITE_ORIGIN?.replace(/\/$/, '') || 'https://smolyanklima.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/catalog`, lastModified: now, changeFrequency: 'daily', priority: 0.95 },
    { url: `${SITE}/services`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${SITE}/contact`, lastModified: now, changeFrequency: 'monthly', priority: 0.85 },
    { url: `${SITE}/za-nas`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE}/blog`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE}/klimatik-smolyan`, lastModified: now, changeFrequency: 'monthly', priority: 0.92 },
    { url: `${SITE}/klimatik-rudozem`, lastModified: now, changeFrequency: 'monthly', priority: 0.88 },
    { url: `${SITE}/klimatik-madan`, lastModified: now, changeFrequency: 'monthly', priority: 0.88 },
    { url: `${SITE}/klimatik-devin`, lastModified: now, changeFrequency: 'monthly', priority: 0.88 },
    { url: `${SITE}/klimatik-chepelare`, lastModified: now, changeFrequency: 'monthly', priority: 0.88 },
    { url: `${SITE}/montaj-klimatik-smolyan`, lastModified: now, changeFrequency: 'monthly', priority: 0.93 },
    { url: `${SITE}/politika-za-poveritelnost`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE}/biskvitki`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE}/obshti-usloviya`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
  ];

  let productUrls: MetadataRoute.Sitemap = [];
  let articleUrls: MetadataRoute.Sitemap = [];

  try {
    const supabase = createSupabaseServiceRoleClient();
    const { data: products } = await applyPublicCatalogFilter(
      supabase.from('products').select('slug, updated_at').order('updated_at', { ascending: false }),
    ).limit(2000);

    productUrls = (products ?? []).map((p) => ({
      url: `${SITE}/product/${(p as { slug: string }).slug}`,
      lastModified: (p as { updated_at?: string }).updated_at
        ? new Date((p as { updated_at: string }).updated_at)
        : now,
      changeFrequency: 'weekly' as const,
      priority: 0.75,
    }));

    const { data: articles } = await supabase
      .from('articles')
      .select('slug, modified_at, published_at')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(500);

    articleUrls = (articles ?? []).map((a) => ({
      url: `${SITE}/blog/${(a as { slug: string }).slug}`,
      lastModified: new Date(
        (a as { modified_at?: string; published_at?: string }).modified_at ||
          (a as { published_at?: string }).published_at ||
          now.toISOString(),
      ),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    }));
  } catch {
    // Build-time placeholder env — return static pages only
  }

  return [...staticPages, ...productUrls, ...articleUrls];
}
