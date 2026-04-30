import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Star, Check, Wifi, ShieldCheck, Zap, Volume2, Wind, ChevronDown } from 'lucide-react';
import type { CatalogProduct } from '../../data/types/product';
import { PremiumImageGallery } from '../media/PremiumImageGallery';

// Мини-Accordion за price breakdown
const Accordion = ({ title, children, defaultOpen = false }: { title: string, children: React.ReactNode, defaultOpen?: boolean }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-bold text-[#00B4D8] hover:text-[#0090ad] transition-colors mb-2">
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        {title}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface QuickViewModalProps {
  product: CatalogProduct | null;
  onClose: () => void;
  isFavorite: boolean;
  onFavoriteToggle: (id: string) => void;
  onFormSubmit: (
    productName: string,
    name: string,
    phone: string,
    meta?: { website?: string; productSlug?: string },
  ) => void;
}

export const QuickViewModal = ({
  product,
  onClose,
  isFavorite,
  onFavoriteToggle,
  onFormSubmit,
}: QuickViewModalProps) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !name.trim() || !phone.trim()) return;
    onFormSubmit(product.name, name.trim(), phone.trim(), { website, productSlug: product.id });
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setName('');
      setPhone('');
      setWebsite('');
    }, 3000);
  };

  return (
    <AnimatePresence>
      {product && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[500]"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed inset-4 md:inset-8 lg:inset-auto lg:top-1/2 lg:left-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:w-[900px] lg:max-h-[90vh] bg-white rounded-3xl shadow-2xl z-[501] overflow-hidden flex flex-col"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-9 h-9 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>

            <div className="flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden flex-1">

              {/* LEFT – Image */}
              <div className="lg:w-[420px] shrink-0 bg-gray-50 flex items-center justify-center p-8 relative border-r border-gray-100">
                <PremiumImageGallery
                  className="w-full"
                  images={(product.images?.length ? product.images : [product.image]).filter(Boolean)}
                  alt={product.name}
                  badgeText={product.badge?.text}
                  badgeClassName={
                    product.badge
                      ? `absolute top-6 left-6 px-3 py-1 rounded-full text-xs font-black shadow-sm ${product.badge.bg} ${product.badge.textCol}`
                      : undefined
                  }
                  energyClass={product.energyClass}
                />
              </div>

              {/* RIGHT – Details + Form */}
              <div className="flex-1 p-6 lg:p-8 overflow-y-auto">

                {/* Brand + Model */}
                <p className="text-xs font-bold text-[#00B4D8] uppercase tracking-wider mb-1">{product.brand}</p>
                <h2 className="text-2xl font-black text-gray-900 mb-1 leading-tight">{product.name}</h2>
                <p className="text-sm text-gray-500 mb-4">{product.type} · {product.area}</p>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < Math.floor(product.rating) ? 'fill-current' : 'fill-gray-200 text-gray-200'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{product.rating}</span>
                  <span className="text-sm text-gray-500">({product.reviews} отзива)</span>
                </div>

                {/* Description */}
                {product.description && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-5">{product.description}</p>
                )}

                {/* Tech specs table */}
                <div className="bg-gray-50 rounded-2xl p-4 mb-5">
                  <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider mb-3">Технически характеристики</h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2.5">
                    {product.coolingPower && (
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-500 shrink-0" />
                        <span className="text-xs text-gray-500">Охлаждане</span>
                        <span className="text-xs font-bold text-gray-800 ml-auto">{product.coolingPower}</span>
                      </div>
                    )}
                    {product.heatingPower && (
                      <div className="flex items-center gap-2">
                        <Wind className="w-4 h-4 text-orange-500 shrink-0" />
                        <span className="text-xs text-gray-500">Отопление</span>
                        <span className="text-xs font-bold text-gray-800 ml-auto">{product.heatingPower}</span>
                      </div>
                    )}
                    {product.noise && (
                      <div className="flex items-center gap-2">
                        <Volume2 className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="text-xs text-gray-500">Шум</span>
                        <span className="text-xs font-bold text-gray-800 ml-auto">{product.noise}</span>
                      </div>
                    )}
                    {product.refrigerant && (
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-teal-500 shrink-0" />
                        <span className="text-xs text-gray-500">Хладагент</span>
                        <span className="text-xs font-bold text-gray-800 ml-auto">{product.refrigerant}</span>
                      </div>
                    )}
                    {product.warranty && (
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-green-500 shrink-0" />
                        <span className="text-xs text-gray-500">Гаранция</span>
                        <span className="text-xs font-bold text-gray-800 ml-auto">{product.warranty}</span>
                      </div>
                    )}
                    {product.wifi !== undefined && (
                      <div className="flex items-center gap-2">
                        <Wifi className={`w-4 h-4 shrink-0 ${product.wifi ? 'text-[#00B4D8]' : 'text-gray-300'}`} />
                        <span className="text-xs text-gray-500">WiFi</span>
                        <span className="text-xs font-bold text-gray-800 ml-auto">{product.wifi ? 'Вграден' : 'Без WiFi'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Feature chips */}
                <div className="flex flex-wrap gap-2 mb-5">
                  {product.features.map((f, i) => (
                    <span key={i} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1 text-xs font-medium text-gray-700">
                      <Check className="w-3 h-3 text-green-500" strokeWidth={3} />
                      {f}
                    </span>
                  ))}
                </div>

                {/* Price Breakdown + Availability */}
                <div className="bg-gray-50 rounded-2xl p-5 mb-6 border border-gray-100">
                  <div className="flex items-baseline gap-3 mb-4">
                    <span className="text-4xl font-extrabold text-gray-900">€{product.price.toLocaleString()}</span>
                  </div>

                  <Accordion title="Какво включва цената с монтаж?" defaultOpen={false}>
                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                      <div className="flex justify-between"><span>Цена на уреда:</span> <strong>€{product.price.toLocaleString()}</strong></div>
                      <div className="flex justify-between"><span>Стандартен монтаж:</span> <strong>€{(product.priceWithMount - product.price).toLocaleString()}</strong></div>
                      <div className="flex justify-between"><span>Официална гаранция:</span> <strong className="text-green-600">€0 (Включена)</strong></div>
                      <div className="flex justify-between pt-2 border-t border-gray-200 text-base"><span>Общо с монтаж:</span> <strong className="text-gray-900">€{product.priceWithMount.toLocaleString()}</strong></div>
                    </div>
                  </Accordion>

                  <div className="space-y-3 mt-4 border-t border-gray-200 pt-4">
                    <h4 className="text-xs font-bold text-gray-500 uppercase">Наличност и Доставка</h4>
                    <div className="flex items-start gap-3">
                      <div className="relative mt-1">
                        <div className="w-2.5 h-2.5 bg-green-500 rounded-full"></div>
                        <div className="absolute inset-0 bg-green-500 rounded-full animate-ping"></div>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">В наличност</p>
                        <p className="text-xs text-gray-500">Доставка и монтаж до 48 часа за област Смолян.</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── INQUIRY FORM ────────────────────── */}
                <div className="bg-gradient-to-br from-[#F0F9FF] to-[#E8F4FD] rounded-2xl p-5 border border-[#00B4D8]/10">
                  <h3 className="text-sm font-black text-gray-800 mb-4">
                    📋 Направи запитване за{' '}
                    <span className="text-[#00B4D8]">{product.name}</span>
                  </h3>

                  {submitted ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-3 py-4"
                    >
                      <span className="text-3xl">✅</span>
                      <div>
                        <p className="font-bold text-green-700">Изпратено успешно!</p>
                        <p className="text-xs text-gray-600">Ще ви се обадим скоро.</p>
                      </div>
                    </motion.div>
                  ) : (
                    <form onSubmit={handleSubmit} className="relative space-y-3">
                      <div className="absolute -left-[9999px] h-px w-px overflow-hidden" aria-hidden>
                        <label htmlFor="qv-website">Website</label>
                        <input
                          id="qv-website"
                          tabIndex={-1}
                          autoComplete="off"
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Вашето Име"
                          value={name}
                          onChange={e => setName(e.target.value)}
                          required
                          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] transition-all"
                        />
                        <input
                          type="tel"
                          placeholder="Телефон"
                          value={phone}
                          onChange={e => setPhone(e.target.value)}
                          required
                          className="px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00B4D8]/30 focus:border-[#00B4D8] transition-all"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-3 bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-white font-bold rounded-xl hover:shadow-lg hover:shadow-orange-500/30 hover:scale-[1.02] transition-all text-sm"
                      >
                        Изпрати запитване →
                      </button>
                    </form>
                  )}
                </div>

              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
