import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ArrowRightLeft } from 'lucide-react';
import type { CatalogProduct } from '../../data/types/product';

interface CompareBarProps {
  compareList: CatalogProduct[];
  onRemove: (id: string) => void;
  onClear: () => void;
}

export const CompareBar = ({ compareList, onRemove, onClear }: CompareBarProps) => {
  const [showTable, setShowTable] = useState(false);

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
        <div className="bg-white/90 backdrop-blur-xl border border-gray-200 shadow-2xl rounded-2xl p-4 flex flex-col md:flex-row items-center gap-6 pointer-events-auto w-full max-w-4xl">
          
          <div className="flex-1 flex gap-4 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
            <AnimatePresence>
              {compareList.map(p => (
                <motion.div
                  key={p.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="relative flex items-center gap-3 bg-gray-50 rounded-xl p-2 pr-4 border border-gray-100 min-w-[200px]"
                >
                  <button 
                    onClick={() => onRemove(p.id)}
                    className="absolute -top-2 -right-2 bg-white text-gray-400 hover:text-red-500 rounded-full shadow border border-gray-100 w-5 h-5 flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                  <img src={p.image} alt={p.model} className="w-10 h-10 object-contain mix-blend-multiply bg-white rounded-lg p-1" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-[#00B4D8] uppercase truncate">{p.brand}</p>
                    <p className="text-xs font-bold text-gray-900 truncate">{p.model}</p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {compareList.length < 3 && (
              <div className="flex items-center gap-3 bg-gray-50/50 border border-dashed border-gray-300 rounded-xl p-2 px-6 min-w-[200px] justify-center opacity-50">
                <span className="text-xs font-semibold text-gray-400">Добави още {3 - compareList.length}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <button onClick={onClear} className="text-sm font-semibold text-gray-500 hover:text-red-500 transition-colors">
              Изчисти
            </button>
            <button
              onClick={() => setShowTable(true)}
              disabled={compareList.length < 2}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all shadow-md ${
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
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-5xl bg-white rounded-[2rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
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
                      <th className="p-4 border-b border-gray-200 w-1/4">Характеристика</th>
                      {compareList.map(p => (
                        <th key={p.id} className="p-4 border-b border-gray-200 w-1/4 align-top">
                          <img src={p.image} alt={p.model} className="w-24 h-24 object-contain mx-auto mix-blend-multiply mb-4" />
                          <p className="text-xs font-bold text-[#00B4D8] uppercase">{p.brand}</p>
                          <p className="text-sm font-black text-gray-900 mb-2">{p.model}</p>
                          <p className="text-xl font-extrabold text-gray-900">€{p.price.toLocaleString()}</p>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    <tr>
                      <td className="p-4 border-b border-gray-100 font-bold text-gray-500">Цена с монтаж</td>
                      {compareList.map(p => <td key={p.id} className="p-4 border-b border-gray-100 font-semibold">€{p.priceWithMount.toLocaleString()}</td>)}
                    </tr>
                    <tr>
                      <td className="p-4 border-b border-gray-100 font-bold text-gray-500">Енергиен клас</td>
                      {compareList.map(p => <td key={p.id} className="p-4 border-b border-gray-100"><span className="bg-green-500 text-white px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider">{p.energyClass}</span></td>)}
                    </tr>
                    <tr>
                      <td className="p-4 border-b border-gray-100 font-bold text-gray-500">WiFi Управление</td>
                      {compareList.map(p => <td key={p.id} className="p-4 border-b border-gray-100">{p.features.includes('WiFi управление') ? <Check className="text-green-500 w-5 h-5" /> : <span className="text-gray-300">-</span>}</td>)}
                    </tr>
                    <tr>
                      <td className="p-4 border-b border-gray-100 font-bold text-gray-500">Тип</td>
                      {compareList.map(p => <td key={p.id} className="p-4 border-b border-gray-100 capitalize">{p.type}</td>)}
                    </tr>
                    <tr>
                      <td className="p-4 border-b border-gray-100 font-bold text-gray-500">Гаранция</td>
                      {compareList.map(p => <td key={p.id} className="p-4 border-b border-gray-100 font-semibold text-green-600">36 месеца</td>)}
                    </tr>
                    <tr>
                      <td className="p-4 font-bold text-gray-500">Функции</td>
                      {compareList.map(p => (
                        <td key={p.id} className="p-4">
                          <ul className="space-y-1">
                            {p.extras.map((ex, i) => (
                              <li key={i} className="flex items-center gap-1 text-[11px] text-gray-600">
                                <Check className="w-3 h-3 text-green-500" /> {ex}
                              </li>
                            ))}
                          </ul>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
