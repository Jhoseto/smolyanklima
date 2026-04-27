import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Clock, Eye, ChevronRight, ImageIcon } from 'lucide-react';
import type { Article } from '../../data/blog';
import { getAuthorBySlug, getCategoryBySlug, formatDate } from '../../data/blog';

// Placeholder Image Component
const ArticleImage: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) => {
  const [error, setError] = useState(false);
  
  if (error) {
    return (
      <div className={`${className} bg-gradient-to-br from-[#00B4D8]/20 to-[#FF4D00]/20 flex items-center justify-center`}>
        <div className="text-center">
          <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <span className="text-gray-500 text-sm">{alt.substring(0, 30)}...</span>
        </div>
      </div>
    );
  }
  
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      loading="lazy"
    />
  );
};

interface ArticleCardProps {
  article: Article;
  variant?: 'standard' | 'hero' | 'compact';
  index?: number;
}

export const ArticleCard: React.FC<ArticleCardProps> = ({ 
  article, 
  variant = 'standard',
  index = 0 
}) => {
  const author = getAuthorBySlug(article.author);
  const category = getCategoryBySlug(article.category);

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: i * 0.1,
        duration: 0.5
      }
    })
  };

  if (variant === 'hero') {
    return (
      <motion.article
        custom={index}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={cardVariants}
        className="group relative"
      >
        <Link to={`/blog/${article.slug}`} className="block">
          <div className="relative aspect-[16/9] rounded-2xl overflow-hidden mb-6">
            <ArticleImage
              src={article.featuredImage}
              alt={`${article.title} - Featured Image`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
            
            {/* Category Badge */}
            {category && (
              <span 
                className="absolute top-4 left-4 px-4 py-1.5 rounded-full text-sm font-semibold text-white"
                style={{ backgroundColor: category.color }}
              >
                {category.name}
              </span>
            )}

            {/* Featured Badge */}
            {article.featured && (
              <span className="absolute top-4 right-4 px-3 py-1 bg-[#FF4D00] text-white text-xs font-bold rounded-full">
                FEATURED
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* Meta */}
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>{formatDate(article.publishedAt)}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {article.readingTime} мин четене
              </span>
            </div>

            {/* Title */}
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 group-hover:text-[#FF4D00] transition-colors leading-tight">
              {article.title}
            </h2>

            {/* Excerpt */}
            <p className="text-lg text-gray-600 line-clamp-2 leading-relaxed">
              {article.excerpt}
            </p>

            {/* CTA */}
            <div className="flex items-center gap-2 text-[#FF4D00] font-semibold group-hover:gap-3 transition-all">
              Прочети още
              <ChevronRight className="w-5 h-5" />
            </div>
          </div>
        </Link>
      </motion.article>
    );
  }

  if (variant === 'compact') {
    return (
      <motion.article
        custom={index}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={cardVariants}
        className="group"
      >
        <Link to={`/blog/${article.slug}`} className="flex gap-4">
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden flex-shrink-0">
            <ArticleImage
              src={article.featuredImage}
              alt={`${article.title} - Thumbnail`}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 group-hover:text-[#FF4D00] transition-colors line-clamp-2 mb-2">
              {article.title}
            </h3>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{formatDate(article.publishedAt)}</span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {article.viewCount.toLocaleString()}
              </span>
            </div>
          </div>
        </Link>
      </motion.article>
    );
  }

  // Standard variant
  return (
    <motion.article
      custom={index}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      variants={cardVariants}
      className="group bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
    >
      <Link to={`/blog/${article.slug}`} className="block">
        {/* Image */}
        <div className="relative aspect-[4/3] overflow-hidden">
          <img
            src={article.featuredImage}
            alt={`${article.title} - Blog Post Image`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          
          {/* Category Badge */}
          {category && (
            <span 
              className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: category.color }}
            >
              {category.name}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Meta */}
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
            <span>{formatDate(article.publishedAt)}</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {article.readingTime} мин
            </span>
          </div>

          {/* Title */}
          <h3 className="text-xl font-bold text-gray-900 mb-3 group-hover:text-[#FF4D00] transition-colors line-clamp-2">
            {article.title}
          </h3>

          {/* Excerpt */}
          <p className="text-gray-600 text-sm line-clamp-2 mb-4 leading-relaxed">
            {article.excerpt}
          </p>

          {/* Author */}
          {author && (
            <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00B4D8] to-[#FF4D00] flex items-center justify-center text-white font-bold text-sm">
                {author.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <div className="font-medium text-gray-900 text-sm">{author.name}</div>
                <div className="text-xs text-gray-500">{author.role}</div>
              </div>
            </div>
          )}
        </div>
      </Link>
    </motion.article>
  );
};
