import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp, SlidersHorizontal, PackageX, ShieldCheck, Wrench, Clock, BadgeCheck } from 'lucide-react';

import { CatalogHero }    from '../components/catalog/CatalogHero';
import { SearchSortBar }  from '../components/catalog/SearchSortBar';
import { CategoryChips }  from '../components/catalog/CategoryChips';
import { FilterSidebar }  from '../components/catalog/FilterSidebar';
import { ActiveFilters }  from '../components/catalog/ActiveFilters';
import { ProductCard }    from '../components/catalog/ProductCard';
import { QuickViewModal } from '../components/catalog/QuickViewModal';
import { ToastSystem, useToasts, useFavorites } from '../components/catalog/ToastSystem';
import { RecentlyViewed, useRecentlyViewed } from '../components/catalog/RecentlyViewed';
import { GuidedBuyingWizard } from '../components/catalog/GuidedBuyingWizard';
import { SocialProofToasts } from '../components/catalog/SocialProofToasts';
import { CompareBar }     from '../components/catalog/CompareBar';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useScroll, useSpring } from 'motion/react';

import {
  fetchProductsCatalogPage,
  fetchCatalogPriceBounds,
  fetchCategoryProductCounts,
} from '../data/productService';
import { getAllAccessories } from '../data/accessoryService';
import { postPublicInquiry } from '../data/postInquiry';
import type { CatalogProduct, SortOption } from '../data/types/product';

// ─────────────────────────────────────────
// TRUST BAR
// ─────────────────────────────────────────
const TrustBar = () => (
  <div className="bg-white border-y border-gray-100 py-4">
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap justify-center gap-x-8 gap-y-3">
        {[
          { icon: <BadgeCheck className="w-4 h-4 text-[#00B4D8]" />, text: 'Официална гаранция' },
          { icon: <Clock className="w-4 h-4 text-[#FF4D00]" />, text: 'Монтаж до 48ч' },
          { icon: <ShieldCheck className="w-4 h-4 text-green-500" />, text: 'Безплатна консултация' },
          { icon: <Wrench className="w-4 h-4 text-purple-500" />, text: 'Сервиз след продажба' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-sm font-semibold text-gray-700">
            {item.icon}
            {item.text}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────
// WHY US BANNER (inserted between products)
// ─────────────────────────────────────────
const WhyUsBanner = () => (
  <div className="col-span-full my-2">
    <div className="bg-gradient-to-r from-[#F4F9FA] to-white rounded-2xl p-6 border border-[#00B4D8]/10 shadow-sm">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 text-center">Защо Смолян Клима?</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { value: '25+', label: 'год. опит' },
          { value: '1500+', label: 'монтажа' },
          { value: '4.8/ 5 ★', label: 'оценка' },
          { value: 'ОТОРИЗИРАН', label: 'сервиз' },
          { value: '3г.', label: 'гаранция' },
          { value: '0%', label: 'лизинг' },
        ].map((stat, i) => (
          <div key={i} className="text-center">
            <div className="text-xl font-black text-[#00B4D8] mb-0.5">{stat.value}</div>
            <div className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">{stat.label}</div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────
const EmptyState = ({ onReset }: { onReset: () => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="col-span-full flex flex-col items-center justify-center py-24 text-center"
  >
    <motion.div
      animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
      transition={{ duration: 1.5, delay: 0.3 }}
      className="text-7xl mb-6"
    >
      📭
    </motion.div>
    <h3 className="text-xl font-bold text-gray-800 mb-2">Няма намерени продукти</h3>
    <p className="text-sm text-gray-500 mb-8 max-w-sm">
      Опитайте да промените критериите за търсене или да изчистите филтрите.
    </p>
    <button
      onClick={onReset}
      className="px-6 py-3 bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-white font-bold rounded-full text-sm hover:shadow-lg hover:shadow-orange-500/30 hover:scale-105 transition-all"
    >
      Изчисти всички филтри
    </button>
  </motion.div>
);

// ─────────────────────────────────────────
// SKELETON CARD
// ─────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-white rounded-[1.5rem] overflow-hidden border border-gray-100 animate-pulse">
    <div className="h-40 bg-gray-200" />
    <div className="p-4 space-y-3">
      <div className="h-2.5 bg-gray-200 rounded w-1/3" />
      <div className="h-4 bg-gray-200 rounded w-3/4" />
      <div className="h-3 bg-gray-200 rounded w-1/2" />
      <div className="flex gap-2">
        <div className="h-5 bg-gray-100 rounded-full w-16" />
        <div className="h-5 bg-gray-100 rounded-full w-20" />
      </div>
      <div className="flex justify-between items-center pt-2">
        <div className="h-7 bg-gray-200 rounded w-16" />
        <div className="h-8 bg-gray-200 rounded-full w-24" />
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────
// MAIN CATALOG PAGE
// ─────────────────────────────────────────
type CatalogTab = 'climate' | 'accessories';
type ClimateCondition = 'new' | 'used';
const PER_PAGE = 24;
const ACCESSORY_CATEGORIES = [
  { id: 'all', label: 'Всички' },
  { id: 'accessory', label: 'Аксесоари' },
  { id: 'spare_part', label: 'Резервни части' },
] as const;

function accessoryCategoryOf(p: CatalogProduct): 'accessory' | 'spare_part' {
  return p.type?.toLowerCase().includes('резерв') ? 'spare_part' : 'accessory';
}

const CatalogPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<CatalogTab>(tabFromUrl === 'accessories' ? 'accessories' : 'climate');
  const [selectedConditions, setSelectedConditions] = useState<ClimateCondition[]>(
    searchParams.get('cond') === 'new' || searchParams.get('cond') === 'used'
      ? [searchParams.get('cond') as ClimateCondition]
      : [],
  );
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({ all: 0 });

  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('cat') || 'all');
  const [brands, setBrands] = useState<string[]>(searchParams.get('b')?.split(',').filter(Boolean) || []);
  const [energyClasses, setEnergyClasses] = useState<string[]>(searchParams.get('e')?.split(',').filter(Boolean) || []);
  const [features, setFeatures] = useState<string[]>(searchParams.get('f')?.split(',').filter(Boolean) || []);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [sortBy, setSortBy] = useState<SortOption>((searchParams.get('s') as SortOption) || 'recommended');
  const [page, setPage] = useState(() => {
    const raw = Number(searchParams.get('page'));
    return raw >= 1 && Number.isFinite(raw) ? Math.floor(raw) : 1;
  });

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [listLoading, setListLoading] = useState(true);
  const [allAccessories, setAllAccessories] = useState<CatalogProduct[]>([]);
  const [accessoriesLoaded, setAccessoriesLoaded] = useState(false);
  const prevListFiltersSigRef = useRef<string | null>(null);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<CatalogProduct | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [compareList, setCompareList] = useState<CatalogProduct[]>([]);

  const { toasts, addToast, dismissToast } = useToasts();
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const { viewedIds, addViewed } = useRecentlyViewed();

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(t);
  }, [search]);

  const accessoryCounts = {
    all: allAccessories.length,
    accessory: allAccessories.filter((p) => accessoryCategoryOf(p) === 'accessory').length,
    spare_part: allAccessories.filter((p) => accessoryCategoryOf(p) === 'spare_part').length,
  };
  const accessoryPriceMin = allAccessories.length ? Math.min(...allAccessories.map((p) => p.price)) : 0;
  const accessoryPriceMax = allAccessories.length ? Math.max(...allAccessories.map((p) => p.price)) : 0;
  const effectivePriceMin = activeTab === 'climate' ? priceMin : accessoryPriceMin;
  const effectivePriceMax = activeTab === 'climate' ? priceMax : accessoryPriceMax;
  const effectiveCategoryCounts = activeTab === 'climate' ? categoryCounts : accessoryCounts;
  const accessoryBrandOptions = [...new Set(allAccessories.map((a) => a.brand).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'bg'));
  const showEnergyAndFeatureFilters = activeTab === 'climate';
  const showConditionFilters = activeTab === 'climate';
  const effectiveCondition: ClimateCondition | undefined =
    selectedConditions.length === 1 ? selectedConditions[0] : undefined;

  useEffect(() => {
    const fromUrl = searchParams.get('tab');
    const normalized: CatalogTab = fromUrl === 'accessories' ? 'accessories' : 'climate';
    const cond = searchParams.get('cond');
    setActiveTab((prev) => (prev === normalized ? prev : normalized));
    setSelectedConditions((prev) => {
      const next: ClimateCondition[] = cond === 'new' || cond === 'used' ? [cond] : [];
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) return prev;
      return next;
    });
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === 'accessories') {
      if (!ACCESSORY_CATEGORIES.some((c) => c.id === category)) setCategory('all');
      if (selectedConditions.length > 0) setSelectedConditions([]);
      return;
    }
  }, [activeTab, category, selectedConditions]);

  // ── Ценови граници + броя по категории (за нови/втора употреба) ──
  useEffect(() => {
    if (activeTab !== 'climate') return;
    let cancelled = false;
    (async () => {
      try {
        const [bounds, counts] = await Promise.all([
          fetchCatalogPriceBounds(effectiveCondition),
          fetchCategoryProductCounts(effectiveCondition),
        ]);
        if (cancelled) return;
        const minP = bounds.min;
        const maxP = bounds.max;
        setPriceMin(minP);
        setPriceMax(maxP);
        setCategoryCounts(counts);
        setPriceRange([minP, maxP]);
      } catch {
        if (!cancelled) setCategoryCounts({ all: 0 });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, effectiveCondition]);

  // ── Аксесоари: зареждаме веднъж при първо влизане в таба ──
  useEffect(() => {
    if (activeTab !== 'accessories' || accessoriesLoaded) return;
    let cancelled = false;
    setListLoading(true);
    (async () => {
      try {
        const all = await getAllAccessories();
        if (!cancelled) {
          setAllAccessories(all);
          setAccessoriesLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setAllAccessories([]);
          setAccessoriesLoaded(true);
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, accessoriesLoaded]);

  useEffect(() => {
    if (activeTab === 'climate') {
      if (priceMax > priceMin) {
        setPriceRange((prev) => {
          if (prev[0] === 0 && prev[1] === 0) return [priceMin, priceMax];
          return [Math.max(priceMin, prev[0]), Math.min(priceMax, prev[1])];
        });
      }
      return;
    }

    if (accessoryPriceMax > accessoryPriceMin) {
      setPriceRange((prev) => {
        if (prev[0] === 0 && prev[1] === 0) return [accessoryPriceMin, accessoryPriceMax];
        return [Math.max(accessoryPriceMin, prev[0]), Math.min(accessoryPriceMax, prev[1])];
      });
    }
  }, [activeTab, priceMin, priceMax, accessoryPriceMin, accessoryPriceMax]);

  // ── Списък от API при филтри / страница (при смяна на филтри → страница 1 преди заявката) ──
  useEffect(() => {
    const listFiltersSig = JSON.stringify({
      activeTab,
      selectedConditions,
      debouncedSearch,
      category,
      brands,
      energyClasses,
      features,
      priceRange,
      sortBy,
    });
    const prevSig = prevListFiltersSigRef.current;
    if (prevSig !== null && prevSig !== listFiltersSig && page !== 1) {
      setPage(1);
      return;
    }
    prevListFiltersSigRef.current = listFiltersSig;

    let cancelled = false;
    setListLoading(true);
    (async () => {
      try {
        if (activeTab === 'climate') {
          const minQ =
            priceMax > priceMin && priceRange[0] > priceMin ? priceRange[0] : undefined;
          const maxQ =
            priceMax > priceMin && priceRange[1] < priceMax ? priceRange[1] : undefined;
          const { data, meta } = await fetchProductsCatalogPage({
            q: debouncedSearch,
            cat: category,
            cond: effectiveCondition,
            brands,
            energyClasses,
            features,
            min: minQ,
            max: maxQ,
            sort: sortBy,
            page,
            perPage: PER_PAGE,
          });
          if (!cancelled) {
            setProducts(data);
            setTotal(meta.total);
          }
          return;
        }

        const normalizedSearch = debouncedSearch.trim().toLowerCase();
        let filtered = allAccessories.filter((p) => {
          if (normalizedSearch) {
            const hay = `${p.name} ${p.brand} ${p.type} ${p.description ?? ''}`.toLowerCase();
            if (!hay.includes(normalizedSearch)) return false;
          }
          if (category !== 'all' && accessoryCategoryOf(p) !== category) return false;
          if (brands.length > 0 && !brands.includes(p.brand)) return false;
          if (effectivePriceMax > effectivePriceMin) {
            if (p.price < priceRange[0] || p.price > priceRange[1]) return false;
          }
          return true;
        });

        filtered = filtered.sort((a, b) => {
          if (sortBy === 'price-asc') return a.price - b.price;
          if (sortBy === 'price-desc') return b.price - a.price;
          if (sortBy === 'rating-desc') return b.rating - a.rating;
          if (sortBy === 'recommended') {
            return (b.reviews - a.reviews) || (b.rating - a.rating);
          }
          return a.name.localeCompare(b.name, 'bg');
        });

        const totalItems = filtered.length;
        const start = (page - 1) * PER_PAGE;
        const pageData = filtered.slice(start, start + PER_PAGE);
        if (!cancelled) {
          setProducts(pageData);
          setTotal(totalItems);
        }
      } catch {
        if (!cancelled) {
          setProducts([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setListLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearch,
    activeTab,
    selectedConditions,
    effectiveCondition,
    allAccessories,
    category,
    brands,
    energyClasses,
    features,
    priceRange,
    sortBy,
    page,
    priceMin,
    priceMax,
  ]);

  // ── Sync to URL ──────────────────────────
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab === 'accessories') params.set('tab', 'accessories');
    if (activeTab === 'climate' && effectiveCondition) params.set('cond', effectiveCondition);
    if (search) params.set('q', search);
    if (category !== 'all') params.set('cat', category);
    if (brands.length) params.set('b', brands.join(','));
    if (activeTab === 'climate' && energyClasses.length) params.set('e', energyClasses.join(','));
    if (activeTab === 'climate' && features.length) params.set('f', features.join(','));
    if (effectivePriceMax > effectivePriceMin) {
      if (priceRange[0] > effectivePriceMin) params.set('min', priceRange[0].toString());
      if (priceRange[1] < effectivePriceMax) params.set('max', priceRange[1].toString());
    }
    if (sortBy !== 'recommended') params.set('s', sortBy);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [activeTab, effectiveCondition, search, category, brands, energyClasses, features, priceRange, sortBy, effectivePriceMin, effectivePriceMax, page, setSearchParams]);

  // ── Scroll Progress ──────────────────────
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  // ── Back to top ──────────────────────────
  useEffect(() => {
    const handler = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const showSkeleton = listLoading && products.length === 0;

  // ── Active filter count ──────────────────
  const activeFilterCount =
    (showConditionFilters && effectiveCondition ? 1 : 0) +
    brands.length +
    (showEnergyAndFeatureFilters ? energyClasses.length : 0) +
    (showEnergyAndFeatureFilters ? features.length : 0) +
    (search.trim() ? 1 : 0) +
    (effectivePriceMax > effectivePriceMin && (priceRange[0] > effectivePriceMin || priceRange[1] < effectivePriceMax) ? 1 : 0);

  // ── Handlers ────────────────────────────
  const resetAllFilters = useCallback(() => {
    setSearch('');
    setCategory('all');
    setSelectedConditions([]);
    setBrands([]);
    setEnergyClasses([]);
    setFeatures([]);
    setPriceRange([effectivePriceMin, effectivePriceMax]);
    setSortBy('recommended');
    setPage(1);
  }, [effectivePriceMin, effectivePriceMax]);

  const handleTabChange = useCallback((tab: CatalogTab) => {
    const nextMin = tab === 'climate' ? priceMin : accessoryPriceMin;
    const nextMax = tab === 'climate' ? priceMax : accessoryPriceMax;
    setActiveTab(tab);
    setCategory('all');
    setSelectedConditions([]);
    setBrands([]);
    setEnergyClasses([]);
    setFeatures([]);
    setSearch('');
    setPriceRange([nextMin, nextMax]);
    setSortBy('recommended');
    setCompareList([]);
    setQuickViewProduct(null);
    setPage(1);
  }, [priceMin, priceMax, accessoryPriceMin, accessoryPriceMax]);

  const handleConditionToggle = useCallback((condition: ClimateCondition) => {
    setSelectedConditions((prev) =>
      prev.includes(condition) ? prev.filter((c) => c !== condition) : [...prev, condition],
    );
  }, []);

  const handleFavoriteToggle = useCallback((id: string) => {
    toggleFavorite(id);
    const isNowFav = !isFavorite(id);
    addToast(
      isNowFav ? 'Добавено в любими' : 'Премахнато от любими',
      isNowFav ? '❤️' : '💔'
    );
  }, [toggleFavorite, isFavorite, addToast]);

  const handleShare = useCallback((product: CatalogProduct) => {
    const url =
      activeTab === 'accessories'
        ? `${window.location.origin}/aksesoar/${product.id}`
        : `${window.location.origin}/catalog?product=${product.id}`;
    navigator.clipboard.writeText(url).then(() => {
      addToast('Линкът е копиран!', '🔗');
    });
  }, [activeTab, addToast]);

  const handleFormSubmit = useCallback(
    async (
      productName: string,
      name: string,
      phone: string,
      meta?: { website?: string; productSlug?: string },
    ) => {
      if (meta?.website?.trim()) {
        addToast('Ще ви се обадим скоро!', '✅');
        setQuickViewProduct(null);
        return;
      }
      const r = await postPublicInquiry({
        source: 'quick_view',
        customerName: name,
        customerPhone: phone,
        message: `Запитване от бърз преглед за: ${productName}`,
        serviceType: 'sale',
        productSlug: meta?.productSlug,
        website: meta?.website ?? '',
      });
      if (r.ok === false) {
        addToast(r.status === 429 ? 'Твърде много заявки. Опитайте по-късно.' : r.error, '⚠️');
        return;
      }
      addToast('Ще ви се обадим скоро!', '✅');
      setQuickViewProduct(null);
    },
    [addToast],
  );

  const brandToggle = (b: string) => setBrands(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b]);
  const energyToggle = (e: string) => setEnergyClasses(prev => prev.includes(e) ? prev.filter(x => x !== e) : [...prev, e]);
  const featureToggle = (f: string) => setFeatures(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);

  const handleCompareToggle = useCallback((product: CatalogProduct) => {
    setCompareList(prev => {
      if (prev.find(p => p.id === product.id)) {
        return prev.filter(p => p.id !== product.id);
      }
      if (prev.length >= 3) {
        addToast('Можете да сравнявате до 3 продукта едновременно.', '⚠️');
        return prev;
      }
      return [...prev, product];
    });
  }, [addToast]);

  // ── Render ───────────────────────────────
  return (
    <div className="relative min-h-screen bg-gray-50 font-sans selection:bg-[#FF4D00]/20 selection:text-[#FF4D00]">
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#00B4D8] to-[#FF4D00] transform-origin-0 z-[1000]"
        style={{ scaleX }}
      />

      {/* Hero */}
      <CatalogHero />

      {/* Trust Bar */}
      <TrustBar />

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'climate' && (
          <>
            {/* Guided Buying Wizard */}
            <GuidedBuyingWizard
              onQuickView={(p: CatalogProduct) => {
                setQuickViewProduct(p);
                addViewed(p.id);
              }}
              isFavorite={isFavorite}
              onFavoriteToggle={handleFavoriteToggle}
              onShare={handleShare}
            />

            {/* Recently Viewed */}
            <RecentlyViewed
              viewedIds={viewedIds}
              onQuickView={(p) => {
                setQuickViewProduct(p);
                addViewed(p.id);
              }}
            />
          </>
        )}

        {/* Sticky Search + Sort */}
        <div className="mb-6 sticky top-[72px] z-40 -mx-4 sm:mx-0">
          <SearchSortBar
            search={search}
            onSearchChange={setSearch}
            sortBy={sortBy}
            onSortChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            totalCount={effectiveCategoryCounts.all ?? 0}
            filteredCount={total}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
          />
        </div>

        <div className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleTabChange('climate')}
            className={`px-5 py-2.5 rounded-full text-sm font-bold border transition-all ${
              activeTab === 'climate'
                ? 'bg-gradient-to-r from-[#00B4D8] to-[#0077B6] text-white border-transparent shadow-md'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            Климатици
          </button>
          <button
            type="button"
            onClick={() => handleTabChange('accessories')}
            className={`px-5 py-2.5 rounded-full text-sm font-bold border transition-all ${
              activeTab === 'accessories'
                ? 'bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-white border-transparent shadow-md'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
            }`}
          >
            Аксесоари
          </button>
        </div>

        {/* Category Chips */}
        <div className="mb-5">
          {activeTab === 'climate' ? (
            <CategoryChips
              selected={category}
              onChange={setCategory}
              counts={effectiveCategoryCounts}
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {ACCESSORY_CATEGORIES.map((cat) => {
                const isActive = category === cat.id;
                const count = effectiveCategoryCounts[cat.id] ?? 0;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-[#FF4D00] to-[#FF2A4D] text-white border-transparent shadow-md'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    {cat.label} {count > 0 ? `(${count})` : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Filters */}
        <ActiveFilters
          brands={brands}
          energyClasses={energyClasses}
          features={features}
          search={search}
          onRemoveBrand={(b) => setBrands(prev => prev.filter(x => x !== b))}
          onRemoveEnergy={(e) => setEnergyClasses(prev => prev.filter(x => x !== e))}
          onRemoveFeature={(f) => setFeatures(prev => prev.filter(x => x !== f))}
          onClearSearch={() => setSearch('')}
          onClearAll={resetAllFilters}
        />

        {/* Layout: Sidebar + Grid */}
        <div className="flex gap-6 mt-2">

          {/* ── FILTER SIDEBAR (Desktop: always visible, Mobile: drawer) ── */}
          <>
            {/* Desktop sidebar */}
            <aside className="hidden lg:block w-[240px] shrink-0">
              <FilterSidebar
                showConditionFilters={showConditionFilters}
                selectedConditions={selectedConditions}
                onConditionToggle={handleConditionToggle}
                brandsOptions={activeTab === 'climate' ? undefined : accessoryBrandOptions}
                selectedBrands={brands}
                onBrandToggle={brandToggle}
                selectedEnergy={energyClasses}
                onEnergyToggle={energyToggle}
                selectedFeatures={features}
                onFeatureToggle={featureToggle}
                showEnergyFilters={showEnergyAndFeatureFilters}
                showFeatureFilters={showEnergyAndFeatureFilters}
                priceRange={priceRange}
                onPriceChange={setPriceRange}
                priceMin={effectivePriceMin}
                priceMax={effectivePriceMax}
                onReset={resetAllFilters}
                activeFilterCount={activeFilterCount}
              />
            </aside>

            {/* Mobile drawer overlay */}
            <AnimatePresence>
              {sidebarOpen && (
                <>
                  <motion.div
                    key="sidebar-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSidebarOpen(false)}
                    className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                  />
                  <motion.div
                    key="sidebar-drawer"
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                    className="fixed left-0 top-0 bottom-0 w-72 bg-white z-50 shadow-2xl overflow-y-auto p-5 lg:hidden"
                  >
                    <FilterSidebar
                      showConditionFilters={showConditionFilters}
                      selectedConditions={selectedConditions}
                      onConditionToggle={handleConditionToggle}
                      brandsOptions={activeTab === 'climate' ? undefined : accessoryBrandOptions}
                      selectedBrands={brands}
                      onBrandToggle={brandToggle}
                      selectedEnergy={energyClasses}
                      onEnergyToggle={energyToggle}
                      selectedFeatures={features}
                      onFeatureToggle={featureToggle}
                      showEnergyFilters={showEnergyAndFeatureFilters}
                      showFeatureFilters={showEnergyAndFeatureFilters}
                      priceRange={priceRange}
                      onPriceChange={setPriceRange}
                      priceMin={effectivePriceMin}
                      priceMax={effectivePriceMax}
                      onReset={resetAllFilters}
                      activeFilterCount={activeFilterCount}
                    />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </>

          {/* ── PRODUCT GRID ─────────────────────── */}
          <div className="flex-1 min-w-0">
            {showSkeleton ? (
              <div className={`grid gap-4 lg:gap-5 ${
                viewMode === 'grid'
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                  : 'grid-cols-1'
              }`}>
                {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : (
              <motion.div
                layout
                className={`grid gap-4 lg:gap-5 ${
                  viewMode === 'grid'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                    : 'grid-cols-1'
                }`}
              >
                <AnimatePresence mode="popLayout">
                  {!listLoading && products.length === 0 ? (
                    <div key="empty" className="col-span-full">
                      <EmptyState onReset={resetAllFilters} />
                    </div>
                  ) : (
                    products.map((product, index) => {
                      const nodes: React.ReactNode[] = [];

                      // Insert "Why Us" banner after 8th product
                      if (index === 8) {
                        nodes.push(
                          <div key="why-us" className="col-span-full">
                            <WhyUsBanner />
                          </div>,
                        );
                      }

                      nodes.push(
                        <ProductCard
                          key={product.id}
                          product={product}
                          index={index}
                          onQuickView={(p) => {
                            if (activeTab === 'accessories') {
                              navigate(`/aksesoar/${p.id}`);
                            } else {
                              setQuickViewProduct(p);
                              addViewed(p.id);
                            }
                          }}
                          isFavorite={isFavorite(product.id)}
                          onFavoriteToggle={handleFavoriteToggle}
                          onShare={handleShare}
                          highlight={debouncedSearch}
                          isCompared={compareList.some(c => c.id === product.id)}
                          onCompareToggle={() => handleCompareToggle(product)}
                          viewMode={viewMode}
                        />
                      );

                      return nodes;
                    })
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Result count at bottom */}
            {!showSkeleton && products.length > 0 && total > 0 && (
              <div className="mt-10 space-y-4">
                <p className="text-center text-sm text-gray-400">
                  Показани{' '}
                  <strong className="text-gray-600">
                    {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)}
                  </strong>{' '}
                  от <strong className="text-gray-600">{total}</strong> продукта
                </p>
                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={page <= 1 || listLoading}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 disabled:opacity-40 hover:border-[#00B4D8] hover:text-[#00B4D8] transition-colors"
                    >
                      Предишна
                    </button>
                    <span className="text-sm text-gray-500 px-2">
                      Страница {page} от {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={page >= totalPages || listLoading}
                      onClick={() => setPage((p) => p + 1)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-700 disabled:opacity-40 hover:border-[#00B4D8] hover:text-[#00B4D8] transition-colors"
                    >
                      Следваща
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── OVERLAYS & FLOATING ────────────────── */}

      {/* Compare Bar */}
      {activeTab === 'climate' && (
        <CompareBar
          compareList={compareList}
          onRemove={(id) => setCompareList(prev => prev.filter(p => p.id !== id))}
          onClear={() => setCompareList([])}
        />
      )}

      {/* Quick View Modal */}
      {activeTab === 'climate' && (
        <QuickViewModal
          product={quickViewProduct}
          onClose={() => setQuickViewProduct(null)}
        onRated={(productId, rating, reviewsCount) => {
          const patchRating = (p: CatalogProduct) =>
            p.id === productId ? { ...p, rating, reviews: reviewsCount } : p;
          setProducts((prev) => prev.map(patchRating));
          setAllAccessories((prev) => prev.map(patchRating));
          setCompareList((prev) => prev.map(patchRating));
          setQuickViewProduct((prev) => (prev && prev.id === productId ? { ...prev, rating, reviews: reviewsCount } : prev));
        }}
          isFavorite={quickViewProduct ? isFavorite(quickViewProduct.id) : false}
          onFavoriteToggle={handleFavoriteToggle}
          onFormSubmit={handleFormSubmit}
        />
      )}

      {/* Social Proof Toasts */}
      <SocialProofToasts />

      {/* Toast Notifications */}
      <ToastSystem toasts={toasts} onDismiss={dismissToast} />

      {/* Back to Top */}
      <AnimatePresence>
        {showBackToTop && (
          <motion.button
            key="back-to-top"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-24 right-6 z-[300] w-11 h-11 bg-white border border-gray-200 shadow-lg rounded-full flex items-center justify-center text-gray-600 hover:text-[#FF4D00] hover:border-[#FF4D00] transition-all hover:scale-110"
            title="Нагоре"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CatalogPage;
