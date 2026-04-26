import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Eye } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPopularArticles, formatDate } from '../../data/blog';

export const TrendingSection: React.FC = () => {
  const trendingArticles = getPopularArticles(5);

  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#FF4D00]/10 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-[#FF4D00]" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Най-четени</h2>
            <p className="text-gray-500 text-sm">Топ статии този месец</p>
          </div>
        </div>

        {/* Articles List */}
        <div className="space-y-6">
          {trendingArticles.map((article, index) => (
            <motion.article
              key={article.id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group"
            >
              <Link 
                to={`/blog/${article.slug}`}
                className="flex items-start gap-4"
              >
                {/* Rank Number */}
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center font-bold text-xl text-gray-900 group-hover:bg-[#FF4D00] group-hover:text-white transition-colors">
                  {index + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 group-hover:text-[#FF4D00] transition-colors line-clamp-2 mb-1">
                    {article.title}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500">
                    <span>{formatDate(article.publishedAt)}</span>
                    <span className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {article.viewCount.toLocaleString()} прочитания
                    </span>
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};
