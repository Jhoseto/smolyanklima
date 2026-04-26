import React from 'react';
import { motion } from 'motion/react';
import { Search, BookOpen, TrendingUp, Users } from 'lucide-react';

interface BlogHeroSectionProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
}

export const BlogHeroSection: React.FC<BlogHeroSectionProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit
}) => {
  const stats = [
    { icon: BookOpen, label: 'Статии', value: '50+' },
    { icon: Users, label: 'Експерти', value: '3' },
    { icon: TrendingUp, label: 'Читатели', value: '1000+' }
  ];

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background Gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#00B4D8]/5 via-transparent to-[#FF4D00]/5 pointer-events-none" />
      
      {/* Decorative Blobs */}
      <div className="absolute top-20 left-0 w-[600px] h-[600px] bg-[#00B4D8]/10 rounded-full blur-[120px] -translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#FF4D00]/10 rounded-full blur-[100px] translate-x-1/3 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Breadcrumb */}
        <nav className="mb-8">
          <ol className="flex items-center gap-2 text-sm text-gray-500">
            <li>
              <a href="/" className="hover:text-[#FF4D00] transition-colors">Начало</a>
            </li>
            <li>/</li>
            <li className="text-gray-900 font-medium">Блог</li>
          </ol>
        </nav>

        {/* Main Content */}
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00B4D8]/10 text-[#00B4D8] text-sm font-semibold mb-6">
              <BookOpen className="w-4 h-4" />
              Нашият Блог
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight"
          >
            Експертни съвети за{' '}
            <span className="text-[#FF4D00]">климатици</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-gray-600 mb-10 leading-relaxed"
          >
            Научете всичко за избора, монтажа и поддръжката на климатици. 
            Практически съвети от сертифицирани експерти с над 15 години опит.
          </motion.p>

          {/* Search Bar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative max-w-2xl"
          >
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Търсете теми, марки, съвети..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                className="w-full pl-14 pr-6 py-4 rounded-full bg-white border border-gray-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-[#00B4D8] focus:border-transparent text-gray-900 placeholder-gray-400"
              />
              <button
                onClick={onSearchSubmit}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-[#FF4D00] text-white rounded-full font-medium hover:bg-[#FF4D00]/90 transition-colors"
              >
                Търси
              </button>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-wrap gap-8 mt-10"
          >
            {stats.map((stat, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#00B4D8]/10 flex items-center justify-center">
                  <stat.icon className="w-6 h-6 text-[#00B4D8]" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                  <div className="text-sm text-gray-500">{stat.label}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};
