import React, { useMemo, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { 
  BlogHeroSection, 
  ArticleCard, 
  CategoryFilterBar,
  NewsletterSection,
  TrendingSection,
  SEOMetaTags,
  SchemaMarkup
} from '../components/blog';
import { getCategoryBySlug } from '../data/blog';
import { fetchArticles } from '../data/blogService';
import type { Article } from '../data/blog/types';

export default function BlogHomePage() {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug?: string }>();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  
  // Check if we're on a category page
  const isCategoryPage = window.location.pathname.includes('/kategoria/');
  const isTagPage = window.location.pathname.includes('/tag/');
  const isSearchPage = window.location.pathname.includes('/tursi');
  const categorySlug = isCategoryPage ? slug : undefined;
  const category = categorySlug ? getCategoryBySlug(categorySlug) : null;
  
  const tagSlug = isTagPage ? slug : undefined;
  const q = isSearchPage ? (searchParams.get('q') || '').trim() : '';

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const res = await fetchArticles({
          page: 1,
          perPage: 50,
          q: q || undefined,
          category: categorySlug || undefined,
        });
        let data = res.data;
        if (tagSlug) {
          data = data.filter(a =>
            (a.tags ?? []).some(t => t.toLowerCase().replace(/\s+/g, '-') === tagSlug.toLowerCase())
          );
        }
        setArticles(data);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [categorySlug, tagSlug, q]);

  const featuredArticle = useMemo(() => {
    if (categorySlug || tagSlug || q) return undefined;
    return articles.find(a => a.featured) ?? articles[0];
  }, [articles, categorySlug, tagSlug, q]);

  const regularArticles = featuredArticle 
    ? articles.filter(a => a.id !== featuredArticle.id).slice(0, 6)
    : articles.slice(0, 9);

  const handleSearchSubmit = () => {
    if (searchQuery.trim()) {
      navigate(`/blog/tursi?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <>
      <SEOMetaTags
        title="Блог за Климатици | Smolyan Klima - Експертни Съвети 2026"
        description="Научете всичко за избора, монтажа и поддръжката на климатици. Експертни съвети, сравнения и новини от Smolyan Klima."
        keywords={['блог климатик', 'съвети климатик', 'монтаж климатик', 'избор климатик', 'смолян климатик']}
        ogImage="/images/blog/og-blog-home.jpg"
        canonicalUrl={categorySlug ? `/blog/kategoria/${categorySlug}` : "/blog"}
      />
      
      {/* Organization Schema for Local SEO */}
      <SchemaMarkup type="organization" />
    <div className="min-h-screen bg-[#FAFAFA] font-sans">
      {/* Hero Section */}
      <BlogHeroSection 
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
      />

      {/* Category Filter */}
      <CategoryFilterBar activeCategory={categorySlug} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-12 gap-12">
          {/* Left Column - Articles */}
          <div className="lg:col-span-8 space-y-16">
            
            {/* Category Title */}
            {category && (
              <section className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  {category.name}
                </h1>
                <p className="text-gray-600">{category.description}</p>
              </section>
            )}

            {/* Featured Article - only on main blog page */}
            {featuredArticle && !categorySlug && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <span className="px-4 py-1.5 rounded-full bg-[#FF4D00] text-white text-sm font-semibold">
                    Featured
                  </span>
                  <h2 className="text-xl font-bold text-gray-900">Препоръчваме</h2>
                </div>
                <ArticleCard article={featuredArticle} variant="hero" />
              </section>
            )}

            {/* Latest Articles Grid */}
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {categorySlug
                    ? `Статии в "${category?.name}"`
                    : tagSlug
                      ? 'Статии по таг'
                      : q
                        ? 'Резултати от търсене'
                        : 'Последни публикации'}
                </h2>
                <a 
                  href="/blog" 
                  className="text-[#FF4D00] font-medium hover:underline"
                >
                  Всички статии →
                </a>
              </div>
              
              <div className="grid sm:grid-cols-2 gap-6">
                {loading ? (
                  <>
                    <div className="h-56 bg-white rounded-2xl border border-gray-100 animate-pulse" />
                    <div className="h-56 bg-white rounded-2xl border border-gray-100 animate-pulse" />
                    <div className="h-56 bg-white rounded-2xl border border-gray-100 animate-pulse" />
                    <div className="h-56 bg-white rounded-2xl border border-gray-100 animate-pulse" />
                  </>
                ) : (
                  regularArticles.map((article, index) => (
                  <ArticleCard 
                    key={article.id} 
                    article={article} 
                    variant="standard"
                    index={index}
                  />
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Right Column - Sidebar */}
          <aside className="lg:col-span-4 space-y-8">
            {/* Trending Section */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <TrendingSection />
            </div>

            {/* Categories List */}
            <div className="bg-white rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Категории</h3>
              <div className="space-y-3">
                {/* Will be populated from data */}
              </div>
            </div>

            {/* CTA Box */}
            <div className="bg-gradient-to-br from-[#FF4D00] to-[#FF4D00]/80 rounded-2xl p-6 text-white">
              <h3 className="text-xl font-bold mb-2">Търсите климатик?</h3>
              <p className="text-white/90 text-sm mb-4">
                Нашите експерти ще ви помогнат да изберете перфектния модел.
              </p>
              <a 
                href="/catalog" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#FF4D00] rounded-full font-semibold text-sm hover:bg-gray-100 transition-colors"
              >
                Разгледай каталога
              </a>
            </div>
          </aside>
        </div>
      </main>

      {/* Newsletter */}
      <NewsletterSection />
    </div>
    </>
  );
}
