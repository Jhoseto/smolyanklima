/**
 * Blog Data Exports
 * Modular structure - each article in separate file
 */

// Types
export * from './types';

// Individual articles
export { article25kvm } from './posts/article-25kvm';
export { articleSmolyan } from './posts/article-smolyan';
export { articleMontaj } from './posts/article-montaj';
export { articleTecheVoda } from './posts/article-teche-voda';
export { articleTok } from './posts/article-tok';
export { articleProfilaktika } from './posts/article-profilaktika';
export { articleInvertorVsKonvencionalen } from './posts/article-invertor-vs-konvencionalen';
export { articleVtoraUpotreba } from './posts/article-vtora-upotreba';
export { articleTihiKlimatici } from './posts/article-tihi-klimatici';
export { articleNeOhlazhda } from './posts/article-ne-ohlazhda';
export { articleWifiSmart } from './posts/article-wifi-smart';
export { articleZaOtoplenie } from './posts/article-za-otoplenie';

// Categories, authors, tags
export * from './categories';
export * from './authors';
export * from './tags';

// Combine all articles into array (for backward compatibility)
import { article25kvm } from './posts/article-25kvm';
import { articleSmolyan } from './posts/article-smolyan';
import { articleMontaj } from './posts/article-montaj';
import { articleTecheVoda } from './posts/article-teche-voda';
import { articleTok } from './posts/article-tok';
import { articleProfilaktika } from './posts/article-profilaktika';
import { articleInvertorVsKonvencionalen } from './posts/article-invertor-vs-konvencionalen';
import { articleVtoraUpotreba } from './posts/article-vtora-upotreba';
import { articleTihiKlimatici } from './posts/article-tihi-klimatici';
import { articleNeOhlazhda } from './posts/article-ne-ohlazhda';
import { articleWifiSmart } from './posts/article-wifi-smart';
import { articleZaOtoplenie } from './posts/article-za-otoplenie';
import type { Article } from './types';

export const articles: Article[] = [
  article25kvm,
  articleSmolyan,
  articleMontaj,
  articleTecheVoda,
  articleTok,
  articleProfilaktika,
  articleInvertorVsKonvencionalen,
  articleVtoraUpotreba,
  articleTihiKlimatici,
  articleNeOhlazhda,
  articleWifiSmart,
  articleZaOtoplenie,
];

// Re-export helper functions from articles.ts (keeping them for compatibility)
export function getArticleBySlug(slug: string): Article | undefined {
  return articles.find(article => article.slug === slug);
}

export function getArticlesByCategory(categorySlug: string): Article[] {
  return articles.filter(article => article.category === categorySlug);
}

export function getArticlesByTag(tagSlug: string): Article[] {
  return articles.filter(article => 
    article.tags.some(tag => 
      tag.toLowerCase().replace(/\s+/g, '-') === tagSlug.toLowerCase()
    )
  );
}

export function getLatestArticles(count: number = 10): Article[] {
  return [...articles]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, count);
}

export function getPopularArticles(count: number = 5): Article[] {
  return [...articles]
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, count);
}

export function getFeaturedArticles(count: number = 3): Article[] {
  return articles
    .filter(article => article.featured)
    .slice(0, count);
}

export function searchArticles(query: string): Article[] {
  const searchTerm = query.toLowerCase();
  return articles.filter(article =>
    article.title.toLowerCase().includes(searchTerm) ||
    article.excerpt.toLowerCase().includes(searchTerm) ||
    article.tags.some(tag => tag.toLowerCase().includes(searchTerm))
  );
}

// Utility function for formatting dates (used by components)
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('bg-BG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}
