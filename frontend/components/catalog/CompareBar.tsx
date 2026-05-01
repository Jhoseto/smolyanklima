import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ArrowRightLeft, DollarSign, Zap, Volume2, Square, Wifi, Tag, Shield, Star, Loader2 } from 'lucide-react';
import type { CatalogProduct } from '../../data/types/product';
import { getComparisonAIService } from '../ai-assistant/core/ComparisonAIService';

interface CompareBarProps {
  compareList: CatalogProduct[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export const CompareBar = ({ compareList, onRemove, onClear }: CompareBarProps) => {
  const [showTable, setShowTable] = useState(false);
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  // Generate AI recommendation when table opens
  useEffect(() => {
    if (showTable && compareList.length >= 2) {
      generateAIRecommendation();
    }
  }, [showTable, compareList]);

  const generateAIRecommendation = async () => {
    setIsLoadingAi(true);
    try {
      const comparisonService = getComparisonAIService();
      // Convert CatalogProduct to Product format
      const products = compareList.map(p => ({
        id: p.id,
        name: `${p.brand} ${p.model}`,
        brand: p.brand,
        model: p.model,
        image: p.image,
        price: p.price,
        oldPrice: undefined,
        energyClass: p.energyClass,
        specs: {
          power: p.coolingPower,
          coolingCapacity: 2.5,
          heatingCapacity: 3.2,
          coverage: parseInt(p.area) || 25,
          noiseLevel: parseInt(p.noise) || 25,
          energyEfficiency: 5.5,
          seer: 0,
        },
        features: p.features,
        inStock: true,
        warranty: { years: 3, compressor: 5, parts: 3, labor: 2 },
        rating: 0,
        reviewCount: 0,
        suitableFor: [],
        popularityScore: 0,
        type: p.type,
      }));
      
      const recommendation = await comparisonService.generateComparison(products);
      
      // Build the recommendation text
      let recommendationText = recommendation.summary;
      if (recommendation.bestChoice) {
        recommendationText += `\n\n${recommendation.bestChoice}`;
      }
      if (recommendation.keyDifferences.length > 0) {
        recommendationText += `\n\nКлючови разлики:\n${recommendation.keyDifferences.join('\n')}`;
      }
      if (recommendation.recommendation) {
        recommendationText += `\n\nПрепоръка: ${recommendation.recommendation}`;
      }
      
      setAiRecommendation(recommendationText);
    } catch (error) {
      console.error('Error generating AI recommendation:', error);
      setAiRecommendation('Не успяхме да генерираме AI препоръка. Моля, опитайте отново.');
    } finally {
      setIsLoadingAi(false);
    }
  };

  if (compareList.length === 0) return null;

  return (
    <>
      {/* ── FLOAT BAR ────────────────────── */}
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-[150] p-4 pointer-events-none flex justify-center"
      >
        <div className="bg-white/90 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-2xl p-3 md:p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3 md:gap-6 pointer-events-auto w-full max-w-4xl">
          
          <div className="flex-1 flex gap-2 md:gap-4 w-full overflow-x-auto pb-0.5 scrollbar-hide">
            <AnimatePresence>
              {compareList.map(p => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative flex items-center gap-2 bg-gray-50 rounded-xl p-2 pr-3 border border-gray-100 min-w-[150px] md:min-w-[180px] shrink-0"
                >
                  <button 
                    onClick={() => onRemove(p.id)}
                    className="absolute -top-2 -right-2 bg-white text-gray-400 hover:text-red-500 rounded-full shadow border border-gray-100 w-5 h-5 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <img src={p.image} alt={p.model} className="w-8 h-8 md:w-10 md:h-10 object-contain mix-blend-multiply bg-white rounded-lg p-1 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-[#00B4D8] uppercase truncate">{p.brand}</p>
                    <p className="text-xs font-bold text-gray-900 truncate">{p.model}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {compareList.length < 3 && (
              <div className="flex items-center gap-2 bg-gray-50/50 border border-dashed border-gray-300 rounded-xl p-2 px-4 min-w-[120px] md:min-w-[160px] justify-center opacity-50 shrink-0">
                <span className="text-xs font-semibold text-gray-400">+ още {3 - compareList.length}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3 shrink-0 justify-between md:justify-start">
            <button onClick={onClear} className="text-sm font-semibold text-gray-500 hover:text-red-500 transition-colors">
              Изчисти
            </button>
            <button
              onClick={() => setShowTable(true)}
              disabled={compareList.length < 2}
              className={`flex items-center gap-2 px-5 py-2.5 md:px-6 md:py-3 rounded-full font-bold transition-all shadow-md text-sm ${
                compareList.length >= 2 
                  ? 'bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-white hover:shadow-lg hover:scale-105' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <ArrowRightLeft className="w-4 h-4" />
              Сравни сега
            </button>
          </div>
        </div>
      </motion.div>

      {/* ── COMPARE MODAL TABLE ─────────── */}
      <AnimatePresence>
        {showTable && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 pointer-events-auto">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowTable(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="relative w-full max-w-5xl bg-white rounded-t-[2rem] sm:rounded-[2rem] shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-100 bg-gray-50/50">
                <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5 text-[#00B4D8]" />
                  Сравнение на модели
                </h2>
                <button
                  onClick={() => setShowTable(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-gray-400 hover:text-gray-900 shadow-sm border border-gray-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="overflow-auto p-6 flex-1">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="p-4 border-b-2 border-gray-200 w-1/4 bg-gray-50/50 sticky left-0">Характеристика</th>
                      {compareList.map(p => (
                        <th key={p.id} className="p-4 border-b-2 border-gray-200 w-1/4 align-top">
                          <div className="relative">
                            <img src={p.image} alt={p.model} className="w-28 h-28 object-contain mx-auto mix-blend-multiply mb-3 bg-white rounded-xl p-2 shadow-sm" />
                            <div className="absolute top-0 right-0 bg-gradient-to-r from-[#00B4D8] to-[#0077B6] text-white text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider">
                              {p.brand}
                            </div>
                          </div>
                          <p className="text-sm font-black text-gray-900 mb-1 leading-tight">{p.model}</p>
                          <p className="text-2xl font-extrabold bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] bg-clip-text text-transparent">€{p.price.toLocaleString()}</p>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 border-b border-gray-100 font-bold text-gray-600 bg-gray-50/30 flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-[#FF4D00]" />
                        Цена с монтаж
                      </td>
                      {compareList.map((p, idx) => {
                        const prices = compareList.map(cp => cp.priceWithMount);
                        const isCheapest = p.priceWithMount === Math.min(...prices);
                        const isMostExpensive = p.priceWithMount === Math.max(...prices);
                        return (
                          <td key={p.id} className={`p-4 border-b border-gray-100 font-semibold ${isCheapest ? 'bg-green-50' : isMostExpensive ? 'bg-red-50' : ''}`}>
                            <span className={isCheapest ? 'text-green-600' : isMostExpensive ? 'text-red-600' : 'text-gray-900'}>
                              €{p.priceWithMount.toLocaleString()}
                            </span>
                            {isCheapest && <span className="ml-2 text-[10px] font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full">НАЙ-ДОБРА ЦЕНА</span>}
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 border-b border-gray-100 font-bold text-gray-600 bg-gray-50/30 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-[#00B4D8]" />
                        Енергиен клас
                      </td>
                      {compareList.map((p, idx) => {
                        const energyOrder = ['A+++', 'A++', 'A+', 'A', 'B'];
                        const energyScores = compareList.map(cp => energyOrder.indexOf(cp.energyClass));
                        const bestEnergy = Math.min(...energyScores);
                        const isBest = energyOrder.indexOf(p.energyClass) === bestEnergy;
                        return (
                          <td key={p.id} className={`p-4 border-b border-gray-100 ${isBest ? 'bg-green-50' : ''}`}>
                            <span className={`px-3 py-1 rounded-full text-[11px] font-black tracking-wider ${isBest ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}>
                              {p.energyClass}
                            </span>
                            {isBest && <span className="ml-2 text-[10px] font-bold text-green-600">НАЙ-ЕФИКАСЕН</span>}
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 border-b border-gray-100 font-bold text-gray-600 bg-gray-50/30 flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-[#0077B6]" />
                        Шум (dB)
                      </td>
                      {compareList.map((p, idx) => {
                        const noiseLevels = compareList.map(cp => parseInt(cp.noise) || 0);
                        const isQuietest = parseInt(p.noise) === Math.min(...noiseLevels);
                        return (
                          <td key={p.id} className={`p-4 border-b border-gray-100 ${isQuietest ? 'bg-green-50' : ''}`}>
                            <span className={isQuietest ? 'text-green-600 font-bold' : 'text-gray-900'}>{p.noise} dB</span>
                            {isQuietest && <span className="ml-2 text-[10px] font-bold text-green-600">НАЙ-ТИХ</span>}
                          </td>
                        );
                      })}
                    </tr>
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 border-b border-gray-100 font-bold text-gray-600 bg-gray-50/30 flex items-center gap-2">
                        <Square className="w-4 h-4 text-gray-400" />
                        Покритие (м²)
                      </td>
                      {compareList.map(p => <td key={p.id} className="p-4 border-b border-gray-100 font-semibold text-gray-900">{p.area}</td>)}
                    </tr>
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 border-b border-gray-100 font-bold text-gray-600 bg-gray-50/30 flex items-center gap-2">
                        <Wifi className="w-4 h-4 text-[#00B4D8]" />
                        WiFi Управление
                      </td>
                      {compareList.map(p => (
                        <td key={p.id} className="p-4 border-b border-gray-100">
                          {p.features.includes('WiFi управление') ? (
                            <span className="flex items-center gap-2 text-green-600 font-bold">
                              <Check className="w-4 h-4" /> Да
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 border-b border-gray-100 font-bold text-gray-600 bg-gray-50/30 flex items-center gap-2">
                        <Tag className="w-4 h-4 text-gray-400" />
                        Тип
                      </td>
                      {compareList.map(p => <td key={p.id} className="p-4 border-b border-gray-100 capitalize text-gray-900">{p.type}</td>)}
                    </tr>
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 border-b border-gray-100 font-bold text-gray-600 bg-gray-50/30 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-600" />
                        Гаранция
                      </td>
                      {compareList.map(p => <td key={p.id} className="p-4 border-b border-gray-100 font-semibold text-green-600">36 месеца</td>)}
                    </tr>
                    <tr className="hover:bg-gray-50/50 transition-colors">
                      <td className="p-4 font-bold text-gray-600 bg-gray-50/30 flex items-center gap-2">
                        <Star className="w-4 h-4 text-[#FF4D00]" />
                        Функции
                      </td>
                      {compareList.map(p => (
                        <td key={p.id} className="p-4">
                          <ul className="space-y-1.5">
                            {p.extras.slice(0, 5).map((ex, i) => (
                              <li key={i} className="flex items-center gap-2 text-[11px] text-gray-700">
                                <Check className="w-3 h-3 text-green-500 shrink-0" /> {ex}
                              </li>
                            ))}
                            {p.extras.length > 5 && (
                              <li className="text-[10px] text-gray-400 italic">+ още {p.extras.length - 5} функции</li>
                            )}
                          </ul>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
                
                {/* AI Summary Section */}
                <div className="mt-6 p-5 bg-gradient-to-r from-[#00B4D8]/5 to-[#0077B6]/5 rounded-2xl border border-[#00B4D8]/20">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-[#00B4D8] to-[#0077B6] rounded-lg flex items-center justify-center">
                      {isLoadingAi ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <Star className="w-4 h-4 text-white" />
                      )}
                    </div>
                    <h3 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                      {isLoadingAi ? 'Генериране на Препоръка...' : 'Сравнителен анализ '}
                    </h3>
                  </div>
                  {isLoadingAi ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Обработване актуална информация от квалифицирани източници...</span>
                    </div>
                  ) : aiRecommendation ? (
                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">
                      {aiRecommendation}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-500 italic">
                      Натиснете бутона за сравнение за да генерирате AI препоръка с информация от Google Search.
                    </p>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
