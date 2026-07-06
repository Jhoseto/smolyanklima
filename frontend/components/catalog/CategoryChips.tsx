import React from 'react';
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
  /** Един ред в search bar — равномерно разпределение, multi по-широк */
  compact?: boolean;
}

function chipFlexClass(id: string, compact: boolean): string {
  if (!compact) return 'shrink-0';
  if (id === 'multi') return 'flex-[1.65] min-w-[9.25rem]';
  return 'flex-1 min-w-0 basis-0';
}

export const CategoryChips = ({ selected, onChange, counts, compact = false }: CategoryChipsProps) => {
  return (
    <div className="w-full min-w-0">
      <div
        className={
          compact
            ? 'flex w-full min-w-0 flex-wrap items-stretch gap-1.5 lg:flex-nowrap lg:gap-2'
            : 'flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto scrollbar-hide px-2 pb-1'
        }
        style={compact ? undefined : { scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selected === cat.id;
          const count = counts[cat.id] ?? 0;
          const chipLabel = compact
            ? (cat.id === 'multi' ? cat.label : (cat.shortLabel ?? cat.label))
            : cat.label;

          return (
            <button
              key={cat.id}
              type="button"
              title={compact && cat.shortLabel && cat.id !== 'multi' ? cat.label : undefined}
              onClick={() => onChange(cat.id)}
              className={`
                group relative inline-flex items-center justify-center border transition-all duration-200
                ${chipFlexClass(cat.id, compact)}
                ${compact
                  ? 'gap-1.5 px-2.5 py-2 rounded-xl text-xs sm:text-[13px] font-medium tracking-tight whitespace-nowrap [&_svg]:w-3.5 [&_svg]:h-3.5 [&_svg]:shrink-0'
                  : 'gap-2 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap [&_svg]:w-4 [&_svg]:h-4'
                }
                ${isActive
                  ? 'text-white border-transparent shadow-md shadow-orange-500/20'
                  : 'text-slate-700 bg-slate-50/90 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-sm'
                }
              `}
              style={isActive ? {
                background: 'linear-gradient(135deg, #FF4D00 0%, #FF5533 45%, #FF2A4D 100%)',
                boxShadow: compact ? undefined : '0 4px 15px rgba(255, 77, 0, 0.28)',
              } : {}}
            >
              <span
                className={`shrink-0 transition-colors ${isActive ? 'text-white' : 'opacity-90 group-hover:opacity-100'}`}
                style={!isActive ? { color: cat.accentColor } : {}}
              >
                {ICON_MAP[cat.icon]}
              </span>
              <span>{chipLabel}</span>
              {count > 0 && (
                <span
                  className={`tabular-nums leading-none shrink-0 ${
                    compact
                      ? `text-[11px] font-semibold ${isActive ? 'text-white/90' : 'text-slate-400'}`
                      : `text-[10px] font-bold rounded-full px-1.5 py-0.5 ${isActive ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`
                  }`}
                >
                  {count}
                </span>
              )}
              {isActive && !compact && (
                <span
                  aria-hidden
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
