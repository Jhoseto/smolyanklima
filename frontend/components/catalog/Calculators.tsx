import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Euro, Calculator, Wind } from 'lucide-react';

export const EnergyCalculator = () => {
  const [oldPower, setOldPower] = useState(1.5); // kW/h
  const [newPower, setNewPower] = useState(0.4); // kW/h (inverter)
  const [hoursPerDay, setHoursPerDay] = useState(8);
  const [pricePerKwh, setPricePerKwh] = useState(0.15); // €/kWh

  const oldCost = oldPower * hoursPerDay * 30 * pricePerKwh;
  const newCost = newPower * hoursPerDay * 30 * pricePerKwh;
  const savings = oldCost - newCost;

  return (
    <div className="bg-gradient-to-br from-[#F0F9FF] to-[#E8F4FD] rounded-2xl p-5 border border-[#00B4D8]/20">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center">
          <Zap className="w-4 h-4 text-yellow-500" />
        </div>
        <h3 className="font-bold text-gray-900">Икономия на ток</h3>
      </div>
      
      <div className="space-y-4 text-sm">
        <div>
          <label className="flex justify-between text-gray-600 mb-1">
            <span>Стар климатик (kW)</span>
            <span className="font-bold text-gray-900">{oldPower}</span>
          </label>
          <input type="range" min="0.5" max="3" step="0.1" value={oldPower} onChange={e => setOldPower(Number(e.target.value))} className="w-full accent-yellow-500" />
        </div>
        <div>
          <label className="flex justify-between text-gray-600 mb-1">
            <span>Часове на ден</span>
            <span className="font-bold text-gray-900">{hoursPerDay}ч</span>
          </label>
          <input type="range" min="1" max="24" step="1" value={hoursPerDay} onChange={e => setHoursPerDay(Number(e.target.value))} className="w-full accent-blue-500" />
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-[#00B4D8]/10 text-center">
        <p className="text-xs text-gray-500 mb-1">Очаквано спестяване на месец:</p>
        <motion.p 
          key={savings}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-3xl font-black text-green-500"
        >
          €{savings.toFixed(2)}
        </motion.p>
      </div>
    </div>
  );
};

export const PowerCalculator = () => {
  const [area, setArea] = useState(25);
  const [insulation, setInsulation] = useState<'good' | 'poor'>('good');
  
  const btu = insulation === 'good' ? area * 180 : area * 250;
  let recommended = '9000 BTU';
  if (btu > 9000) recommended = '12000 BTU';
  if (btu > 12000) recommended = '18000 BTU';
  if (btu > 18000) recommended = '24000 BTU';

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm mt-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
          <Calculator className="w-4 h-4 text-blue-500" />
        </div>
        <h3 className="font-bold text-gray-900">Нужна мощност</h3>
      </div>
      
      <div className="space-y-4 text-sm">
        <div>
          <label className="flex justify-between text-gray-600 mb-1">
            <span>Площ (м²)</span>
            <span className="font-bold text-gray-900">{area}</span>
          </label>
          <input type="range" min="10" max="100" step="1" value={area} onChange={e => setArea(Number(e.target.value))} className="w-full accent-[#00B4D8]" />
        </div>
        
        <div className="flex bg-gray-50 p-1 rounded-lg">
          <button 
            onClick={() => setInsulation('good')} 
            className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors ${insulation === 'good' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
          >
            Добра изолация
          </button>
          <button 
            onClick={() => setInsulation('poor')} 
            className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors ${insulation === 'poor' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
          >
            Слаба изолация
          </button>
        </div>
      </div>

      <div className="mt-5 text-center">
        <p className="text-xs text-gray-500 mb-1">Препоръчителна мощност:</p>
        <motion.p 
          key={recommended}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-xl font-black text-[#FF4D00]"
        >
          ~{recommended}
        </motion.p>
      </div>
    </div>
  );
};
