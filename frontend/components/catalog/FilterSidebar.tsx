import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, RotateCcw } from 'lucide-react';
import { BRANDS } from '../../data/productService';
import { EnergyCalculator, PowerCalculator } from './Calculators';

const ENERGY_CLASSES = ['A+++', 'A++', 'A+', 'A'];

const FEATURES_LIST = [
  'WiFi управление',
  'Инвертор',
  'Нощен режим',
  'Самопочистване',
  'Йонизатор',
  'nanoe™',
  'Турбо режим',
];

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

const Accordion = ({ title, children, defaultOpen = true }: AccordionProps) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-3.5 text-sm font-bold text-gray-800 hover:text-gray-900 transition-colors"
      >
        {title}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface FilterSidebarProps {
  selectedBrands: string[];
  onBrandToggle: (brand: string) => void;
  selectedEnergy: string[];
  onEnergyToggle: (cls: string) => void;
  selectedFeatures: string[];
  onFeatureToggle: (feat: string) => void;
  priceRange: [number, number];
  onPriceChange: (range: [number, number]) => void;
  priceMin: number;
  priceMax: number;
  onReset: () => void;
  activeFilterCount: number;
}

export const FilterSidebar = ({
  selectedBrands,
  onBrandToggle,
  selectedEnergy,
  onEnergyToggle,
  selectedFeatures,
  onFeatureToggle,
  priceRange,
  onPriceChange,
  priceMin,
  priceMax,
  onReset,
  activeFilterCount,
}: FilterSidebarProps) => {
  return (
    <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sticky top-[120px] max-h-[calc(100vh-140px)] overflow-y-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-black text-gray-900 uppercase tracking-tight">Филтри</h2>
        {activeFilterCount > 0 && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#FF4D00] hover:text-[#E64500] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Изчисти ({activeFilterCount})
          </button>
        )}
      </div>

      {/* Brands */}
      <Accordion title="Марка">
        <div className="space-y-2">
          {BRANDS.map((brand) => (
            <label key={brand.id} className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                selectedBrands.includes(brand.name)
                  ? 'border-[#00B4D8] bg-[#00B4D8]'
                  : 'border-gray-300 group-hover:border-[#00B4D8]/50'
              }`}>
                {selectedBrands.includes(brand.name) && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedBrands.includes(brand.name)}
                onChange={() => onBrandToggle(brand.name)}
              />
              <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
                {brand.name}
              </span>
            </label>
          ))}
        </div>
      </Accordion>

      {/* Price Range */}
      <Accordion title="Ценови диапазон">
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm font-bold text-gray-800">
            <span>€{priceRange[0].toLocaleString()}</span>
            <span>€{priceRange[1].toLocaleString()}</span>
          </div>

          {/* Price Histogram (Airbnb style) */}
          <div className="flex items-end justify-between h-10 gap-0.5 px-2">
            {[2, 5, 8, 12, 18, 24, 30, 22, 16, 10, 6, 3, 2, 1, 1].map((height, i, arr) => {
              // Calculate if this bar falls within the selected price range
              const bucketMin = priceMin + (priceMax - priceMin) * (i / arr.length);
              const bucketMax = priceMin + (priceMax - priceMin) * ((i + 1) / arr.length);
              const isActive = bucketMax > priceRange[0] && bucketMin < priceRange[1];

              return (
                <div
                  key={i}
                  style={{ height: `${(height / 30) * 100}%` }}
                  className={`flex-1 rounded-t-sm transition-colors duration-300 ${isActive ? 'bg-[#FF4D00]' : 'bg-gray-200'}`}
                />
              );
            })}
          </div>

          {/* Min slider */}
          <div className="relative mt-2">
            <input
              type="range"
              min={priceMin}
              max={priceMax}
              step={50}
              value={priceRange[0]}
              onChange={(e) => {
                const val = Math.min(+e.target.value, priceRange[1] - 100);
                onPriceChange([val, priceRange[1]]);
              }}
              className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#FF4D00]"
            />
          </div>
          {/* Max slider */}
          <div className="relative">
            <input
              type="range"
              min={priceMin}
              max={priceMax}
              step={50}
              value={priceRange[1]}
              onChange={(e) => {
                const val = Math.max(+e.target.value, priceRange[0] + 100);
                onPriceChange([priceRange[0], val]);
              }}
              className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#FF4D00]"
            />
          </div>
          <p className="text-xs text-gray-400 text-center">Мин. €100 разлика</p>
        </div>
      </Accordion>

      {/* Energy Class */}
      <Accordion title="Енергиен клас">
        <div className="flex flex-wrap gap-2">
          {ENERGY_CLASSES.map((cls) => (
            <button
              key={cls}
              onClick={() => onEnergyToggle(cls)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition-all ${
                selectedEnergy.includes(cls)
                  ? 'bg-green-500 border-green-500 text-white'
                  : 'bg-white border-gray-200 text-gray-700 hover:border-green-400 hover:text-green-600'
              }`}
            >
              {cls}
            </button>
          ))}
        </div>
      </Accordion>

      {/* Features */}
      <Accordion title="Функции" defaultOpen={false}>
        <div className="space-y-2">
          {FEATURES_LIST.map((feat) => (
            <label key={feat} className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                selectedFeatures.includes(feat)
                  ? 'border-[#FF4D00] bg-[#FF4D00]'
                  : 'border-gray-300 group-hover:border-[#FF4D00]/50'
              }`}>
                {selectedFeatures.includes(feat) && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <input
                type="checkbox"
                className="sr-only"
                checked={selectedFeatures.includes(feat)}
                onChange={() => onFeatureToggle(feat)}
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">{feat}</span>
            </label>
          ))}
        </div>
      </Accordion>

      {/* ── CALCULATORS ────────────────────── */}
      <div className="mt-6 border-t border-gray-100 pt-6">
        <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-4">Полезни инструменти</h3>
        <EnergyCalculator />
        <PowerCalculator />
      </div>

    </aside>
  );
};
