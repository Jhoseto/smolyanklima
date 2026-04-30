import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { PackageX } from 'lucide-react';

import { getAllAccessories } from '../data/accessoryService';
import type { CatalogProduct } from '../data/types/product';
import { ProductCard } from '../components/catalog/ProductCard';

export default function AccessoriesPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    const run = async () => {
      try {
        setLoading(true);
        setError(null);
        const all = await getAllAccessories();
        setItems(all);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Грешка при зареждане');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, []);

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans pt-20">
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-gray-900">Аксесоари и резервни части</h1>
          <p className="text-gray-500 font-medium mt-2">Филтри, модули и оригинални части за поддръжка на климатици.</p>
        </div>

        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-4 border-[#00B4D8]/20 border-t-[#00B4D8] animate-spin" />
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-gray-600 font-semibold mb-3">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-white font-bold rounded-full text-sm hover:shadow-lg hover:shadow-orange-500/30 hover:scale-105 transition-all"
            >
              Опитай отново
            </button>
          </div>
        ) : items.length === 0 ? (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="py-24 text-center">
            <div className="flex justify-center mb-6">
              <PackageX className="w-14 h-14 text-gray-300" />
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Няма налични аксесоари</h3>
            <p className="text-sm text-gray-500 mb-8">Добавете аксесоари/части от админ панела и те ще се появят тук.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {items.map((p, index) => (
              <ProductCard
                key={p.id}
                product={p}
                index={index}
                onQuickView={() => navigate(`/aksesoar/${p.id}`)}
                isFavorite={false}
                onFavoriteToggle={() => {}}
                onShare={() => {
                  const url = `${window.location.origin}/aksesoar/${p.id}`;
                  void navigator.clipboard?.writeText(url);
                }}
                viewMode="grid"
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

