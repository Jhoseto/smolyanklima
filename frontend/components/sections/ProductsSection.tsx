import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Star, Zap, Snowflake, Repeat, Check, ChevronRight } from 'lucide-react';

// ─── Размери на картата ──────────────────────────────────────────────────────
const CARD_W = 252;  // px — ширина
const CARD_H = 572;  // px — фиксирана височина (всички карти равни)
const CARD_GAP = 20; // px — разстояние между картите

const products = [
  {
    id: 'daikin-perfera',
    brand: 'DAIKIN',
    model: 'Perfera FTXM25R',
    type: 'Стенен климатик',
    image: '/images/daikin-perfera.jpg',
    price: '659',
    priceWithMount: '812',
    rating: 4.9,
    reviews: 47,
    energyClass: 'A+++',
    badge: { text: 'Bestseller', bg: 'bg-yellow-100', textCol: 'text-yellow-700' },
    specs: [
      { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, text: '2.5 kW' },
      { icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />, text: 'Охл/Отопл' },
      { icon: <Repeat className="w-3.5 h-3.5 text-teal-500" />, text: 'Инвертор' },
    ],
    extras: ['Инвертор', 'WiFi управление', 'Нощен режим'],
    cardBorder: 'border-blue-200 shadow-blue-100/50',
    imgBg: 'bg-gray-50',
  },
  {
    id: 'mitsubishi-msz-ln25vgw',
    brand: 'MITSUBISHI',
    model: 'MSZ-LN35VG',
    type: 'Стенен климатик',
    image: '/images/mitsubishi-msz.jpg',
    price: '761',
    priceWithMount: '914',
    rating: 4.8,
    reviews: 31,
    energyClass: 'A+++',
    badge: { text: 'Premium', bg: 'bg-blue-100', textCol: 'text-blue-700' },
    specs: [
      { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, text: '3.5 kW' },
      { icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />, text: 'Охл/Отопл' },
      { icon: <Repeat className="w-3.5 h-3.5 text-teal-500" />, text: 'Инвертор' },
    ],
    extras: ['3D i-see сензор', 'Плазмен филтър', 'Супер тих'],
    cardBorder: 'border-gray-200',
    imgBg: 'bg-white',
  },
  {
    id: 'samsung-windfree',
    brand: 'SAMSUNG',
    model: 'WindFree Comfort',
    type: 'Стенен климатик',
    image: '/images/samsung-windfree.jpg',
    price: '500',
    priceWithMount: '653',
    rating: 4.7,
    reviews: 58,
    energyClass: 'A++',
    badge: { text: 'Топ оферта', bg: 'bg-green-100', textCol: 'text-green-700' },
    specs: [
      { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, text: '3.5 kW' },
      { icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />, text: 'Охл/Отопл' },
      { icon: <Repeat className="w-3.5 h-3.5 text-teal-500" />, text: 'Инвертор' },
    ],
    extras: ['WindFree™', 'AI Auto Cooling', 'SmartThings'],
    cardBorder: 'border-gray-200',
    imgBg: 'bg-gray-100',
  },
  {
    id: 'gree-fairy-12',
    brand: 'GREE',
    model: 'Fairy GWH12ACC',
    type: 'Стенен климатик',
    image: '/images/gree-fairy.jpg',
    price: '536',
    priceWithMount: '689',
    rating: 4.6,
    reviews: 82,
    energyClass: 'A++',
    badge: null,
    specs: [
      { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, text: '3.5 kW' },
      { icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />, text: 'Охл/Отопл' },
      { icon: <Repeat className="w-3.5 h-3.5 text-teal-500" />, text: 'Инвертор' },
    ],
    extras: ['Йонизатор', 'Самопочистване', 'WiFi управление'],
    cardBorder: 'border-gray-200',
    imgBg: 'bg-white',
  },
  {
    id: 'daikin-sensira-18',
    brand: 'DAIKIN',
    model: 'Sensira FTXF35D',
    type: 'Стенен климатик',
    image: '/images/daikin-sensira.jpg',
    price: '587',
    priceWithMount: '740',
    rating: 4.8,
    reviews: 124,
    energyClass: 'A++',
    badge: { text: 'Надежден', bg: 'bg-gray-100', textCol: 'text-gray-700' },
    specs: [
      { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, text: '3.3 kW' },
      { icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />, text: 'Охл/Отопл' },
      { icon: <Repeat className="w-3.5 h-3.5 text-teal-500" />, text: 'Инвертор' },
    ],
    extras: ['Тих режим 20dBA', 'Икономичен', 'Компактен'],
    cardBorder: 'border-gray-200',
    imgBg: 'bg-gray-50',
  },
  {
    id: 'fujitsu-asyg12kmtb',
    brand: 'FUJITSU',
    model: 'ASYG12KMTB',
    type: 'Стенен климатик',
    image: '/images/fujitsu-asyg.jpg',
    price: '709',
    priceWithMount: '862',
    rating: 4.7,
    reviews: 19,
    energyClass: 'A++',
    badge: null,
    specs: [
      { icon: <Zap className="w-3.5 h-3.5 text-yellow-500" />, text: '3.4 kW' },
      { icon: <Snowflake className="w-3.5 h-3.5 text-blue-500" />, text: 'Охл/Отопл' },
      { icon: <Repeat className="w-3.5 h-3.5 text-teal-500" />, text: 'Инвертор' },
    ],
    extras: ['Слим дизайн', 'Сензор за присъствие', 'Турбо режим'],
    cardBorder: 'border-gray-200',
    imgBg: 'bg-gray-50',
  },
] as const;

type Product = (typeof products)[number];

function ProductCard({ product }: { product: Product }) {
  return (
    <div
      className={`bg-white rounded-[1.75rem] overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300 border ${product.cardBorder} flex flex-col group shrink-0`}
      style={{ width: CARD_W, height: CARD_H }}
    >
      {/* Снимка — фиксирана */}
      <div className={`relative shrink-0 overflow-hidden ${product.imgBg ?? 'bg-gray-50'}`} style={{ height: 172 }}>
        <img
          src={product.image}
          alt={product.model}
          className="w-full h-full object-contain p-3 transition-transform duration-700 group-hover:scale-105"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start">
          {product.badge ? (
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${product.badge.bg} ${product.badge.textCol}`}>
              {product.badge.text}
            </span>
          ) : <div />}
          <span className="bg-green-500/90 text-white text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full">
            {product.energyClass}
          </span>
        </div>
      </div>

      {/* Съдържание — расте и запълва */}
      <div className="flex flex-col flex-1 min-h-0 p-4">
        {/* Марка + модел + тип */}
        <div className="mb-3">
          <p className="text-[10px] font-bold text-[#00B4D8] uppercase tracking-wider mb-0.5">{product.brand}</p>
          <Link to={`/product/${product.id}`} className="block group/title">
            <h3 className="text-base font-bold text-gray-900 leading-tight mb-0.5 group-hover/title:text-[#FF4D00] transition-colors line-clamp-1">
              {product.model}
            </h3>
          </Link>
          <p className="text-xs text-gray-400">{product.type}</p>
        </div>

        {/* Спецификации */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
          {product.specs.map((spec, i) => (
            <div key={i} className="flex items-center gap-1 text-[11px] font-medium text-gray-600">
              {spec.icon}
              {spec.text}
            </div>
          ))}
        </div>

        {/* Extras — 3 реда, всяка карта заема еднакво място */}
        <div className="flex flex-col gap-1 mb-3" style={{ minHeight: 72 }}>
          {product.extras.slice(0, 3).map((extra, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1 text-[10px] font-medium text-gray-600 w-fit">
              <Check className="w-2.5 h-2.5 text-green-500 shrink-0" strokeWidth={3} />
              <span className="truncate">{extra}</span>
            </div>
          ))}
        </div>

        {/* Рейтинг */}
        <div className="flex items-center gap-1 mb-3">
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(product.rating) ? 'fill-current' : 'fill-gray-200 text-gray-200'}`} />
            ))}
          </div>
          <span className="text-xs font-semibold text-gray-700 ml-0.5">{product.rating}</span>
          <span className="text-[10px] text-gray-400">({product.reviews})</span>
        </div>

        {/* Цена + CTA — прибити към дъното */}
        <div className="mt-auto pt-3 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2.5">
            <div>
              <span className="text-2xl font-extrabold text-gray-900">€{product.price}</span>
              <p className="text-[10px] text-gray-400 leading-tight">с монтаж €{product.priceWithMount}</p>
            </div>
          </div>
          <a
            href="#contact"
            className="flex items-center justify-center w-full py-2 rounded-full bg-[#EBF5FF] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white transition-colors text-xs font-bold shadow-sm"
          >
            Направи запитване
          </a>
          <div className="text-center mt-2">
            <Link to={`/product/${product.id}`} className="inline-flex items-center text-[10px] font-semibold text-gray-400 hover:text-[#FF4D00] transition-colors">
              Виж характеристики
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Основен компонент ────────────────────────────────────────────────────────
export const ProductsSection = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef    = useRef<HTMLDivElement>(null);
  const copyWidthRef = useRef(0);
  const rafRef       = useRef<number | null>(null);

  const draggingRef    = useRef(false);
  const dragMovedRef   = useRef(false);
  const lastPointerXRef = useRef(0);

  const [reduceMotion, setReduceMotion] = useState(false);

  // Ширината на един цикъл: N карти × (ширина + gap)
  // Flex gap важи МЕЖДУ всички siblings, т.е. card[i+1].x = card[i].x + CARD_W + CARD_GAP
  // => offset между copy A[0] и copy B[0] = products.length * (CARD_W + CARD_GAP)
  const measureCopy = useCallback(() => {
    copyWidthRef.current = products.length * (CARD_W + CARD_GAP);
  }, []);

  useLayoutEffect(() => { measureCopy(); }, [measureCopy]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    const fn = () => setReduceMotion(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(measureCopy);
    if (trackRef.current) ro.observe(trackRef.current);
    return () => ro.disconnect();
  }, [measureCopy]);

  // rAF автоматичен скрол
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const tick = () => {
      if (!draggingRef.current && !reduceMotion && document.visibilityState === 'visible') {
        const w = copyWidthRef.current;
        vp.scrollLeft += 0.5;
        if (w > 0 && vp.scrollLeft >= w) vp.scrollLeft -= w;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [reduceMotion]);

  // Wrap при ръчно плъзгане
  const wrapScroll = useCallback(() => {
    const vp = viewportRef.current;
    const w  = copyWidthRef.current;
    if (!vp || w <= 0) return;
    while (vp.scrollLeft >= w) vp.scrollLeft -= w;
    while (vp.scrollLeft < 0)  vp.scrollLeft += w;
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    draggingRef.current    = true;
    dragMovedRef.current   = false;
    lastPointerXRef.current = e.clientX;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const dx = e.clientX - lastPointerXRef.current;
    lastPointerXRef.current = e.clientX;
    if (Math.abs(dx) > 2) dragMovedRef.current = true;
    const vp = viewportRef.current;
    if (vp) { vp.scrollLeft -= dx; wrapScroll(); }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
    wrapScroll();
    setTimeout(() => { dragMovedRef.current = false; }, 80);
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (dragMovedRef.current) { e.preventDefault(); e.stopPropagation(); }
  };

  return (
    <section id="products" className="py-12 bg-gray-50">
      {/* Заглавие — центрирано */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <div className="text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="font-outfit text-[2.25rem] md:text-[3.25rem] leading-[1.1] tracking-tighter"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00B4D8] to-[#0077B6] font-extralight block">
              Топ
            </span>
            <span className="relative inline-block">
              <span className="absolute -inset-2 blur-xl bg-gradient-to-r from-[#FF4D00]/20 to-[#FF2A4D]/20 opacity-70" />
              <span className="relative text-transparent bg-clip-text bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] font-black uppercase drop-shadow-md">
                продукти
              </span>
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-sm md:text-base text-gray-700 font-medium mx-auto leading-relaxed whitespace-nowrap"
          >
            Внимателно подбрани модели с най-добро съотношение качество, ефективност и цена
          </motion.p>
        </div>

      </div>

      {/* ── Carousel ── */}
      <div className="px-6 sm:px-12 md:px-20 lg:px-28">
        {/* Viewport за скрол — mask-image прави fade от двете страни */}
        <div
          ref={viewportRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Топ продукти"
          className="overflow-x-auto overflow-y-visible cursor-grab active:cursor-grabbing select-none [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden touch-pan-x"
          style={{
            maskImage:
              'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onLostPointerCapture={onPointerUp}
          onClickCapture={onClickCapture}
        >
          {/* Лента — 4 копия на картите за безкраен скрол */}
          <div
            ref={trackRef}
            className="flex w-max items-start"
            style={{ gap: CARD_GAP }}
          >
            {products.map((p) => <ProductCard key={`a-${p.id}`} product={p} />)}
            {products.map((p) => <ProductCard key={`b-${p.id}`} product={p} aria-hidden={true as unknown as undefined} />)}
            {products.map((p) => <ProductCard key={`c-${p.id}`} product={p} aria-hidden={true as unknown as undefined} />)}
            {products.map((p) => <ProductCard key={`d-${p.id}`} product={p} aria-hidden={true as unknown as undefined} />)}
          </div>
        </div>
      </div>
    </section>
  );
};
