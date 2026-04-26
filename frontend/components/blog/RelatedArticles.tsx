import React from 'react';
import { Link } from 'react-router-dom';
import type { Article } from '../../data/blog';
import { formatDate } from '../../data/blog';
import { ArrowRight, Clock, Eye } from 'lucide-react';

interface RelatedArticlesProps {
  currentArticle: Article;
  articles: Article[];
  maxCount?: number;
}

export const RelatedArticles: React.FC<RelatedArticlesProps> = ({ 
  currentArticle, 
  articles,
  maxCount = 3
}) => {
  // Find related articles based on:
  // 1. Same category (highest priority)
  // 2. Shared tags
  // 3. Exclude current article
  const related = articles
    .filter(article => article.id !== currentArticle.id)
    .map(article => {
      let score = 0;
      
      // Same category = +10 points
      if (article.category === currentArticle.category) {
        score += 10;
      }
      
      // Shared tags = +3 points each
      const sharedTags = article.tags.filter(tag => 
        currentArticle.tags.includes(tag)
      );
      score += sharedTags.length * 3;
      
      // Featured articles get slight boost
      if (article.featured) {
        score += 2;
      }
      
      return { article, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map(item => item.article);

  if (related.length === 0) return null;

  return (
    <section className="mt-12 pt-8 border-t border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold text-gray-900">
          Свързани статии
        </h3>
        <Link 
          to="/blog"
          className="text-[#FF4D00] text-sm font-medium hover:underline flex items-center gap-1"
        >
          Всички статии
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {related.map(article => (
          <article 
            key={article.id}
            className="group bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-100"
          >
            <Link to={`/blog/${article.slug}`} className="block">
              {/* Image */}
              <div className="aspect-video relative overflow-hidden">
                <img
                  src={article.featuredImage}
                  alt={article.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute top-3 left-3">
                  <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium text-gray-700">
                    {article.category === 'saveti-pri-izbor' && 'Съвети'}
                    {article.category === 'remont' && 'Ремонт'}
                    {article.category === 'montaj' && 'Монтаж'}
                    {article.category === 'energiya' && 'Енергия'}
                    {article.category === 'profilaktika' && 'Поддръжка'}
                    {article.category === 'sravneniya' && 'Сравнения'}
                    {article.category === 'novini' && 'Новини'}
                    {article.category === 'regionalni' && 'Регионални'}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h4 className="font-semibold text-gray-900 group-hover:text-[#FF4D00] transition-colors line-clamp-2 mb-2">
                  {article.title}
                </h4>
                
                <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                  {article.excerpt}
                </p>

                {/* Meta */}
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {article.readingTime} мин
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" />
                    {article.viewCount.toLocaleString()}
                  </span>
                  <span>{formatDate(article.publishedAt)}</span>
                </div>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
};
