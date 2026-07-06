import React, { useRef } from 'react';
import { motion } from 'motion/react';
import { LayoutGrid, Layers, Home, Building2, ArrowDown, ArrowUpFromLine, Columns } from 'lucide-react';
import { CATEGORIES } from '../../data/productService';

const ICON_MAP: Record<string, React.ReactNode> = {
  LayoutGrid: <LayoutGrid className="w-4 h-4" />,
  Home: <Home className="w-4 h-4" />,
  Layers: <Layers className="w-4 h-4" />,
  Building2: <Building2 className="w-4 h-4" />,
  ArrowDown: <ArrowDown className="w-4 h-4" />,
  Columns: <Columns className="w-4 h-4" />,
  ArrowUpFromLine: <ArrowUpFromLine className="w-4 h-4" />,
};

interface CategoryChipsProps {
  selected: string;
  onChange: (id: string) => void;
  counts: Record<string, number>;
  /** Компактен ред в search bar */
  compact?: boolean;
}

export const CategoryChips = ({ selected, onChange, counts, compact = false }: CategoryChipsProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div className="relative min-w-0 flex-1">
      <div className={`absolute right-0 top-0 bottom-0 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none ${compact ? 'w-4' : 'w-6'}`} />

      <div
        ref={scrollRef}
        className={`flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto scrollbar-hide ${
          compact ? 'gap-1.5 pb-0.5' : 'px-2 pb-1'
        }`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selected === cat.id;
          const count = counts[cat.id] ?? 0;
          const isAll = cat.id === 'all';

          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onChange(cat.id)}
              className={`
                relative flex items-center justify-center border transition-all duration-200
                ${compact
                  ? isAll
                    ? 'shrink-0 gap-0.5 px-1.5 sm:px-2 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap [&_svg]:w-3.5 [&_svg]:h-3.5'
                    : 'shrink-0 gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold whitespace-nowrap [&_svg]:w-3.5 [&_svg]:h-3.5 [&_svg]:shrink-0'
                  : 'shrink-0 gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap [&_svg]:w-4 [&_svg]:h-4'
                }
                ${isActive
                  ? 'text-white border-transparent shadow-sm'
                  : 'text-gray-600 bg-gray-50 border-gray-200 hover:border-gray-300 hover:bg-white'
                }
              `}
              style={isActive ? {
                background: 'linear-gradient(135deg, #FF4D00, #FF2A4D)',
                boxShadow: compact ? undefined : '0 4px 15px rgba(255, 77, 0, 0.3)',
              } : {}}
            >
              <span className={`shrink-0 ${isActive ? 'text-white' : ''}`} style={!isActive ? { color: cat.accentColor } : {}}>
                {ICON_MAP[cat.icon]}
              </span>
              <span>{cat.label}</span>
              {count > 0 && (
                <span className={`font-bold rounded-full shrink-0 ${
                  compact ? 'text-[10px] px-1' : 'text-[10px] px-1.5 py-0.5'
                } ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {count}
                </span>
              )}
              {isActive && !compact && (
                <motion.div
                  layoutId="category-indicator"
                  className="absolute -bottom-1 left-4 right-4 h-0.5 bg-white/60 rounded-full"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
