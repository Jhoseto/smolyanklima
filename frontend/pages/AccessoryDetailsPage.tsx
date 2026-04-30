import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Phone } from 'lucide-react';

import { getAccessoryById, getAllAccessories } from '../data/accessoryService';
import type { CatalogProduct } from '../data/types/product';
import { ProductCard } from '../components/catalog/ProductCard';

export default function AccessoryDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [item, setItem] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<CatalogProduct[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const run = async () => {
      setLoading(true);
      const found = id ? await getAccessoryById(id) : undefined;
      if (found) {
        setItem(found);
        const all = await getAllAccessories();
        setRelated(all.filter((x) => x.id !== found.id).slice(0, 3));
      }
      setLoading(false);
    };
    void run();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col pt-20">
        <div className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-12 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#00B4D8]/20 border-t-[#00B4D8] animate-spin" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col pt-20">
        <div className="flex-1 flex flex-col items-center justify-center">
          <h1 className="text-3xl font-black text-gray-900 mb-4">Аксесоарът не е намерен</h1>
          <button onClick={() => navigate('/catalog?tab=accessories')} className="text-[#00B4D8] hover:underline font-bold">
            ← Обратно към аксесоарите
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans pt-20">
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <button
          onClick={() => navigate('/catalog?tab=accessories')}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Обратно към аксесоарите
        </button>

        <div className="flex flex-col lg:flex-row gap-10 xl:gap-16 mb-14">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="w-full lg:w-1/2">
            <div className="relative aspect-square bg-gray-50 rounded-[2.5rem] p-8 flex items-center justify-center border border-gray-100 shadow-sm">
              {item.badge && (
                <span className={`absolute top-6 left-6 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm ${item.badge.bg} ${item.badge.textCol}`}>
                  {item.badge.text}
                </span>
              )}
              <img
                src={item.image}
                alt={item.name}
                className="w-full h-full object-contain mix-blend-multiply hover:scale-105 transition-transform duration-500"
              />
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="w-full lg:w-1/2 flex flex-col justify-center">
            <p className="text-sm font-black text-[#00B4D8] uppercase tracking-wider mb-2">{item.brand}</p>
            <h1 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight mb-2">{item.name}</h1>
            <p className="text-gray-500 font-medium mb-5">{item.type}</p>

            {item.description && <p className="text-gray-600 leading-relaxed mb-8">{item.description}</p>}

            <div className="border border-gray-200 rounded-3xl p-6 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-gray-900">€{item.price.toLocaleString()}</span>
                  <span className="text-sm font-semibold text-gray-500">цена</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="#contact"
                  className="flex-1 bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] hover:shadow-lg hover:shadow-orange-500/30 hover:scale-[1.02] transition-all text-white font-bold py-3.5 px-6 rounded-xl flex justify-center items-center gap-2"
                >
                  Поискайте оферта →
                </a>
                <a
                  href="tel:+359888585816"
                  className="flex-1 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-gray-800 font-bold py-3.5 px-6 rounded-xl flex justify-center items-center gap-2"
                >
                  <Phone className="w-4 h-4 text-[#00B4D8]" /> Обадете се
                </a>
              </div>
            </div>
          </motion.div>
        </div>

        {related.length > 0 && (
          <>
            <hr className="border-gray-100 my-12" />
            <h2 className="text-2xl font-black text-gray-900 mb-6">Още аксесоари</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {related.map((p, index) => (
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
          </>
        )}
      </main>
    </div>
  );
}

