import React from 'react';
import { motion } from 'motion/react';
import { Link, useLocation } from 'react-router-dom';
import { getAllCategories } from '../../data/blog';

interface CategoryFilterBarProps {
  activeCategory?: string;
}

export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({ 
  activeCategory 
}) => {
  const categories = getAllCategories();
  const location = useLocation();
  
  // If no activeCategory prop, determine from URL
  const currentCategory = activeCategory || 
    (location.pathname.startsWith('/blog/kategoria/') 
      ? location.pathname.split('/').pop() 
      : 'all');

  return (
    <div className="sticky top-20 z-30 bg-[#FAFAFA]/95 backdrop-blur-sm py-4 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Mobile: Horizontal scroll */}
        <div className="flex lg:hidden gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          <Link
            to="/blog"
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
              currentCategory === 'all' || location.pathname === '/blog'
                ? 'bg-[#FF4D00] text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Всички
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              to={`/blog/kategoria/${cat.slug}`}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                currentCategory === cat.slug
                  ? 'text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
              style={{
                backgroundColor: currentCategory === cat.slug ? cat.color : undefined
              }}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {/* Desktop: Flex wrap */}
        <div className="hidden lg:flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-gray-500 mr-2">Категории:</span>
          
          <Link
            to="/blog"
            className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
              currentCategory === 'all' || location.pathname === '/blog'
                ? 'bg-[#FF4D00] text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
            }`}
          >
            Всички
          </Link>
          
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              to={`/blog/kategoria/${cat.slug}`}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                currentCategory === cat.slug
                  ? 'text-white shadow-md'
                  : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
              }`}
              style={{
                backgroundColor: currentCategory === cat.slug ? cat.color : undefined
              }}
            >
              {cat.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};
