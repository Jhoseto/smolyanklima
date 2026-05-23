import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, Star, Phone, ShieldCheck, Clock, Check, Zap, Volume2, Wind, Ruler, Weight, ChevronDown } from 'lucide-react';
import { getProductById, getSimilarProducts, rateProduct, publicProductDescription } from '../data/productService';
import type { CatalogProduct } from '../data/types/product';
import { trackViewItem } from '../lib/analytics/events';
import { ProductCard } from '../components/catalog/ProductCard';
import { PremiumImageGallery } from '../components/media/PremiumImageGallery';
import { ProductInquiryModal } from '../components/catalog/ProductInquiryModal';

export default function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState<CatalogProduct[]>([]);
  const [ratingBusy, setRatingBusy] = useState(false);
  const [ratingNotice, setRatingNotice] = useState<string | null>(null);
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const [votedStars, setVotedStars] = useState<number | null>(null);
  const [inquiryProduct, setInquiryProduct] = useState<CatalogProduct | null>(null);
  const [inquiryNotice, setInquiryNotice] = useState<string | null>(null);

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);

    const fetchProduct = async () => {
      setLoading(true);
      // Реално зареждане от backend (база)
      const found = id ? await getProductById(id) : undefined;
      
      if (found) {
        setProduct(found);
        trackViewItem(found.id, found.name);
        const relatedProds = await getSimilarProducts(found.id, 3);
        setRelated(relatedProds);
      }
      setLoading(false);
      setInquiryProduct(null);
      setInquiryNotice(null);
    };

    fetchProduct();
  }, [id]);

  async function handleRate(stars: number) {
    if (!product || ratingBusy || alreadyRated) return;
    setRatingBusy(true);
    setRatingNotice(null);
    const r = await rateProduct(product.id, stars);
    if (r.ok) {
      setProduct((prev) => (prev ? { ...prev, rating: r.rating, reviews: r.reviewsCount } : prev));
      setVotedStars(stars);
      setAlreadyRated(true);
      setRatingNotice('Благодарим за оценката!');
      setRatingBusy(false);
      return;
    }
    if (!('code' in r)) {
      setRatingNotice('Грешка при изпращане на оценката.');
      setRatingBusy(false);
      return;
    }
    const code = r.code;
    if (code === 'ALREADY_RATED') {
      setAlreadyRated(true);
      setRatingNotice('Вече сте оценили този продукт.');
    } else if (code === 'RATE_LIMIT_EXCEEDED') {
      setRatingNotice('Твърде много опити. Опитайте по-късно.');
    } else if (code === 'RATINGS_NOT_READY') {
      setRatingNotice('Оценяването още не е активирано.');
    } else {
      setRatingNotice('Грешка при изпращане на оценката.');
    }
    setRatingBusy(false);
  }

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

  const starsToRender = hoverStars ?? votedStars ?? Math.round(product.rating);
  const descriptionText = publicProductDescription(product.description);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#FAFAFA] pt-20 font-sans">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-0 h-[420px] w-[420px] rounded-full bg-[#00B4D8]/8 blur-[100px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-[40%] -left-24 h-[360px] w-[360px] rounded-full bg-[#FF4D00]/6 blur-[90px]"
      />

      <main className="relative max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <button
          type="button"
          onClick={() => navigate('/catalog')}
          className="group mb-8 inline-flex items-center gap-2 rounded-full border border-gray-200/80 bg-white/80 px-4 py-2 text-sm font-semibold text-gray-600 shadow-sm backdrop-blur-sm transition hover:border-[#00B4D8]/30 hover:bg-[#EBF5FF] hover:text-[#0077B6]"
        >
          <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-0.5" /> Обратно към продуктите
        </button>

        {/* ── TOP SECTION: Image + Info ── */}
        <div className="flex flex-col lg:flex-row gap-10 xl:gap-16 mb-16">
          {/* Left: Image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="w-full lg:w-1/2 lg:sticky lg:top-28 lg:self-start"
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
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#00B4D8] mb-2">{product.brand}</p>
            <h1 className="font-outfit text-3xl md:text-4xl lg:text-[2.75rem] font-black text-gray-900 leading-[1.08] tracking-tight mb-2">
              {product.name}
            </h1>
            <p className="text-gray-500 font-medium mb-5">
              <span className="text-[#0077B6] font-semibold">{product.type}</span>
              {product.area ? <span> · {product.area}</span> : null}
            </p>

            <div className="mb-6 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-100/80 bg-white/70 px-4 py-3 shadow-sm backdrop-blur-sm">
              <div className="flex text-[#FF6A00]">
                {[...Array(5)].map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => void handleRate(i + 1)}
                    onMouseEnter={() => setHoverStars(i + 1)}
                    onMouseLeave={() => setHoverStars(null)}
                    disabled={ratingBusy || alreadyRated}
                    className="disabled:cursor-not-allowed"
                    title={alreadyRated ? 'Вече сте гласували' : `Оцени с ${i + 1} звезди`}
                  >
                    <Star className={`w-4 h-4 transition-colors ${i < starsToRender ? 'fill-current' : 'fill-gray-200 text-gray-200'}`} />
                  </button>
                ))}
              </div>
              <span className="text-sm font-bold text-gray-700">{product.rating}</span>
              <span className="text-sm text-gray-400">({product.reviews} отзива)</span>
            </div>
            {ratingNotice && <p className="text-xs font-semibold text-[#0077B6] mb-6">{ratingNotice}</p>}

            {/* Quick Specs Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {product.coolingPower && (
                <div className="flex items-center gap-2 rounded-xl border border-[#00B4D8]/15 bg-gradient-to-br from-[#EBF5FF] to-[#F0F9FF] px-3.5 py-2 text-xs font-bold text-[#0077B6] shadow-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#00B4D8]/15">
                    <Zap className="h-3.5 w-3.5 text-[#00B4D8]" />
                  </span>
                  {product.coolingPower}
                </div>
              )}
              {product.heatingPower && (
                <div className="flex items-center gap-2 rounded-xl border border-[#FF4D00]/15 bg-gradient-to-br from-[#FFF7F2] to-white px-3.5 py-2 text-xs font-bold text-[#FF4D00] shadow-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#FF4D00]/10">
                    <Wind className="h-3.5 w-3.5 text-[#FF4D00]" />
                  </span>
                  {product.heatingPower}
                </div>
              )}
              {product.noise && (
                <div className="flex items-center gap-2 rounded-xl border border-[#00B4D8]/10 bg-white px-3.5 py-2 text-xs font-bold text-[#0077B6] shadow-sm">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EBF5FF]">
                    <Volume2 className="h-3.5 w-3.5 text-[#00B4D8]" />
                  </span>
                  {product.noise}
                </div>
              )}
            </div>

            {/* Feature Chips */}
            <div className="flex flex-wrap gap-2 mb-8">
              {product.features.map((f, i) => (
                <span
                  key={i}
                  className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-sm ${
                    i % 2 === 0
                      ? 'border-[#00B4D8]/15 bg-[#EBF5FF]/60 text-[#0077B6]'
                      : 'border-[#FF4D00]/15 bg-[#FFF7F2] text-[#FF4D00]'
                  }`}
                >
                  <Check className={`h-3 w-3 ${i % 2 === 0 ? 'text-[#00B4D8]' : 'text-[#FF4D00]'}`} strokeWidth={3} />
                  {f}
                </span>
              ))}
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-gradient-to-br from-white via-white to-[#FFF7F2]/80 p-6 shadow-[0_12px_40px_rgba(0,180,216,0.08)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[#00B4D8] via-[#00B4D8]/40 to-[#FF4D00]" />
              <div className="mb-5">
                <div className="flex items-baseline gap-2">
                  <span className="font-outfit text-4xl font-black tracking-tight text-gray-900">
                    €{product.price.toLocaleString()}
                  </span>
                  <span className="text-sm font-semibold text-gray-500">само уред</span>
                </div>
                <p className="mt-1 text-sm font-bold text-gray-700">
                  С монтаж от{' '}
                  <span className="bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] bg-clip-text text-transparent">
                    €{product.priceWithMount.toLocaleString()}
                  </span>
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => setInquiryProduct(product)}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#FF4D00] via-[#FF6A00] to-[#FF2A4D] py-3.5 px-6 font-bold text-white shadow-lg shadow-[#FF4D00]/25 transition hover:scale-[1.02] hover:shadow-xl hover:shadow-[#FF4D00]/30"
                >
                  Пусни запитване
                </button>
                <a
                  href="tel:+359888888888"
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[#00B4D8]/25 bg-white py-3.5 px-6 font-bold text-[#0077B6] shadow-sm transition hover:border-[#00B4D8] hover:bg-[#F0F9FF] hover:shadow-md"
                >
                  <Phone className="h-4 w-4 text-[#00B4D8]" /> Обадете се
                </a>
              </div>
            </div>

            {inquiryNotice && (
              <p className="mt-3 text-sm font-semibold text-[#0077B6]">{inquiryNotice}</p>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <div className="flex items-center gap-2 rounded-full border border-[#00B4D8]/15 bg-[#EBF5FF]/80 px-3.5 py-2 text-xs font-bold text-[#0077B6]">
                <ShieldCheck className="h-4 w-4 text-[#00B4D8]" /> Гаранция на монтажа
              </div>
              <div className="flex items-center gap-2 rounded-full border border-[#FF4D00]/15 bg-[#FFF7F2] px-3.5 py-2 text-xs font-bold text-[#FF4D00]">
                <Clock className="h-4 w-4 text-[#FF4D00]" /> Монтаж до 48ч
              </div>
            </div>
          </motion.div>
        </div>

        <div className="my-12 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
        {descriptionText && (
          <ProductDescriptionSection key={product.id} text={descriptionText} />
        )}

        {/* ── MIDDLE SECTION: Tech Specs ── */}
        <div className="max-w-3xl mb-16">
          <DetailSectionTitle title="Технически характеристики" />
          <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white/80 shadow-sm backdrop-blur-sm">
            <SpecRow label="Охладителна мощност" value={product.coolingPower} zebra={0} last={false} />
            <SpecRow label="Отоплителна мощност" value={product.heatingPower} zebra={1} last={false} />
            <SpecRow label="Енергиен клас охл." value={product.energyCool} zebra={0} last={false} />
            <SpecRow label="Енергиен клас отопл." value={product.energyHeat} zebra={1} last={false} />
            <SpecRow label="Шум (вътрешен блок)" value={product.noise} zebra={0} last={false} />
            <SpecRow label="Площ помещение" value={product.area} zebra={1} last={false} />
            <SpecRow label="Хладилен агент" value={product.refrigerant} zebra={0} last={false} />
            <SpecRow label="Вграден WiFi" value={product.wifi ? 'Да' : 'Не'} zebra={1} last />
          </div>
        </div>

        {/* ── DIMENSIONS & WEIGHT ── */}
        {hasDimensionsOrWeight(product) && (
          <div className="mb-16">
            <DetailSectionTitle title="Размери и тегло" />
            <div className="grid md:grid-cols-2 gap-6">
              <UnitBlockCard
                title="Вътрешен блок"
                accent="from-[#00B4D8] to-[#0077B6]"
                accentText="text-[#0077B6]"
                weightKg={product.weightIndoorKg}
                dims={product.dimensions?.indoor}
              />
              <UnitBlockCard
                title="Външен блок"
                accent="from-[#FF4D00] to-[#FF2A4D]"
                accentText="text-[#FF4D00]"
                weightKg={product.weightOutdoorKg}
                dims={product.dimensions?.outdoor}
              />
            </div>
          </div>
        )}

        {/* ── INCLUDED IN BOX ── */}
        <div className="mb-16">
          <DetailSectionTitle title="Включено в комплекта" />
          <div className="flex flex-wrap gap-3">
            {(isAccessoryLike(product) ? buildIncludedForAccessory(product) : buildIncludedForAc(product)).map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold shadow-sm ${
                  item.included
                    ? 'border-[#00B4D8]/15 bg-[#EBF5FF] text-[#0077B6]'
                    : 'border-gray-200 bg-gray-50 text-gray-500'
                }`}
              >
                <Check className={`h-4 w-4 ${item.included ? 'text-[#00B4D8]' : 'text-gray-300'}`} strokeWidth={3} /> {item.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── RELATED PRODUCTS ── */}
        {related.length > 0 && (
          <div className="-mx-4 rounded-[2rem] border border-gray-100 bg-gradient-to-br from-white via-[#F0F9FF]/30 to-[#FFF7F2]/40 px-4 py-10 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <DetailSectionTitle title="Подобни продукти" />
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {related.map((prod, i) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  index={i}
                  onQuickView={(p) => navigate(`/product/${p.id}`)}
                  isFavorite={false} // Може да се закачи към global state
                  onFavoriteToggle={() => {}} 
                  onShare={() => {}}
                  onInquiry={setInquiryProduct}
                />
              ))}
            </div>
          </div>
        )}

      </main>

      <ProductInquiryModal
        product={inquiryProduct}
        onClose={() => setInquiryProduct(null)}
        onSuccess={(msg) => setInquiryNotice(msg)}
        onError={(msg) => setInquiryNotice(msg)}
      />

    </div>
  );
}

function DetailSectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-6">
      <h2 className="font-outfit text-2xl font-black tracking-tight text-gray-900">{title}</h2>
      <div className="mt-2 h-1 w-14 rounded-full bg-gradient-to-r from-[#00B4D8] to-[#FF4D00]" />
    </div>
  );
}

function SpecRow({
  label,
  value,
  zebra,
  last,
}: {
  label: string;
  value?: string | null;
  zebra: number;
  last: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-5 py-4 ${
        !last ? 'border-b border-gray-100' : ''
      } ${zebra % 2 === 0 ? 'bg-white' : 'bg-[#FAFAFA]/80'}`}
    >
      <span className="font-medium text-gray-500">{label}</span>
      <span className="font-bold text-gray-900">{value || '—'}</span>
    </div>
  );
}

function ProductDescriptionSection({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const textRef = React.useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  useEffect(() => {
    if (expanded) return;
    const el = textRef.current;
    if (!el) return;
    const check = () => setCanExpand(el.scrollHeight > el.clientHeight + 2);
    const id = requestAnimationFrame(check);
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(id);
      ro.disconnect();
    };
  }, [text, expanded]);

  return (
    <section className="mb-16">
      <DetailSectionTitle title="Описание" />
      <div className="rounded-3xl border border-[#00B4D8]/10 bg-gradient-to-br from-[#F0F9FF]/50 via-white to-[#FFF7F2]/30 p-6 shadow-sm sm:p-8">
        <div className="relative">
          <p
            ref={textRef}
            className={`text-gray-700 text-base leading-relaxed whitespace-pre-line transition-[max-height] duration-300 ${
              expanded ? '' : 'line-clamp-5'
            }`}
          >
            {text}
          </p>
          {!expanded && canExpand && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/90 to-transparent"
            />
          )}
        </div>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#00B4D8] hover:text-[#0077B6] transition-colors"
          >
            {expanded ? 'Скрий' : 'Прочети повече'}
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
    </section>
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

function hasDimensionsOrWeight(p: CatalogProduct): boolean {
  if (p.weightIndoorKg != null || p.weightOutdoorKg != null) return true;
  const ind = p.dimensions?.indoor;
  const out = p.dimensions?.outdoor;
  return Boolean(
    ind?.lengthMm != null || ind?.widthMm != null || ind?.heightMm != null ||
    out?.lengthMm != null || out?.widthMm != null || out?.heightMm != null,
  );
}

function formatKg(kg?: number): string {
  if (kg == null) return '—';
  const rounded = Math.round(kg * 10) / 10;
  return `${rounded.toLocaleString('bg-BG', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
}

function formatMm(mm?: number): string {
  if (mm == null) return '—';
  return `${mm} mm`;
}

function UnitBlockCard({
  title,
  accent,
  accentText,
  weightKg,
  dims,
}: {
  title: string;
  accent: string;
  accentText: string;
  weightKg?: number;
  dims?: { lengthMm?: number; widthMm?: number; heightMm?: number };
}) {
  const dimsSummary = [dims?.lengthMm, dims?.widthMm, dims?.heightMm]
    .map((v) => (v == null ? '—' : `${v}`))
    .join(' × ');
  return (
    <div className="relative bg-white border border-gray-100 rounded-3xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent}`} />
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-outfit font-black text-lg text-gray-900">{title}</h3>
        <div className={`text-[11px] font-black tracking-widest uppercase ${accentText}`}>Спецификация</div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <span className="flex items-center gap-2 text-sm text-gray-500 font-medium">
            <Weight className="w-4 h-4 text-gray-400" /> Тегло
          </span>
          <span className="font-bold text-gray-900">{formatKg(weightKg)}</span>
        </div>

        <div className="py-3 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-2 text-sm text-gray-500 font-medium">
              <Ruler className="w-4 h-4 text-gray-400" /> Размери (Д × Ш × В)
            </span>
            <span className="text-xs text-gray-400 font-semibold">{dimsSummary} mm</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <DimensionCell label="Дължина" value={formatMm(dims?.lengthMm)} />
            <DimensionCell label="Ширина" value={formatMm(dims?.widthMm)} />
            <DimensionCell label="Височина" value={formatMm(dims?.heightMm)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DimensionCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#FAFAFA] px-3 py-2.5 ring-1 ring-gray-100">
      <div className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-0.5">{label}</div>
      <div className="font-bold text-gray-900 text-sm">{value}</div>
    </div>
  );
}
