import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, Layers, Building2, Wind, ArrowRight, CheckCircle2, RotateCcw } from 'lucide-react';
import { getFilteredProducts } from '../../data/productService';
import type { CatalogProduct } from '../../data/types/product';
import { ProductCard } from './ProductCard';

interface Step {
  question: string;
  options: { label: string; icon?: React.ReactNode; value: string }[];
}

const STEPS: Step[] = [
  {
    question: "Какво помещение ще климатизирате?",
    options: [
      { label: "Една стая", icon: <Home className="w-5 h-5" />, value: "wall" },
      { label: "Няколко стаи", icon: <Layers className="w-5 h-5" />, value: "multi" },
      { label: "Търговско / Офис", icon: <Building2 className="w-5 h-5" />, value: "commercial" },
    ]
  },
  {
    question: "Каква е площта на помещението?",
    options: [
      { label: "До 25 кв.м.", value: "small" }, // 9000 BTU
      { label: "25 - 35 кв.м.", value: "medium" }, // 12000 BTU
      { label: "35 - 50 кв.м.", value: "large" }, // 18000 BTU
      { label: "Над 50 кв.м.", value: "xlarge" }, // 24000+ BTU
    ]
  },
  {
    question: "Какъв е основният ви приоритет?",
    options: [
      { label: "Ниска цена", value: "budget" },
      { label: "Висока енергийна ефективност", value: "efficiency" },
      { label: "Тишина и комфорт", value: "comfort" },
      { label: "Smart функции (WiFi)", value: "smart" },
    ]
  }
];

export const GuidedBuyingWizard = ({ onQuickView, isFavorite, onFavoriteToggle, onShare }: any) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [results, setResults] = useState<CatalogProduct[] | null>(null);

  const handleSelect = (val: string) => {
    const newAnswers = { ...answers, [currentStep]: val };
    setAnswers(newAnswers);
    
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      // Calculate results
      generateRecommendations(newAnswers);
    }
  };

  const generateRecommendations = (ans: Record<number, string>) => {
    // Map area to BTU roughly
    let minPower = 0;
    let maxPower = 99999;
    if (ans[1] === 'small') maxPower = 10000;
    if (ans[1] === 'medium') { minPower = 11000; maxPower = 14000; }
    if (ans[1] === 'large') { minPower = 17000; maxPower = 20000; }
    if (ans[1] === 'xlarge') minPower = 22000;

    // We can't filter power perfectly yet because our dummy data doesn't have exact BTU in power prop,
    // but we can sort and slice.
    
    let all = getFilteredProducts({});
    
    // Sort logic based on priority
    if (ans[2] === 'budget') {
      all.sort((a, b) => a.price - b.price);
    } else if (ans[2] === 'efficiency') {
      all = all.filter(p => p.energyClass.includes('A++'));
    } else if (ans[2] === 'smart') {
      all = all.filter(p => p.features.includes('WiFi управление'));
    }

    setResults(all.slice(0, 3));
  };

  const reset = () => {
    setCurrentStep(0);
    setAnswers({});
    setResults(null);
  };

  if (!isOpen) {
    return (
      <div className="bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] rounded-2xl p-8 text-white flex flex-col md:flex-row items-center justify-between mb-8 shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        <div className="relative z-10 max-w-xl">
          <h2 className="text-2xl font-black mb-2">Не сте сигурни кой климатик е за вас?</h2>
          <p className="text-white/80 text-sm">Отговорете на 3 кратки въпроса и ние ще ви препоръчаме най-подходящите модели за вашите нужди.</p>
        </div>
        <button 
          onClick={() => setIsOpen(true)}
          className="mt-6 md:mt-0 relative z-10 bg-white text-[#FF4D00] font-bold px-8 py-3 rounded-full hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
        >
          Стартирай помощника <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-xl p-8 mb-8">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-xl font-black text-gray-900">Помощник за избор</h2>
        <button onClick={() => setIsOpen(false)} className="text-sm font-semibold text-gray-400 hover:text-gray-600">Затвори</button>
      </div>

      {!results ? (
        <div className="max-w-2xl mx-auto">
          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((_, i) => (
              <div key={i} className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: i <= currentStep ? '100%' : '0%' }}
                  className="h-full bg-[#00B4D8]"
                />
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <h3 className="text-2xl font-bold text-gray-900 text-center mb-8">{STEPS[currentStep].question}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {STEPS[currentStep].options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleSelect(opt.value)}
                    className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-gray-100 hover:border-[#00B4D8] hover:bg-[#F0F9FF] transition-all group"
                  >
                    {opt.icon && <div className="text-gray-400 group-hover:text-[#00B4D8] transition-colors">{opt.icon}</div>}
                    <span className="font-bold text-gray-700 group-hover:text-[#00B4D8]">{opt.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 text-green-500 mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-black text-gray-900 mb-2">Вашите препоръки</h3>
            <p className="text-gray-500">Подбрахме тези 3 модела специално за вас.</p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
            {results.map((product, idx) => (
              <ProductCard
                key={product.id}
                product={product}
                index={idx}
                onQuickView={onQuickView}
                isFavorite={isFavorite(product.id)}
                onFavoriteToggle={onFavoriteToggle}
                onShare={onShare}
              />
            ))}
          </div>

          <div className="text-center">
            <button onClick={reset} className="flex items-center gap-2 mx-auto text-sm font-bold text-gray-500 hover:text-gray-800 transition-colors">
              <RotateCcw className="w-4 h-4" /> Започни отначало
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
