/**
 * Blog Types
 * Shared interfaces for blog system
 */

export interface ArticleSEO {
  title: string;
  description: string;
  keywords: string[];
  ogImage: string;
}

export interface ArticleSchema {
  headline: string;
  description: string;
  image: string[];
  datePublished: string;
  dateModified: string;
  author: {
    name: string;
    url: string;
  };
}

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  author: string;
  featuredImage: string;
  images?: string[];
  seo: ArticleSEO;
  schema: ArticleSchema;
  publishedAt: string;
  modifiedAt: string;
  readingTime: number;
  viewCount: number;
  featured?: boolean;
}
