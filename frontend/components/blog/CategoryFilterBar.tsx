import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getAllCategories } from '../../data/blog';

interface CategoryFilterBarProps {
  activeCategory?: string;
}

export const CategoryFilterBar: React.FC<CategoryFilterBarProps> = ({
  activeCategory,
}) => {
  const categories = getAllCategories();
  const location = useLocation();

  const currentCategory =
    activeCategory ||
    (location.pathname.startsWith('/blog/kategoria/')
      ? location.pathname.split('/').pop()
      : 'all');

  const chipBase =
    'flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap';
  const chipInactive =
    'bg-gray-50 text-gray-700 hover:bg-white border border-gray-200';
  const chipActiveAll = 'bg-[#FF4D00] text-white border border-transparent shadow-sm';

  return (
    <div className="sticky top-[var(--navbar-height,72px)] z-[190] w-full">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm px-3 sm:px-5 py-3">
          {/* Mobile: horizontal scroll */}
          <div className="flex lg:hidden gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
            <Link
              to="/blog"
              className={`${chipBase} ${
                currentCategory === 'all' || location.pathname === '/blog'
                  ? chipActiveAll
                  : chipInactive
              }`}
            >
              Всички
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.slug}
                to={`/blog/kategoria/${cat.slug}`}
                className={`${chipBase} ${
                  currentCategory === cat.slug ? 'text-white border-transparent shadow-sm' : chipInactive
                }`}
                style={{
                  backgroundColor: currentCategory === cat.slug ? cat.color : undefined,
                }}
              >
                {cat.name}
              </Link>
            ))}
          </div>

          {/* Desktop */}
          <div className="hidden lg:flex flex-wrap items-center gap-2.5">
            <span className="text-sm font-medium text-gray-500 mr-1 shrink-0">Категории:</span>

            <Link
              to="/blog"
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                currentCategory === 'all' || location.pathname === '/blog'
                  ? 'bg-[#FF4D00] text-white shadow-sm'
                  : chipInactive
              }`}
            >
              Всички
            </Link>

            {categories.map((cat) => (
              <Link
                key={cat.slug}
                to={`/blog/kategoria/${cat.slug}`}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  currentCategory === cat.slug
                    ? 'text-white shadow-sm border-transparent'
                    : chipInactive
                }`}
                style={{
                  backgroundColor: currentCategory === cat.slug ? cat.color : undefined,
                }}
              >
                {cat.name}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
