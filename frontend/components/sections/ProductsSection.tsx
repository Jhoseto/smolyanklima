import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { Star, Zap, Snowflake, Repeat, Wifi, ChevronRight, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// Зарежда секцията „Топ продукти“ от backend-а (endpoint:
// /api/featured-products). Админът подрежда до 6 продукта в схема 3×2
// и им задава визуален „badge“ от затворения списък по-долу.

type FeaturedBadge =
  | 'bestseller'
  | 'top_offer'
  | 'promo'
  | 'top_searched'
  | 'premium'
  | 'best_value';

type FeaturedProduct = {
  id: string;
  slug: string;
  name: string;
  price: number | null;
  priceWithMount: number | null;
  position: number; // 1..6
  badge: FeaturedBadge | null;
  rating: number | null;
  reviewCount: number;
  brand: { id?: string; slug?: string; name?: string } | null;
  type: { id?: string; name?: string } | null;
  image: string;
  specs: {
    coolingKw: number | null;
    heatingKw: number | null;
    powerKw: number | null;
    energyClass: string | null;
    wifi: boolean | null;
    noiseDb: number | null;
  };
};

const BADGE_META: Record<FeaturedBadge, { label: string; bg: string; text: string }> = {
  bestseller:   { label: 'Bestseller',   bg: 'bg-yellow-100',  text: 'text-yellow-700'  },
  top_offer:    { label: 'Топ оферта',   bg: 'bg-emerald-100', text: 'text-emerald-700' },
  promo:        { label: 'Промоция',     bg: 'bg-rose-100',    text: 'text-rose-700'    },
  top_searched: { label: 'Най-търсен',   bg: 'bg-blue-100',    text: 'text-blue-700'    },
  premium:      { label: 'Премиум',      bg: 'bg-indigo-100',  text: 'text-indigo-700'  },
  best_value:   { label: 'Най-изгоден',  bg: 'bg-teal-100',    text: 'text-teal-700'    },
};

function fmtKw(n: number | null): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '';
  return `${n.toFixed(1).replace(/\.0$/, '')} kW`;
}

function fmtPrice(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return Math.round(n).toString();
}

function ProductCard({ product, index }: { product: FeaturedProduct; index: number }) {
  const badge = product.badge ? BADGE_META[product.badge] : null;
  const power = fmtKw(product.specs.powerKw);
  const brand = (product.brand?.name ?? '').toUpperCase();
  const typeLabel = product.type?.name ?? 'Климатик';
  const rating = product.rating ?? 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.07 }}
      className="bg-white rounded-[1.75rem] overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300 border border-gray-200 flex flex-col group"
    >
      {/* Снимка */}
      <div className="relative shrink-0 overflow-hidden bg-gray-50" style={{ height: 110 }}>
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-contain p-2 transition-transform duration-700 group-hover:scale-105"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">няма снимка</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start">
          {badge ? (
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          ) : <div />}
          {product.specs.energyClass && (
            <span className="bg-green-500/90 text-white text-[9px] font-black tracking-wider px-2 py-0.5 rounded-full">
              {product.specs.energyClass}
            </span>
          )}
        </div>
      </div>

      {/* Съдържание */}
      <div className="flex flex-col flex-1 min-h-0 p-3">
        <div className="mb-2">
          <p className="text-[10px] font-bold text-[#00B4D8] uppercase tracking-wider mb-0.5">{brand || '—'}</p>
          <Link to={`/product/${product.slug}`} className="block group/title">
            <h3 className="text-sm font-bold text-gray-900 leading-tight mb-0.5 group-hover/title:text-[#FF4D00] transition-colors line-clamp-1">
              {product.name}
            </h3>
          </Link>
          <p className="text-[10px] text-gray-400">{typeLabel}</p>
        </div>

        {/* Спецификации */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mb-2">
          {power && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-gray-600">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              {power}
            </div>
          )}
          <div className="flex items-center gap-1 text-[11px] font-medium text-gray-600">
            <Snowflake className="w-3.5 h-3.5 text-blue-500" />
            Охл/Отопл
          </div>
          <div className="flex items-center gap-1 text-[11px] font-medium text-gray-600">
            <Repeat className="w-3.5 h-3.5 text-teal-500" />
            Инвертор
          </div>
          {product.specs.wifi && (
            <div className="flex items-center gap-1 text-[11px] font-medium text-gray-600">
              <Wifi className="w-3.5 h-3.5 text-sky-500" />
              Wi-Fi
            </div>
          )}
        </div>

        {/* Рейтинг */}
        <div className="flex items-center gap-1 mb-2">
          <div className="flex text-yellow-400">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className={`w-3 h-3 ${i < Math.floor(rating) ? 'fill-current' : 'fill-gray-200 text-gray-200'}`} />
            ))}
          </div>
          {rating > 0 && (
            <>
              <span className="text-xs font-semibold text-gray-700 ml-0.5">{rating.toFixed(1)}</span>
              <span className="text-[10px] text-gray-400">({product.reviewCount})</span>
            </>
          )}
        </div>

        {/* Цена + CTA */}
        <div className="mt-auto pt-2 border-t border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div>
              <span className="text-xl font-extrabold text-gray-900">€{fmtPrice(product.price)}</span>
              {product.priceWithMount != null && (
                <p className="text-[10px] text-gray-400 leading-tight">с монтаж €{fmtPrice(product.priceWithMount)}</p>
              )}
            </div>
          </div>
          <a
            href="#contact"
            className="flex items-center justify-center w-full py-1.5 rounded-full bg-[#EBF5FF] text-[#00B4D8] hover:bg-[#00B4D8] hover:text-white transition-colors text-xs font-bold shadow-sm"
          >
            Направи запитване
          </a>
          <div className="text-center mt-1.5">
            <Link to={`/product/${product.slug}`} className="inline-flex items-center text-[10px] font-semibold text-gray-400 hover:text-[#FF4D00] transition-colors">
              Виж характеристики
              <ChevronRight className="w-3 h-3 ml-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export const ProductsSection = () => {
  const [items, setItems] = useState<FeaturedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [debug, setDebug] = useState<{
    httpStatus?: number;
    error?: string;
    raw?: unknown;
  } | null>(null);

  // Debug режим: ?debug=top в URL-а активира visible диагностичен панел.
  // Полезно, когато админът току-що е назначил продукти, а секцията не се
  // показва — обикновено това се дължи на липсваща миграция 0035 или на
  // продукти с out_of_stock/is_active=false.
  const isDebugMode =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('debug') === 'top';

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/featured-products');
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setDebug({ httpStatus: res.status, error: (json as any)?.error ?? `HTTP ${res.status}`, raw: json });
          return;
        }
        const data = (json?.data ?? []) as FeaturedProduct[];
        data.sort((a, b) => a.position - b.position);
        setItems(data);
        setDebug({ httpStatus: res.status, raw: json });
      } catch (e: any) {
        if (!cancelled) setDebug({ error: String(e?.message ?? e) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // Diagnostic banner (само ако ?debug=top): показва точно защо секцията
  // може да липсва. В нормален режим връщаме null при празно (както преди).
  if (isDebugMode && !loading && items.length === 0) {
    return (
      <section id="products" className="py-8">
        <div className="max-w-3xl mx-auto px-4">
          <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 text-sm text-amber-900">
            <div className="font-black text-base mb-2">🛠 Debug: Топ продукти секцията е празна</div>
            <p className="mb-2">
              Endpoint <code className="font-mono bg-white px-1 rounded">/api/featured-products</code> върна 0 продукта.
              Възможни причини:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Миграция <code>0035_featured_top_products.sql</code> не е приложена (колоните липсват).</li>
              <li>Назначените продукти са с <code>stock_status = 'out_of_stock'</code> или <code>is_active = false</code>.</li>
              <li>Backend сървърът не е стартиран / Vite proxy не пренасочва <code>/api</code>.</li>
            </ul>
            <details className="mt-3">
              <summary className="cursor-pointer font-bold">Сурова диагностика</summary>
              <pre className="mt-2 text-[11px] bg-white p-2 rounded overflow-auto max-h-48">{JSON.stringify(debug, null, 2)}</pre>
            </details>
          </div>
        </div>
      </section>
    );
  }

  // Не показваме секцията, ако админът още не е подредил Топ продуктите.
  if (!loading && items.length === 0) return null;

  return (
    <section id="products" className="py-8 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-5">
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
            className="mt-4 text-sm md:text-base text-gray-700 font-medium mx-auto leading-relaxed"
          >
            Внимателно подбрани модели с най-добро съотношение качество, ефективност и цена
          </motion.p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-gray-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Зареждам Топ продукти…
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
