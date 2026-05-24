import React from 'react';
import { Search, SlidersHorizontal, LayoutGrid, LayoutList, X, ChevronDown } from 'lucide-react';
import type { SortOption } from '../../data/types/product';
import { ACCESSORY_SORT_OPTIONS, CATALOG_SORT_OPTIONS } from '../../data/types/product';

const SORT_LABELS: Record<SortOption, string> = {
  'seer-desc': 'По SEER (икономичност)',
  'recommended': 'Препоръчани (отзиви и избрани)',
  'rating-desc': 'По рейтинг (звезди)',
  'price-asc': 'Цена: ниска → висока',
  'price-desc': 'Цена: висока → ниска',
  'kw-asc': 'Мощност (kW): ниска → висока',
  'kw-desc': 'Мощност (kW): висока → ниска',
  'btu-asc': 'BTU: 7K → 24K',
  'btu-desc': 'BTU: 24K → 7K',
  'coverage-asc': 'Площ (m²): малка → голяма',
  'coverage-desc': 'Площ (m²): голяма → малка',
  'scop-desc': 'По SCOP (икономичност)',
  'name-asc': 'По име (А–Я)',
  'energy-class': 'Енергиен клас',
  'noise-asc': 'Ниво на шум',
};

function sortOptionsFor(values: SortOption[]) {
  return values.map((value) => ({ value, label: SORT_LABELS[value] }));
}

const CLIMATE_SORT_OPTIONS = sortOptionsFor(CATALOG_SORT_OPTIONS);
export const ACCESSORY_SORT_UI_OPTIONS = sortOptionsFor(ACCESSORY_SORT_OPTIONS);

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
  /** Ограничава опциите за сортиране (напр. аксесоари) */
  sortOptions?: { value: SortOption; label: string }[];
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
  sortOptions = CLIMATE_SORT_OPTIONS,
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
          <div className="relative shrink-0 flex-1 sm:flex-none sm:w-auto sm:min-w-[9.5rem] lg:min-w-[10.5rem] max-w-[11rem] sm:max-w-none">
            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as SortOption)}
              className="w-full appearance-none pl-2.5 pr-7 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs leading-tight text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] cursor-pointer transition-all"
            >
              {sortOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>

        {activeFiltersSlot ? (
          <div className="mt-2 pt-2 border-t border-gray-100/70">{activeFiltersSlot}</div>
        ) : null}
      </div>
    </div>
  );
};
