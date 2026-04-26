import React, { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LayoutGrid, Layers, Home, Building2, ArrowDown, Briefcase } from 'lucide-react';
import { CATEGORIES } from '../../data/productService';
import type { CategoryMeta } from '../../data/types/product';

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutGrid: <LayoutGrid className="w-4 h-4" />,
  Home: <Home className="w-4 h-4" />,
  Layers: <Layers className="w-4 h-4" />,
  Building2: <Building2 className="w-4 h-4" />,
  ArrowDown: <ArrowDown className="w-4 h-4" />,
  Briefcase: <Briefcase className="w-4 h-4" />,
};

interface CategoryChipsProps {
  selected: string;
  onChange: (id: string) => void;
  counts: Record<string, number>;
}

export const CategoryChips = ({ selected, onChange, counts }: CategoryChipsProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative">
      {/* Fade edges for horizontal scroll hint */}
      <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-2 pb-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selected === cat.id;
          const count = counts[cat.id] ?? 0;

          return (
            <motion.button
              key={cat.id}
              onClick={() => onChange(cat.id)}
              whileTap={{ scale: 0.95 }}
              className={`
                relative flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold
                whitespace-nowrap transition-all duration-200 shrink-0 border
                ${isActive
                  ? 'text-white border-transparent shadow-md'
                  : 'text-gray-600 bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }
              `}
              style={isActive ? {
                background: `linear-gradient(135deg, #FF4D00, #FF2A4D)`,
                boxShadow: `0 4px 15px rgba(255, 77, 0, 0.3)`,
              } : {}}
            >
              <span className={isActive ? 'text-white' : ''} style={!isActive ? { color: cat.accentColor } : {}}>
                {ICON_MAP[cat.icon]}
              </span>
              {cat.label}
              {count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                  isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
              {/* Active underline indicator */}
              {isActive && (
                <motion.div
                  layoutId="category-indicator"
                  className="absolute -bottom-1 left-4 right-4 h-0.5 bg-white/60 rounded-full"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};
