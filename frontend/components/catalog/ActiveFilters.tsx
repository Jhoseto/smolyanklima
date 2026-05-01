import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ActiveFiltersProps {
  brands: string[];
  energyClasses: string[];
  features: string[];
  search: string;
  onRemoveBrand: (b: string) => void;
  onRemoveEnergy: (e: string) => void;
  onRemoveFeature: (f: string) => void;
  onClearSearch: () => void;
  onClearAll: () => void;
}

interface ChipProps {
  label: string;
  onRemove: () => void;
  color?: 'blue' | 'orange' | 'green' | 'purple';
  key?: React.Key;
}

const Chip = ({ label, onRemove, color = 'blue' }: ChipProps) => {
  const colorMap = {
    blue:   'bg-[#EBF5FF] text-[#00B4D8] border-[#00B4D8]/20',
    orange: 'bg-[#FFF5ED] text-[#FF4D00] border-[#FF4D00]/20',
    green:  'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };

  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.15 }}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${colorMap[color]}`}
    >
      {label}
      <button
        onClick={onRemove}
        className="hover:opacity-60 transition-opacity p-0.5 -mr-0.5 rounded"
        aria-label={`Премахни ${label}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.span>
  );
};

export const ActiveFilters = ({
  brands,
  energyClasses,
  features,
  search,
  onRemoveBrand,
  onRemoveEnergy,
  onRemoveFeature,
  onClearSearch,
  onClearAll,
}: ActiveFiltersProps) => {
  const hasAny = brands.length > 0 || energyClasses.length > 0 || features.length > 0 || search.trim();

  if (!hasAny) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 py-3">
      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider shrink-0">Активни:</span>

      <AnimatePresence mode="popLayout">
        {search.trim() && (
          <Chip key="search" label={`"${search}"`} onRemove={onClearSearch} color="purple" />
        )}
        {brands.map(b => (
          <Chip key={`brand-${b}`} label={b} onRemove={() => onRemoveBrand(b)} color="blue" />
        ))}
        {energyClasses.map(e => (
          <Chip key={`energy-${e}`} label={e} onRemove={() => onRemoveEnergy(e)} color="green" />
        ))}
        {features.map(f => (
          <Chip key={`feat-${f}`} label={f} onRemove={() => onRemoveFeature(f)} color="orange" />
        ))}
      </AnimatePresence>

      <motion.button
        layout
        onClick={onClearAll}
        className="text-xs font-semibold text-gray-400 hover:text-red-500 transition-colors ml-1 underline underline-offset-2"
      >
        Изчисти всички
      </motion.button>
    </div>
  );
};
