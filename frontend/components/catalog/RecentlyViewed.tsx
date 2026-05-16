import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock } from 'lucide-react';
import type { CatalogProduct } from '../../data/types/product';
import { getProductById } from '../../data/productService';

const STORAGE_KEY = 'sk_recently_viewed';

export function useRecentlyViewed() {
  const [viewedIds, setViewedIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      setViewedIds(stored);
    } catch {
      setViewedIds([]);
    }
  }, []);

  const addViewed = (id: string) => {
    setViewedIds(prev => {
      const filtered = prev.filter(v => v !== id);
      const next = [id, ...filtered].slice(0, 4); // Keep last 4
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const pruneViewedIds = useCallback((validIds: string[]) => {
    setViewedIds(validIds);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validIds));
    } catch {
      /* ignore */
    }
  }, []);

  return { viewedIds, addViewed, pruneViewedIds };
}

export const RecentlyViewed = ({
  viewedIds,
  onQuickView,
  onPruneViewedIds,
}: {
  viewedIds: string[];
  onQuickView: (p: CatalogProduct) => void;
  onPruneViewedIds?: (validIds: string[]) => void;
}) => {
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  useEffect(() => {
    if (viewedIds.length === 0) {
      setProducts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const loaded = await Promise.all(viewedIds.map((id) => getProductById(id)));
      if (cancelled) return;
      const valid = loaded.filter(Boolean) as CatalogProduct[];
      const validIds = valid.map((p) => p.id);
      if (validIds.length !== viewedIds.length) {
        onPruneViewedIds?.(validIds);
      }
      setProducts(valid);
    })().catch(() => {
      if (!cancelled) setProducts([]);
    });
    return () => {
      cancelled = true;
    };
  }, [viewedIds]);

  if (viewedIds.length === 0) return null;
  if (products.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm mb-8"
    >
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-[#FF4D00]" />
        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-tight">Наскоро разгледани</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.map(p => (
          <div 
            key={p.id} 
            onClick={() => onQuickView(p)}
            className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group border border-transparent hover:border-gray-100"
          >
            <div className="w-12 h-12 rounded-lg bg-gray-50 p-1 shrink-0 group-hover:scale-105 transition-transform">
              <img src={p.image} alt={p.model} className="w-full h-full object-contain mix-blend-multiply" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] text-[#00B4D8] font-bold truncate">{p.brand}</p>
              <p className="text-xs font-semibold text-gray-900 truncate">{p.model}</p>
              <p className="text-xs font-bold text-gray-500 mt-0.5">€{p.price}</p>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
};
