import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowUp, SlidersHorizontal, PackageX, ShieldCheck, Wrench, Clock, BadgeCheck } from 'lucide-react';

import { CatalogHero }    from '../components/catalog/CatalogHero';
import { SearchSortBar }  from '../components/catalog/SearchSortBar';
import { CategoryChips }  from '../components/catalog/CategoryChips';
import { FilterSidebar }  from '../components/catalog/FilterSidebar';
import { ActiveFilters }  from '../components/catalog/ActiveFilters';
import { ProductCard }    from '../components/catalog/ProductCard';
import { QuickViewModal } from '../components/catalog/QuickViewModal';
import { FloatingHelp }   from '../components/catalog/FloatingHelp';
import { ToastSystem, useToasts, useFavorites } from '../components/catalog/ToastSystem';
import { RecentlyViewed, useRecentlyViewed } from '../components/catalog/RecentlyViewed';
import { GuidedBuyingWizard } from '../components/catalog/GuidedBuyingWizard';
import { SocialProofToasts } from '../components/catalog/SocialProofToasts';
import { CompareBar }     from '../components/catalog/CompareBar';
import { useSearchParams } from 'react-router-dom';
import { useScroll, useSpring } from 'motion/react';

import {
  getAllProducts,
  getFilteredProducts,
  getPriceRange,
  CATEGORIES,
} from '../data/productService';
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
const WhyUsBanner = ({ key }: { key?: React.Key }) => (
  <div className="col-span-full my-2">
    <div className="bg-gradient-to-r from-[#F4F9FA] to-white rounded-2xl p-6 border border-[#00B4D8]/10 shadow-sm">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4 text-center">Защо Смолян Клима?</p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { value: '25+', label: 'год. опит' },
          { value: '1000+', label: 'монтажа' },
          { value: '4.9★', label: 'оценка' },
          { value: 'Daikin', label: 'сервизен' },
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
const EmptyState = ({ onReset, key }: { onReset: () => void; key?: React.Key }) => (
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
const CatalogPage = () => {
  const allProducts = useMemo(() => getAllProducts(), []);
  const { min: priceMin, max: priceMax } = useMemo(() => getPriceRange(), []);

  // ── State ────────────────────────────────
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('cat') || 'all');
  const [brands, setBrands] = useState<string[]>(searchParams.get('b')?.split(',').filter(Boolean) || []);
  const [energyClasses, setEnergyClasses] = useState<string[]>(searchParams.get('e')?.split(',').filter(Boolean) || []);
  const [features, setFeatures] = useState<string[]>(searchParams.get('f')?.split(',').filter(Boolean) || []);
  const [priceRange, setPriceRange] = useState<[number, number]>([
    Number(searchParams.get('min')) || priceMin,
    Number(searchParams.get('max')) || priceMax
  ]);
  const [sortBy, setSortBy] = useState<SortOption>((searchParams.get('s') as SortOption) || 'recommended');
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [quickViewProduct, setQuickViewProduct] = useState<CatalogProduct | null>(null);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [compareList, setCompareList] = useState<CatalogProduct[]>([]);

  const { toasts, addToast, dismissToast } = useToasts();
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const { viewedIds, addViewed } = useRecentlyViewed();

  // ── Sync to URL ──────────────────────────
  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (category !== 'all') params.set('cat', category);
    if (brands.length) params.set('b', brands.join(','));
    if (energyClasses.length) params.set('e', energyClasses.join(','));
    if (features.length) params.set('f', features.join(','));
    if (priceRange[0] !== priceMin) params.set('min', priceRange[0].toString());
    if (priceRange[1] !== priceMax) params.set('max', priceRange[1].toString());
    if (sortBy !== 'recommended') params.set('s', sortBy);
    setSearchParams(params, { replace: true });
  }, [search, category, brands, energyClasses, features, priceRange, sortBy, priceMin, priceMax, setSearchParams]);

  // ── Scroll Progress ──────────────────────
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 });

  // ── Simulate loading ─────────────────────
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  // ── Back to top ──────────────────────────
  useEffect(() => {
    const handler = () => setShowBackToTop(window.scrollY > 600);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  // ── Debounced search ─────────────────────
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(t);
  }, [search]);

  // ── Filtered products ────────────────────
  const filtered = useMemo(() => {
    // Category filter resolves to type list
    const catMeta = CATEGORIES.find(c => c.id === category);
    const types = catMeta && catMeta.types.length > 0 ? catMeta.types : [];

    return getFilteredProducts({
      search: debouncedSearch,
      brands,
      types,
      energyClasses,
      features,
      priceMin: priceRange[0],
      priceMax: priceRange[1],
      sortBy,
    });
  }, [debouncedSearch, category, brands, energyClasses, features, priceRange, sortBy]);

  // ── Category counts ──────────────────────
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: allProducts.length };
    CATEGORIES.forEach(cat => {
      if (cat.types.length > 0) {
        counts[cat.id] = allProducts.filter(p => cat.types.includes(p.type)).length;
      }
    });
    return counts;
  }, [allProducts]);

  // ── Active filter count ──────────────────
  const activeFilterCount = brands.length + energyClasses.length + features.length +
    (priceRange[0] !== priceMin || priceRange[1] !== priceMax ? 1 : 0);

  // ── Handlers ────────────────────────────
  const resetAllFilters = useCallback(() => {
    setSearch('');
    setCategory('all');
    setBrands([]);
    setEnergyClasses([]);
    setFeatures([]);
    setPriceRange([priceMin, priceMax]);
    setSortBy('recommended');
  }, [priceMin, priceMax]);

  const handleFavoriteToggle = useCallback((id: string) => {
    toggleFavorite(id);
    const isNowFav = !isFavorite(id);
    addToast(
      isNowFav ? 'Добавено в любими' : 'Премахнато от любими',
      isNowFav ? '❤️' : '💔'
    );
  }, [toggleFavorite, isFavorite, addToast]);

  const handleShare = useCallback((product: CatalogProduct) => {
    const url = `${window.location.origin}/catalog?product=${product.id}`;
    navigator.clipboard.writeText(url).then(() => {
      addToast('Линкът е копиран!', '🔗');
    });
  }, [addToast]);

  const handleFormSubmit = useCallback((productName: string, name: string, phone: string) => {
    console.log('Inquiry:', { productName, name, phone });
    addToast('Ще ви се обадим скоро!', '✅');
    setQuickViewProduct(null);
  }, [addToast]);

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
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-[#FF4D00]/20 selection:text-[#FF4D00]">
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

        {/* Sticky Search + Sort */}
        <div className="mb-6 sticky top-[72px] z-40 -mx-4 sm:mx-0">
          <SearchSortBar
            search={search}
            onSearchChange={setSearch}
            sortBy={sortBy}
            onSortChange={setSortBy}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            totalCount={allProducts.length}
            filteredCount={filtered.length}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            sidebarOpen={sidebarOpen}
          />
        </div>

        {/* Category Chips */}
        <div className="mb-5">
          <CategoryChips
            selected={category}
            onChange={setCategory}
            counts={categoryCounts}
          />
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
                selectedBrands={brands}
                onBrandToggle={brandToggle}
                selectedEnergy={energyClasses}
                onEnergyToggle={energyToggle}
                selectedFeatures={features}
                onFeatureToggle={featureToggle}
                priceRange={priceRange}
                onPriceChange={setPriceRange}
                priceMin={priceMin}
                priceMax={priceMax}
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
                      selectedBrands={brands}
                      onBrandToggle={brandToggle}
                      selectedEnergy={energyClasses}
                      onEnergyToggle={energyToggle}
                      selectedFeatures={features}
                      onFeatureToggle={featureToggle}
                      priceRange={priceRange}
                      onPriceChange={setPriceRange}
                      priceMin={priceMin}
                      priceMax={priceMax}
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
            {loading ? (
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
                  {filtered.length === 0 ? (
                    <EmptyState key="empty" onReset={resetAllFilters} />
                  ) : (
                    filtered.map((product, index) => {
                      const nodes: React.ReactNode[] = [];

                      // Insert "Why Us" banner after 8th product
                      if (index === 8) {
                        nodes.push(<WhyUsBanner key="why-us" />);
                      }

                      nodes.push(
                        <ProductCard
                          key={product.id}
                          product={product}
                          index={index}
                          onQuickView={(p) => {
                            setQuickViewProduct(p);
                            addViewed(p.id);
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
            {!loading && filtered.length > 0 && (
              <p className="text-center text-sm text-gray-400 mt-10">
                Показани <strong className="text-gray-600">{filtered.length}</strong> от <strong className="text-gray-600">{allProducts.length}</strong> продукта
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── OVERLAYS & FLOATING ────────────────── */}

      {/* Compare Bar */}
      <CompareBar 
        compareList={compareList} 
        onRemove={(id) => setCompareList(prev => prev.filter(p => p.id !== id))}
        onClear={() => setCompareList([])}
      />

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        onClose={() => setQuickViewProduct(null)}
        isFavorite={quickViewProduct ? isFavorite(quickViewProduct.id) : false}
        onFavoriteToggle={handleFavoriteToggle}
        onFormSubmit={handleFormSubmit}
      />

      {/* Floating Help Button */}
      <FloatingHelp />

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
