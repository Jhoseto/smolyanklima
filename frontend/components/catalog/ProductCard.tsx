import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { Star, Check, ChevronRight, Heart, Share2 } from 'lucide-react';
import type { CatalogProduct } from '../../data/types/product';

interface ProductCardProps {
  product: CatalogProduct;
  index: number;
  onQuickView: (product: CatalogProduct) => void;
  isFavorite: boolean;
  onFavoriteToggle: (id: string) => void;
  onShare: (product: CatalogProduct) => void;
  /** Highlight text за instant search */
  highlight?: string;
  isCompared?: boolean;
  onCompareToggle?: () => void;
  viewMode?: 'grid' | 'list';
  key?: React.Key;
}

function HighlightText({ text, highlight }: { text: string; highlight?: string }) {
  if (!highlight?.trim()) return <>{text}</>;
  const parts = text.split(new RegExp(`(${highlight})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">{part}</mark>
        ) : part
      )}
    </>
  );
}

export const ProductCard = ({
  product,
  index,
  onQuickView,
  isFavorite,
  onFavoriteToggle,
  onShare,
  highlight,
  isCompared = false,
  onCompareToggle,
  viewMode = 'grid',
}: ProductCardProps) => {
  const [imgError, setImgError] = useState(false);

  // Детерминистични психо-тригери базирани на ID
  const hash = product.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  const urgencyTypes = [
    { text: 'Последни 2 бр.', bg: 'bg-orange-500', icon: '🔥' },
    { text: '12 души разглеждат', bg: 'bg-blue-500', icon: '👁️' },
    { text: 'Топ избор', bg: 'bg-purple-500', icon: '⭐' },
    null, // Някои карти нямат urgency badge
    null
  ];
  const urgency = urgencyTypes[hash % urgencyTypes.length];
  const buyersCount = 15 + (hash % 85); // 15 to 100
  const isList = viewMode === 'list';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.4) }}
      whileHover={{ y: isList ? 0 : -6, x: isList ? 4 : 0, transition: { duration: 0.2 } }}
      className={`bg-white rounded-[1.5rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border ${product.cardBorder} flex ${isList ? 'flex-row items-center' : 'flex-col'} group relative`}
    >
      {/* ── IMAGE AREA ──────────────────────────── */}
      <div
        className={`relative shrink-0 overflow-hidden cursor-pointer ${product.imgBg ?? 'bg-gray-50'} ${
          isList ? 'h-32 w-40 sm:h-40 sm:w-56' : 'h-40 w-full'
        }`}
        onClick={() => onQuickView(product)}
      >
        <img
          src={imgError ? '/images/hero-ac.jpg' : product.image}
          alt={product.model}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain p-3 transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-80" />

        <div className="absolute top-3 left-3 flex flex-col gap-1.5">
          {product.badge && (
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold ${product.badge.bg} ${product.badge.textCol} shadow-sm`}>
              {product.badge.text}
            </span>
          )}
        </div>

        {/* Energy class badge */}
        {product.energyClass && (
          <span className="absolute top-3 right-3 bg-green-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md">
            {product.energyClass}
          </span>
        )}
      </div>

      {/* ── CONTENT AREA ─────────────────────────── */}
      <div className={`flex-grow flex ${isList ? 'flex-row items-center p-3 sm:p-5' : 'flex-col p-4'}`}>
        
        {/* Basic Info */}
        <div className={`${isList ? 'flex-1 min-w-0' : 'mb-3'}`}>
          <p className="text-[10px] font-bold text-[#00B4D8] uppercase tracking-wider mb-0.5">{product.brand}</p>
          <h3 className={`${isList ? 'text-[1.1rem]' : 'text-[0.95rem]'} font-bold text-gray-900 leading-tight mb-0.5 line-clamp-2`}>
            <HighlightText text={product.model} highlight={highlight} />
          </h3>
          <p className="text-[10px] text-gray-500">{product.type}</p>
          
          {isList && (
            <div className="flex items-center gap-1 mt-2">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-3 h-3 ${i < Math.floor(product.rating) ? 'fill-current' : 'fill-gray-200 text-gray-200'}`}
                  />
                ))}
              </div>
              <span className="text-[10px] font-semibold text-gray-700 ml-0.5">{product.rating}</span>
              <span className="text-[10px] text-gray-500 ml-1 sm:inline hidden">({product.reviews} отзива)</span>
            </div>
          )}
        </div>

        {/* Specs & Features (Hidden on mobile list for extreme compactness) */}
        {isList ? (
          <div className="hidden md:flex flex-[1.5] flex-col gap-3 px-6 border-x border-gray-100">
            <div className="flex flex-wrap gap-4">
              {product.specs.slice(0, 3).map((spec, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] font-medium text-gray-700">
                  <span className="text-base leading-none">{spec.icon}</span>
                  <span>{spec.text}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {product.extras.slice(0, 2).map((extra, i) => (
                <div key={i} className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-full px-2 py-0.5 text-[9px] font-medium text-gray-600">
                  <Check className="w-2 h-2 text-green-500" strokeWidth={4} />
                  {extra}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {product.specs.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-3">
                {product.specs.map((spec, i) => (
                  <div key={i} className="flex items-center gap-1 text-[11px] font-medium text-gray-700">
                    <span className="text-sm">{spec.icon}</span>
                    <span>{spec.text}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {product.extras.slice(0, 3).map((extra, i) => (
                <div key={i} className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-0.5 text-[10px] font-medium text-gray-700">
                  <Check className="w-2.5 h-2.5 text-green-500 shrink-0" strokeWidth={3} />
                  {extra}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Price & Actions */}
        <div className={`${isList ? 'flex items-center gap-4 sm:gap-8 ml-4 sm:ml-8' : 'flex flex-col gap-3'}`}>
          {!isList && (
            <div className="flex flex-col gap-1 mb-3">
              <div className="flex items-center gap-1">
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-3.5 h-3.5 ${i < Math.floor(product.rating) ? 'fill-current' : 'fill-gray-200 text-gray-200'}`}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-semibold text-gray-700 ml-0.5">{product.rating}</span>
                <span className="text-[11px] text-gray-500">({product.reviews} отзива)</span>
              </div>
              <p className="text-[10px] font-medium text-gray-500 flex items-center gap-1">
                <span className="text-gray-400">👥</span> {buyersCount} клиента избраха този модел
              </p>
            </div>
          )}

          <div className="text-right">
            <div className="flex items-baseline justify-end gap-0.5">
              <span className={`${isList ? 'text-2xl' : 'text-2xl'} font-extrabold text-gray-900`}>€{product.price.toLocaleString()}</span>
            </div>
            <p className="text-[9px] text-gray-500 whitespace-nowrap">с монтаж от €{product.priceWithMount.toLocaleString()}</p>
          </div>

          <div className="flex flex-col gap-2">
            <a
              href="#contact"
              className="flex items-center justify-center gap-1.5 bg-[#EBF5FF] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white transition-all duration-200 px-4 py-2 rounded-full font-bold text-[11px] shadow-sm hover:shadow-md"
            >
              Запитване
            </a>
            {onCompareToggle && (
              <button
                onClick={onCompareToggle}
                className={`flex items-center justify-center gap-1.5 px-4 py-2 rounded-full font-bold text-[11px] transition-all duration-200 ${
                  isCompared
                    ? 'bg-[#FF4D00] text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"></line>
                  <line x1="12" y1="20" x2="12" y2="4"></line>
                  <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                {isCompared ? 'Добавено' : 'Сравни'}
              </button>
            )}
            {isList && (
              <Link
                to={`/product/${product.id}`}
                className="text-[10px] font-bold text-gray-400 hover:text-[#FF4D00] text-center transition-colors"
              >
                Детайли
              </Link>
            )}
          </div>
        </div>

        {/* Grid-only bottom area */}
        {!isList && (
          <div className="text-center pt-3 mt-auto border-t border-gray-100">
            <Link
              to={`/product/${product.id}`}
              className="inline-flex items-center text-[10px] font-semibold text-gray-500 hover:text-[#FF4D00] transition-colors"
            >
              Виж пълни характеристики
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </Link>
          </div>
        )}
      </div>
    </motion.div>
  );
};
