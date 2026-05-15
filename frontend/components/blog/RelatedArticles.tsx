import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Article } from '../../data/blog';
import { formatDate, getCategoryBySlug } from '../../data/blog';
import { ArrowRight, Clock, Eye, ImageIcon } from 'lucide-react';

interface RelatedArticlesProps {
  currentArticle: Article;
  articles: Article[];
  maxCount?: number;
}

function RelatedThumb({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  if (error) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#00B4D8]/15 to-[#FF4D00]/15 flex items-center justify-center">
        <ImageIcon className="w-6 h-6 text-gray-400" aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
      loading="lazy"
      onError={() => setError(true)}
    />
  );
}

export const RelatedArticles: React.FC<RelatedArticlesProps> = ({
  currentArticle,
  articles,
  maxCount = 3,
}) => {
  const related = articles
    .filter((article) => article.id !== currentArticle.id)
    .map((article) => {
      let score = 0;
      if (article.category === currentArticle.category) score += 10;
      const sharedTags = article.tags.filter((tag) => currentArticle.tags.includes(tag));
      score += sharedTags.length * 3;
      if (article.featured) score += 2;
      return { article, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map((item) => item.article);

  if (related.length === 0) return null;

  return (
    <section className="bg-white rounded-2xl p-6 shadow-lg">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h3 className="text-lg font-bold text-gray-900">Свързани статии</h3>
        <Link
          to="/blog"
          className="text-[#FF4D00] text-sm font-medium hover:underline flex items-center gap-1 shrink-0"
        >
          Всички
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <ul className="space-y-4">
        {related.map((article) => {
          const category = getCategoryBySlug(article.category);
          return (
            <li key={article.id}>
              <Link
                to={`/blog/${article.slug}`}
                className="group flex gap-3 rounded-xl border border-gray-100 p-2 hover:border-[#00B4D8]/30 hover:bg-[#FAFAFA] transition-colors"
              >
                <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden shrink-0 bg-gray-100">
                  <RelatedThumb src={article.featuredImage} alt={article.title} />
                  {category && (
                    <span
                      className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold text-white leading-tight max-w-[90%] truncate"
                      style={{ backgroundColor: category.color }}
                    >
                      {category.name}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <h4 className="font-semibold text-gray-900 text-sm leading-snug group-hover:text-[#FF4D00] transition-colors line-clamp-2 mb-1.5">
                    {article.title}
                  </h4>
                  <p className="text-xs text-gray-500 line-clamp-2 mb-2 leading-relaxed">
                    {article.excerpt}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 shrink-0" />
                      {article.readingTime} мин
                    </span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3 shrink-0" />
                      {article.viewCount.toLocaleString('bg-BG')}
                    </span>
                    <span className="hidden sm:inline">{formatDate(article.publishedAt)}</span>
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
};
