import React from 'react';
import { Search, SlidersHorizontal, LayoutGrid, LayoutList, X, ChevronDown } from 'lucide-react';
import type { SortOption } from '../../data/types/product';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recommended', label: 'По оценка (бр. отзиви)' },
  { value: 'price-asc',   label: 'Цена: ниска → висока' },
  { value: 'price-desc',  label: 'Цена: висока → ниска' },
  { value: 'energy-class', label: 'Енергиен клас' },
  { value: 'noise-asc',   label: 'Ниво на шум' },
  { value: 'rating-desc', label: 'Най-висок рейтинг' },
];

interface SearchSortBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  sortBy: SortOption;
  onSortChange: (v: SortOption) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (v: 'grid' | 'list') => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  /** Категории (климатици / аксесоари) — един ред до сортирането */
  categoryChipsSlot?: React.ReactNode;
  /** Активни филтри — под категориите */
  activeFiltersSlot?: React.ReactNode;
}

export const SearchSortBar = ({
  search,
  onSearchChange,
  sortBy,
  onSortChange,
  viewMode,
  onViewModeChange,
  onToggleSidebar,
  sidebarOpen,
  categoryChipsSlot,
  activeFiltersSlot,
}: SearchSortBarProps) => {
  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm transition-all">
      <div className="px-3 sm:px-6 py-3">
        {/* Row 1: Filter toggle + Search + View toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Filter Toggle (mobile/tablet) */}
          <button
            onClick={onToggleSidebar}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all lg:hidden shrink-0 ${
              sidebarOpen
                ? 'bg-[#FF4D00] text-white border-[#FF4D00]'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden xs:inline">Филтри</span>
          </button>

          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Търси климатик..."
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] transition-all"
            />
            {search && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* View Toggle */}
          <div className="hidden md:flex items-center bg-gray-100 rounded-xl p-1 shrink-0">
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white shadow-sm text-[#00B4D8]' : 'text-gray-400 hover:text-gray-600'}`}
              title="Grid изглед"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white shadow-sm text-[#00B4D8]' : 'text-gray-400 hover:text-gray-600'}`}
              title="List изглед"
            >
              <LayoutList className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Row 2: Категории (flex-1) + сортиране вдясно */}
        <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-gray-100/70">
          <div className="flex-1 min-w-0">{categoryChipsSlot}</div>
          <div className="relative shrink-0 w-[11.5rem] sm:w-auto sm:min-w-[11.5rem]">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="w-full appearance-none pl-3 pr-8 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm text-gray-700 font-semibold focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] cursor-pointer transition-all"
            >
              {SORT_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {activeFiltersSlot ? (
          <div className="mt-2 pt-2 border-t border-gray-100/70">{activeFiltersSlot}</div>
        ) : null}
      </div>
    </div>
  );
};
