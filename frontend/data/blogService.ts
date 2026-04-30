import type { Article, ArticleSEO, ArticleSchema } from './blog/types';

type ApiArticle = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content?: string;
  category_slug: string;
  tags: string[];
  author_slug: string;
  featured_image: string;
  images?: string[] | null;
  seo?: ArticleSEO | null;
  schema?: ArticleSchema | null;
  published_at: string;
  modified_at: string;
  reading_time: number;
  view_count: number;
  is_featured?: boolean | null;
};

function mapApiArticle(raw: ApiArticle): Article {
  return {
    id: raw.id,
    slug: raw.slug,
    title: raw.title,
    excerpt: raw.excerpt,
    content: raw.content ?? '',
    category: raw.category_slug,
    tags: raw.tags ?? [],
    author: raw.author_slug,
    featuredImage: raw.featured_image,
    images: raw.images ?? undefined,
    seo: raw.seo ?? {
      title: raw.title,
      description: raw.excerpt,
      keywords: raw.tags ?? [],
      ogImage: raw.featured_image,
    },
    schema: raw.schema ?? {
      headline: raw.title,
      description: raw.excerpt,
      image: [raw.featured_image].filter(Boolean),
      datePublished: raw.published_at,
      dateModified: raw.modified_at,
      author: { name: raw.author_slug, url: '/blog' },
    },
    publishedAt: raw.published_at,
    modifiedAt: raw.modified_at,
    readingTime: raw.reading_time ?? 5,
    viewCount: raw.view_count ?? 0,
    featured: Boolean(raw.is_featured),
  };
}

export async function fetchArticles(opts: {
  page?: number;
  perPage?: number;
  q?: string;
  category?: string;
}): Promise<{ data: Article[]; meta: { page: number; perPage: number; total: number } }> {
  const page = opts.page ?? 1;
  const perPage = opts.perPage ?? 12;
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('perPage', String(perPage));
  if (opts.q?.trim()) params.set('q', opts.q.trim());
  if (opts.category?.trim()) params.set('category', opts.category.trim());

  const res = await fetch(`/api/articles?${params.toString()}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Грешка при зареждане на статии');
  const batch = (json.data ?? []) as ApiArticle[];
  return { data: batch.map(mapApiArticle), meta: json.meta };
}

export async function fetchArticleBySlug(slug: string): Promise<Article | undefined> {
  const res = await fetch(`/api/articles/${encodeURIComponent(slug)}`);
  const json = await res.json();
  if (!res.ok) return undefined;
  if (!json.data) return undefined;
  return mapApiArticle(json.data as ApiArticle);
}

