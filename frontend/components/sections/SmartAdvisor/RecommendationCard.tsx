import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Star, Check, ChevronRight, Leaf, CheckCircle2 } from 'lucide-react';
import type { ResultTier } from './types';

interface RecommendationCardProps {
  tier: ResultTier;
  index: number;
  /** Whether the card is in selection mode (user provided contact info) */
  selectable?: boolean;
  /** Whether this card is currently selected */
  selected?: boolean;
  /** Toggle selection for this card */
  onToggleSelect?: () => void;
}

const TIER_STYLES = {
  highlighted: {
    banner: 'bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-white',
    card: 'border-[#FF4D00]/25 shadow-xl shadow-orange-100/70 ring-1 ring-[#FF4D00]/10',
    cta: 'bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-white hover:shadow-lg hover:shadow-orange-400/30 hover:scale-[1.02]',
  },
  normal: {
    banner: 'bg-gray-50 border-b border-gray-100 text-gray-500',
    card: 'border-gray-100 shadow-sm',
    cta: 'bg-[#EBF5FF] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white',
  },
};

export const RecommendationCard: React.FC<RecommendationCardProps> = ({
  tier, index, selectable = false, selected = false, onToggleSelect,
}) => {
  const [imgError, setImgError] = useState(false);
  const { tierLabel, tierBadge, highlighted, scored } = tier;
  const { product, matchReasons, installCost, annualSavings } = scored;
  const styles = highlighted ? TIER_STYLES.highlighted : TIER_STYLES.normal;

  // When selected, override card border with a green selection ring
  const selectionRing = selected
    ? 'ring-2 ring-emerald-500 border-emerald-200 shadow-lg shadow-emerald-100/60'
    : selectable
      ? 'hover:ring-1 hover:ring-emerald-300 cursor-pointer'
      : '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      onClick={selectable ? onToggleSelect : undefined}
      className={`bg-white rounded-[1.5rem] overflow-hidden border flex flex-col group relative transition-all duration-300 ${styles.card} ${selectionRing}`}
    >
      {/* ── Tier banner ── */}
      <div className={`flex items-center gap-2 px-4 py-2 ${selected ? 'bg-emerald-500 text-white' : styles.banner}`}>
        <span className="text-sm">{tierBadge}</span>
        <span className="text-[11px] font-bold uppercase tracking-widest">
          {tierLabel} избор
        </span>
        {selected ? (
          <CheckCircle2 className="ml-auto w-4 h-4 text-white" strokeWidth={2} />
        ) : highlighted ? (
          <span className="ml-auto text-[9px] font-bold bg-white/25 px-2 py-0.5 rounded-full tracking-wide">
            НАЙ-ДОБЪР
          </span>
        ) : null}
      </div>

      {/* ── Image area — identical to ProductCard ── */}
      <div className={`relative h-40 w-full overflow-hidden cursor-pointer ${product.imgBg ?? 'bg-gray-50'}`}>
        <img
          src={imgError ? '/images/hero-ac.jpg' : product.image}
          alt={product.name}
          onError={() => setImgError(true)}
          className="w-full h-full object-contain p-3 transition-transform duration-700 group-hover:scale-105"
        />
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-80" />

        {/* Product badge top-left */}
        {product.badge && (
          <div className="absolute top-3 left-3">
            <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold shadow-sm ${product.badge.bg} ${product.badge.textCol}`}>
              {product.badge.text}
            </span>
          </div>
        )}

        {/* Energy class top-right */}
        {product.energyClass && (
          <span className="absolute top-3 right-3 bg-green-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-md">
            {product.energyClass}
          </span>
        )}
      </div>

      {/* ── Content area — identical structure to ProductCard ── */}
      <div className="flex flex-col flex-1 p-4">

        {/* Brand + name + type */}
        <div className="mb-3">
          <p className="text-[10px] font-bold text-[#00B4D8] uppercase tracking-wider mb-0.5">
            {product.brand}
          </p>
          <h3 className="text-[0.95rem] font-bold text-gray-900 leading-tight mb-0.5 line-clamp-2">
            {product.name}
          </h3>
          <p className="text-[10px] text-gray-500">{product.type}</p>
        </div>

        {/* Specs — emoji + text, same as ProductCard */}
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

        {/* Extras chips — same as ProductCard */}
        {product.extras.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {product.extras.slice(0, 3).map((extra, i) => (
              <div key={i} className="flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-0.5 text-[10px] font-medium text-gray-700">
                <Check className="w-2.5 h-2.5 text-green-500 shrink-0" strokeWidth={3} />
                {extra}
              </div>
            ))}
          </div>
        )}

        {/* Match reasons — advisor-specific */}
        {matchReasons.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {matchReasons.map((reason, i) => (
              <div key={i} className="flex items-center gap-1 bg-[#EBF5FF] border border-[#00B4D8]/10 rounded-full px-2.5 py-0.5 text-[10px] font-medium text-[#0077B6]">
                <Check className="w-2.5 h-2.5 text-[#00B4D8] shrink-0" strokeWidth={3} />
                {reason}
              </div>
            ))}
          </div>
        )}

        {/* Savings badge */}
        {annualSavings > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 w-fit mb-3">
            <Leaf className="w-3 h-3 text-emerald-600 shrink-0" strokeWidth={1.75} />
            <span className="text-[10px] font-semibold text-emerald-700">
              ~€{annualSavings}/год по-евтино от А клас
            </span>
          </div>
        )}

        {/* Stars — same as ProductCard */}
        <div className="flex flex-col gap-0.5 mb-3">
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
        </div>

        {/* Price — right-aligned, same as ProductCard */}
        <div className="flex items-end justify-between mt-auto pt-3 border-t border-gray-100">
          <div>
            <div className="flex items-baseline gap-0.5">
              <span className="text-2xl font-extrabold text-gray-900">€{product.price.toLocaleString()}</span>
            </div>
            <p className="text-[9px] text-gray-500">
              с монтаж ~€{(product.price + installCost).toLocaleString()}
            </p>
          </div>

          {/* Actions column */}
          <div className="flex flex-col gap-1.5 items-end">
            {selectable ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleSelect?.(); }}
                className={[
                  'flex items-center justify-center gap-1.5 transition-all duration-200 px-4 py-2 rounded-full font-bold text-[11px] shadow-sm',
                  selected
                    ? 'bg-emerald-500 text-white shadow-emerald-200 hover:bg-emerald-600'
                    : 'bg-[#EBF5FF] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white',
                ].join(' ')}
              >
                {selected ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} /> Избрано</>
                ) : (
                  'Избери'
                )}
              </button>
            ) : (
              <a
                href="#contact"
                className="flex items-center justify-center gap-1.5 bg-[#EBF5FF] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white transition-all duration-200 px-4 py-2 rounded-full font-bold text-[11px] shadow-sm hover:shadow-md"
              >
                Запитване
              </a>
            )}
          </div>
        </div>

        {/* "Виж пълни характеристики" — same as ProductCard bottom link */}
        <div className="text-center pt-3 border-t border-gray-100 mt-3">
          <Link
            to={`/product/${product.id}`}
            className="inline-flex items-center text-[10px] font-semibold text-gray-500 hover:text-[#FF4D00] transition-colors"
          >
            Виж пълни характеристики
            <ChevronRight className="w-3 h-3 ml-0.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
};
