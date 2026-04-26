import React, { useState, useRef, useEffect } from 'react';
import { motion, useDragControls } from 'motion/react';
import { Camera, Image as ImageIcon, Move, Maximize, Minimize } from 'lucide-react';
import type { CatalogProduct } from '../../data/types/product';

const ROOM_PRESETS = [
  'https://images.unsplash.com/photo-1583847268964-b28ce8f30e66?auto=format&fit=crop&q=80&w=800', // Modern living room
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&q=80&w=800', // Bedroom
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800', // Office
];

export const VirtualTryInRoom = ({ product }: { product: CatalogProduct }) => {
  const [bgImage, setBgImage] = useState<string>(ROOM_PRESETS[0]);
  const [acScale, setAcScale] = useState(1);
  const dragControls = useDragControls();
  const constraintsRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setBgImage(url);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-[#FF4D00]" />
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Виртуална проба в стаята</h3>
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">Вижте как ще стои климатикът във вашия дом. Изберете стая или качете своя снимка.</p>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex gap-2">
          {ROOM_PRESETS.map((preset, i) => (
            <button
              key={i}
              onClick={() => setBgImage(preset)}
              className={`w-12 h-12 rounded-lg border-2 overflow-hidden ${bgImage === preset ? 'border-[#FF4D00]' : 'border-transparent'}`}
            >
              <img src={preset} alt={`Room ${i + 1}`} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
        
        <label className="flex items-center gap-2 px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg cursor-pointer transition-colors text-sm font-semibold text-gray-700">
          <ImageIcon className="w-4 h-4 text-gray-500" />
          Качи снимка
          <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
        </label>
        
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => setAcScale(prev => Math.max(0.5, prev - 0.1))} className="p-1.5 bg-gray-50 rounded-md hover:bg-gray-100" title="Намали">
            <Minimize className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-xs font-bold w-8 text-center">{Math.round(acScale * 100)}%</span>
          <button onClick={() => setAcScale(prev => Math.min(2, prev + 0.1))} className="p-1.5 bg-gray-50 rounded-md hover:bg-gray-100" title="Увеличи">
            <Maximize className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div 
        ref={constraintsRef}
        className="relative w-full h-[300px] md:h-[400px] bg-gray-100 rounded-xl overflow-hidden shadow-inner"
        style={{ backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <motion.div
          drag
          dragControls={dragControls}
          dragConstraints={constraintsRef}
          dragElastic={0}
          dragMomentum={false}
          initial={{ x: 100, y: 50 }}
          style={{ scale: acScale }}
          className="absolute cursor-move flex flex-col items-center group"
        >
          {/* Drag Handle UI (visible on hover) */}
          <div className="absolute -top-6 bg-white/90 backdrop-blur-sm px-2 py-1 rounded shadow-sm text-[10px] font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 pointer-events-none">
            <Move className="w-3 h-3" /> Плъзнете
          </div>
          <img 
            src={product.image} 
            alt="AC Unit" 
            className="w-48 drop-shadow-2xl mix-blend-multiply bg-white/5 rounded-lg p-2"
            draggable={false}
          />
        </motion.div>
      </div>
    </div>
  );
};
