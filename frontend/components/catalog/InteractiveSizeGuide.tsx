import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Ruler, User } from 'lucide-react';
import type { CatalogProduct } from '../../data/types/product';

export const InteractiveSizeGuide = ({ product }: { product: CatalogProduct }) => {
  const [personHeight, setPersonHeight] = useState(175); // cm

  // Standard wall AC dimensions (approx)
  const acWidthCm = 85; 
  const acHeightCm = 30;

  // Scale: let's say max container height represents 250cm.
  // Then person height = (personHeight / 250) * 100%
  // AC height = (acHeightCm / 250) * 100%

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <Ruler className="w-5 h-5 text-[#00B4D8]" />
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Визуален гид за размери</h3>
      </div>
      <p className="text-xs text-gray-500 mb-6">Сравнете размера на климатика спрямо средния човешки ръст.</p>

      <div className="relative h-64 bg-gray-50 border border-gray-100 rounded-xl overflow-hidden mb-6 flex items-end justify-center">
        {/* Wall background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,0,0,0.03)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
        
        {/* The AC Unit */}
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="absolute top-8 bg-white border border-gray-200 shadow-lg rounded flex items-center justify-center p-2"
          style={{ 
            width: `${(acWidthCm / 250) * 100}%`, 
            height: `${(acHeightCm / 250) * 100}%`,
            minWidth: '100px'
          }}
        >
          <img src={product.image} alt="AC" className="w-full h-full object-contain mix-blend-multiply" />
          <div className="absolute -top-6 text-[10px] font-bold text-gray-400">~{acWidthCm} см</div>
          <div className="absolute -right-12 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">{acHeightCm} см</div>
        </motion.div>

        {/* The Person */}
        <div 
          className="relative flex flex-col items-center justify-end"
          style={{ height: `${(personHeight / 250) * 100}%` }}
        >
          <User className="w-full h-full text-gray-300" strokeWidth={1} />
          <div className="absolute -left-12 top-0 text-[10px] font-bold text-[#FF4D00] border-t border-[#FF4D00] w-10 flex items-center">
            <span className="-mt-3 ml-2">{personHeight} см</span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="flex justify-between text-xs font-bold text-gray-600">
          <span>Вашият ръст: {personHeight} см</span>
        </label>
        <input 
          type="range" 
          min="150" 
          max="200" 
          step="1" 
          value={personHeight} 
          onChange={(e) => setPersonHeight(Number(e.target.value))}
          className="w-full h-1.5 bg-gray-200 rounded-full appearance-none cursor-pointer accent-[#00B4D8]" 
        />
      </div>
    </div>
  );
};
