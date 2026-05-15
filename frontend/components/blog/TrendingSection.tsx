import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPopularArticles, formatDate } from '../../data/blog';

interface TrendingSectionProps {
  /** Компактен изглед за странична лента на блога */
  variant?: 'page' | 'sidebar';
}

export const TrendingSection: React.FC<TrendingSectionProps> = ({ variant = 'page' }) => {
  const trendingArticles = getPopularArticles(5);
  const isSidebar = variant === 'sidebar';

  const list = (
    <div className={isSidebar ? 'space-y-4' : 'space-y-6'}>
      {trendingArticles.map((article, index) => (
        <motion.article
          key={article.id}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: index * 0.08 }}
          className="group"
        >
          <Link to={`/blog/${article.slug}`} className="flex items-start gap-3">
            <div
              className={`flex-shrink-0 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-gray-900 group-hover:bg-[#FF4D00] group-hover:text-white transition-colors ${
                isSidebar ? 'w-8 h-8 text-sm' : 'w-12 h-12 text-xl'
              }`}
            >
              {index + 1}
            </div>
            <div className="flex-1 min-w-0">
              <h3
                className={`font-semibold text-gray-900 group-hover:text-[#FF4D00] transition-colors line-clamp-2 mb-1 ${
                  isSidebar ? 'text-sm' : ''
                }`}
              >
                {article.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                <span>{formatDate(article.publishedAt)}</span>
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  {article.viewCount.toLocaleString('bg-BG')}
                </span>
              </div>
            </div>
          </Link>
        </motion.article>
      ))}
    </div>
  );

  if (isSidebar) {
    return (
      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-lg bg-[#FF4D00]/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#FF4D00]" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Най-четени</h3>
        </div>
        {list}
      </div>
    );
  }

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#FF4D00]/10 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-[#FF4D00]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Най-четени</h2>
            <p className="text-gray-500 text-sm">Топ статии този месец</p>
          </div>
        </div>
        {list}
      </div>
    </section>
  );
};
