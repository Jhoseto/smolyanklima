import React from 'react';
import { motion } from 'motion/react';
import { Search, BookOpen, TrendingUp, Users } from 'lucide-react';

interface BlogHeroSectionProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  h1?: string;
  lead?: string;
  articleCount?: number;
  authorCount?: number;
}

export const BlogHeroSection: React.FC<BlogHeroSectionProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  h1 = 'Блог за климатици Смолян и региона',
  lead = 'Експертни съвети за избор, монтаж и поддръжка на климатици в Смолян, Рудозем, Девин и Родопите. Практически ръководства от сертифицирани специалисти.',
  articleCount,
  authorCount = 3,
}) => {
  const stats = [
    ...(articleCount != null ? [{ icon: BookOpen, label: 'Статии', value: String(articleCount) }] : []),
    { icon: Users, label: 'Автори', value: String(authorCount) },
    { icon: TrendingUp, label: 'Категории', value: '8' },
  ];

  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1498049860654-af1a5c566876?q=80&w=2340&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Блог за климатици Смолян — експертни съвети"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-white/90 via-white/85 to-white/90" />
      </div>

      <div className="absolute top-20 left-0 w-[600px] h-[600px] bg-[#00B4D8]/10 rounded-full blur-[120px] -translate-x-1/2 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-[#FF4D00]/10 rounded-full blur-[100px] translate-x-1/3 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <nav className="mb-8" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm text-gray-500">
            <li>
              <a href="/" className="hover:text-[#FF4D00] transition-colors">Начало</a>
            </li>
            <li>/</li>
            <li className="text-gray-900 font-medium">Блог</li>
          </ol>
        </nav>

        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#00B4D8]/10 text-[#00B4D8] text-sm font-semibold mb-6">
              <BookOpen className="w-4 h-4" />
              Блог за климатици
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6 leading-tight"
          >
            {h1}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-gray-600 mb-10 leading-relaxed"
          >
            {lead}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="relative max-w-2xl"
          >
            <div className="relative">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="search"
                placeholder="Търсете теми, марки, съвети..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSearchSubmit()}
                className="w-full pl-14 pr-6 py-4 rounded-full bg-white border border-gray-200 shadow-lg focus:outline-none focus:ring-2 focus:ring-[#00B4D8] focus:border-transparent text-gray-900 placeholder-gray-400"
                aria-label="Търсене в блога"
              />
              <button
                type="button"
                onClick={onSearchSubmit}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2 bg-[#FF4D00] text-white rounded-full font-medium hover:bg-[#FF4D00]/90 transition-colors"
              >
                Търси
              </button>
            </div>
          </motion.div>

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
