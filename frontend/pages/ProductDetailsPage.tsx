import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Star, Phone, ShieldCheck, Clock, Check, Zap, Volume2, Wind } from 'lucide-react';
import { getAllProducts, getProductById } from '../data/productService';
import type { CatalogProduct } from '../data/types/product';
import { ProductCard } from '../components/catalog/ProductCard';
import { PremiumImageGallery } from '../components/media/PremiumImageGallery';

export default function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<CatalogProduct[]>([]);

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);

    const fetchProduct = async () => {
      setLoading(true);
      // Реално зареждане от backend (база)
      const found = id ? await getProductById(id) : undefined;
      
      if (found) {
        setProduct(found);
        // Взимаме 3 подобни продукта от същия тип (различни от текущия)
        const allProducts = await getAllProducts();
        const relatedProds = allProducts
          .filter(p => p.type === found.type && p.id !== found.id)
          .slice(0, 3);
        setRelated(relatedProds);
      }
      setLoading(false);
    };

    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col">
        <div className="flex-1 max-w-[1200px] w-full mx-auto px-4 py-12 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-4 border-[#00B4D8]/20 border-t-[#00B4D8] animate-spin" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex flex-col pt-20">
        <div className="flex-1 flex flex-col items-center justify-center">
          <h1 className="text-3xl font-black text-gray-900 mb-4">Продуктът не е намерен</h1>
          <button onClick={() => navigate('/catalog')} className="text-[#00B4D8] hover:underline font-bold">
            ← Обратно към каталога
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans pt-20">
      
      <main className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Back Button */}
        <button 
          onClick={() => navigate('/catalog')}
          className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-900 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" /> Обратно към продуктите
        </button>

        {/* ── TOP SECTION: Image + Info ── */}
        <div className="flex flex-col lg:flex-row gap-10 xl:gap-16 mb-16">
          {/* Left: Image */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full lg:w-1/2"
          >
            <PremiumImageGallery
              images={(product.images?.length ? product.images : [product.image]).filter(Boolean)}
              alt={product.name}
              badgeText={product.badge?.text}
              badgeClassName={
                product.badge
                  ? `absolute top-6 left-6 px-4 py-1.5 rounded-full text-xs font-black shadow-sm ${product.badge.bg} ${product.badge.textCol}`
                  : undefined
              }
              energyClass={product.energyClass}
            />
          </motion.div>

          {/* Right: Info */}
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full lg:w-1/2 flex flex-col justify-center"
          >
            <p className="text-sm font-black text-[#00B4D8] uppercase tracking-wider mb-2">{product.brand}</p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 leading-tight mb-2">
              {product.name}
            </h1>
            <p className="text-gray-500 font-medium mb-4">{product.type} · {product.area}</p>

            <div className="flex items-center gap-2 mb-6">
              <div className="flex text-yellow-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'fill-current' : 'fill-gray-200 text-gray-200'}`} />
                ))}
              </div>
              <span className="text-sm font-bold text-gray-700">{product.rating}</span>
              <span className="text-sm text-gray-400">({product.reviews} отзива)</span>
            </div>

            {product.description && (
              <p className="text-gray-600 leading-relaxed mb-6">{product.description}</p>
            )}

            {/* Quick Specs Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {product.coolingPower && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 text-yellow-800 rounded-lg text-xs font-bold">
                  <Zap className="w-3.5 h-3.5 text-yellow-500" /> {product.coolingPower}
                </div>
              )}
              {product.heatingPower && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-800 rounded-lg text-xs font-bold">
                  <Wind className="w-3.5 h-3.5 text-orange-500" /> {product.heatingPower}
                </div>
              )}
              {product.noise && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-800 rounded-lg text-xs font-bold">
                  <Volume2 className="w-3.5 h-3.5 text-blue-500" /> {product.noise}
                </div>
              )}
            </div>

            {/* Feature Chips */}
            <div className="flex flex-wrap gap-2 mb-8">
              {product.features.map((f, i) => (
                <span key={i} className="flex items-center gap-1.5 bg-orange-50/50 border border-orange-100 text-orange-800 rounded-full px-3 py-1 text-xs font-semibold">
                  <Check className="w-3 h-3 text-[#FF4D00]" strokeWidth={3} />
                  {f}
                </span>
              ))}
            </div>

            {/* Pricing Box */}
            <div className="border border-gray-200 rounded-3xl p-6 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-black text-gray-900">€{product.price.toLocaleString()}</span>
                  <span className="text-sm font-semibold text-gray-500">само уред</span>
                </div>
                <div className="text-sm font-bold text-gray-800 mt-1">
                  С монтаж от <span className="text-[#FF4D00]">€{product.priceWithMount.toLocaleString()}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button className="flex-1 bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] hover:shadow-lg hover:shadow-orange-500/30 hover:scale-[1.02] transition-all text-white font-bold py-3.5 px-6 rounded-xl flex justify-center items-center gap-2">
                  Поискайте оферта →
                </button>
                <a href="tel:+359888888888" className="flex-1 bg-white border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all text-gray-800 font-bold py-3.5 px-6 rounded-xl flex justify-center items-center gap-2">
                  <Phone className="w-4 h-4 text-[#00B4D8]" /> Обадете се
                </a>
              </div>
            </div>

            {/* Guarantees */}
            <div className="flex gap-6 mt-6 ml-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                <ShieldCheck className="w-4 h-4 text-green-500" /> Гаранция на монтажа
              </div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                <Clock className="w-4 h-4 text-orange-500" /> Монтаж до 48ч
              </div>
            </div>
          </motion.div>
        </div>

        <hr className="border-gray-100 my-12" />

        {/* ── MIDDLE SECTION: Tech Specs ── */}
        <div className="max-w-3xl mb-16">
          <h2 className="text-2xl font-black text-gray-900 mb-8">Технически характеристики</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Охладителна мощност</span>
              <span className="font-bold text-gray-900">{product.coolingPower || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Отоплителна мощност</span>
              <span className="font-bold text-gray-900">{product.heatingPower || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Енергиен клас охл.</span>
              <span className="font-bold text-gray-900">{product.energyCool || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Енергиен клас отопл.</span>
              <span className="font-bold text-gray-900">{product.energyHeat || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Шум (вътрешен блок)</span>
              <span className="font-bold text-gray-900">{product.noise || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Площ помещение</span>
              <span className="font-bold text-gray-900">{product.area || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Хладилен агент</span>
              <span className="font-bold text-gray-900">{product.refrigerant || '-'}</span>
            </div>
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="text-gray-500 font-medium">Вграден WiFi</span>
              <span className="font-bold text-gray-900">{product.wifi ? 'Да' : 'Не'}</span>
            </div>
          </div>
        </div>

        {/* ── INCLUDED IN BOX ── */}
        <div className="mb-16">
          <h2 className="text-2xl font-black text-gray-900 mb-6">Включено в комплекта</h2>
          <div className="flex flex-wrap gap-3">
            {(isAccessoryLike(product) ? buildIncludedForAccessory(product) : buildIncludedForAc(product)).map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold border ${
                  item.included ? "bg-green-50 border-green-100 text-green-800" : "bg-gray-50 border-gray-200 text-gray-500"
                }`}
              >
                <Check className={`w-4 h-4 ${item.included ? "text-green-500" : "text-gray-300"}`} strokeWidth={3} /> {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── RELATED PRODUCTS ── */}
        {related.length > 0 && (
          <div>
            <h2 className="text-2xl font-black text-gray-900 mb-6">Подобни продукти</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {related.map((prod, i) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  index={i}
                  onQuickView={(p) => navigate(`/product/${p.id}`)}
                  isFavorite={false} // Може да се закачи към global state
                  onFavoriteToggle={() => {}} 
                  onShare={() => {}}
                />
              ))}
            </div>
          </div>
        )}

      </main>

    </div>
  );
}

function isAccessoryLike(p: CatalogProduct) {
  const t = (p.type ?? "").toLowerCase();
  const n = (p.name ?? "").toLowerCase();
  return (
    t.includes("аксес") ||
    t.includes("резерв") ||
    n.includes("филтър") ||
    n.includes("filter") ||
    n.includes("помпа") ||
    n.includes("drain")
  );
}

function buildIncludedForAc(p: CatalogProduct): Array<{ label: string; included: boolean }> {
  return [
    { label: "Вътрешен блок (рамка)", included: true },
    { label: "Външен блок", included: true },
    { label: "Дистанционно", included: true },
    { label: `Гаранция: ${p.warranty || "3 г. гаранция"}`, included: true },
  ];
}

function buildIncludedForAccessory(p: CatalogProduct): Array<{ label: string; included: boolean }> {
  // За аксесоари не показваме подвеждащо "външен/вътрешен блок".
  const hasWarranty = Boolean(p.warranty);
  return [
    { label: "Самият аксесоар", included: true },
    { label: "Инструкция/описание", included: true },
    { label: hasWarranty ? `Гаранция: ${p.warranty}` : "Гаранция", included: hasWarranty },
  ];
}
