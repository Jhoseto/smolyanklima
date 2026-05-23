import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Clock, Calendar, ChevronLeft, ImageIcon } from 'lucide-react';
import { Breadcrumb, SchemaMarkup, SEOMetaTags, ArticleContent, RelatedArticles, SocialShare } from '../components/blog';
import { SiteSeo } from '../components/seo/SiteSeo';
import { getAuthorBySlug, getCategoryBySlug, formatDate } from '../data/blog';
import { fetchArticleBySlug, fetchArticles } from '../data/blogService';
import type { Article } from '../data/blog/types';

export default function BlogArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const [article, setArticle] = React.useState<Article | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [allArticles, setAllArticles] = React.useState<Article[]>([]);
  const [featuredImageError, setFeaturedImageError] = useState(false);
  
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setFeaturedImageError(false);
      const a = slug ? await fetchArticleBySlug(slug) : undefined;
      setArticle(a ?? null);
      const list = await fetchArticles({ page: 1, perPage: 50 });
      setAllArticles(list.data);
      setLoading(false);
    };
    void run();
  }, [slug]);

  const author = article ? getAuthorBySlug(article.author) : undefined;
  const category = article ? getCategoryBySlug(article.category) : undefined;
  // Parse FAQs from article content for structured data
  const parseFAQs = () => {
    const faqs = [];
    const lines = (article?.content ?? '').split('\n');
    let currentQuestion = null;
    
    for (const line of lines) {
      if (line.trim().startsWith('**В:')) {
        currentQuestion = line.replace(/\*\*В:\s*/, '').trim();
      } else if (currentQuestion && line.trim().startsWith('О:')) {
        const answer = line.replace(/О:\s*/, '').trim();
        faqs.push({ question: currentQuestion, answer });
        currentQuestion = null;
      }
    }
    return faqs;
  };
  
  const faqs = parseFAQs();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-[#00B4D8]/20 border-t-[#00B4D8] animate-spin" />
      </div>
    );
  }

  if (!article) {
    return (
      <>
        <SiteSeo
          config={{
            title: 'Статията не е намерена | Смолян Клима',
            description: 'Търсената статия не съществува в блога.',
            canonicalPath: slug ? `/blog/${slug}` : '/blog',
            noindex: true,
          }}
        />
        <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Статията не е намерена</h1>
            <Link to="/blog" className="text-[#FF4D00] hover:underline">
              ← Обратно към блога
            </Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* SEO Meta Tags */}
      <SEOMetaTags
        title={article.seo.title}
        description={article.seo.description}
        keywords={article.seo.keywords}
        ogImage={article.seo.ogImage}
        ogType="article"
        canonicalUrl={`/blog/${article.slug}`}
      />
      
      {/* Schema Markup */}
      <SchemaMarkup article={article} type="article" />
      <SchemaMarkup 
        article={article} 
        type="breadcrumb" 
        breadcrumbs={[
          ...(category ? [{ name: category.name, url: `/blog/kategoria/${category.slug}` }] : [])
        ]}
      />
      {faqs.length > 0 && (
        <SchemaMarkup 
          type="faqpage" 
          faqs={faqs}
        />
      )}

    <div className="min-h-screen bg-[#FAFAFA] font-sans pt-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { label: 'Блог', href: '/blog' },
            ...(category ? [{ label: category.name, href: `/blog/kategoria/${category.slug}` }] : []),
            { label: article.title }
          ]} 
        />

        {/* Article Header */}
        <header className="max-w-4xl mx-auto text-center mb-12">
          {category && (
            <Link 
              to={`/blog/kategoria/${category.slug}`}
              className="inline-block px-4 py-1.5 rounded-full text-sm font-semibold text-white mb-6"
              style={{ backgroundColor: category.color }}
            >
              {category.name}
            </Link>
          )}

          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 leading-tight"
          >
            {article.title}
          </motion.h1>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap items-center justify-center gap-6 text-gray-500"
          >
            {author && (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00B4D8] to-[#FF4D00] flex items-center justify-center text-white font-bold text-sm">
                  {author.name.split(' ').map(n => n[0]).join('')}
                </div>
                <span className="font-medium text-gray-900">{author.name}</span>
              </div>
            )}
            <span className="flex items-center gap-1" title="Дата на публикуване">
              <Calendar className="w-4 h-4" />
              {formatDate(article.publishedAt)}
            </span>
            {article.modifiedAt !== article.publishedAt && (
              <span className="flex items-center gap-1 text-[#00B4D8]" title="Последно обновяване">
                <Clock className="w-4 h-4" />
                Обновено: {formatDate(article.modifiedAt)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-4 h-4" />
              {article.readingTime} мин четене
            </span>
          </motion.div>
        </header>

        {/* Featured Image */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="relative aspect-[21/9] rounded-2xl overflow-hidden mb-12 bg-gradient-to-br from-[#00B4D8]/20 to-[#FF4D00]/20 flex items-center justify-center"
        >
          {!featuredImageError ? (
            <img 
              src={article.featuredImage} 
              alt={`${article.title} - Смолян Клима`}
              className="absolute inset-0 w-full h-full object-cover"
              loading="eager"
              onError={() => setFeaturedImageError(true)}
            />
          ) : (
            <ImageIcon className="w-16 h-16 text-gray-400 relative z-10" aria-hidden />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
          
          {/* Last Updated Badge */}
          {article.modifiedAt !== article.publishedAt && (
            <div className="absolute top-4 right-4 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-[#00B4D8]">
              Обновено: {formatDate(article.modifiedAt)}
            </div>
          )}
        </motion.div>

        {/* Article Content */}
        <div className="grid lg:grid-cols-12 gap-12">
          {/* Main Content */}
          <motion.article 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-8"
          >
            <div className="bg-white rounded-2xl p-8 sm:p-12 shadow-lg">
              {/* Content */}
              <ArticleContent content={article.content} />

              {/* Tags */}
              <div className="mt-12 pt-8 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-500 mb-3">Тагове:</h4>
                <div className="flex flex-wrap gap-2">
                  {article.tags.map(tag => (
                    <Link
                      key={tag}
                      to={`/blog/tag/${tag.toLowerCase().replace(/\s+/g, '-')}`}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm hover:bg-gray-200 transition-colors"
                    >
                      {tag}
                    </Link>
                  ))}
                </div>
              </div>

              {/* Share */}
              <div className="mt-8">
                <SocialShare 
                  url={`/blog/${article.slug}`}
                  title={article.title}
                  description={article.excerpt}
                />
              </div>
            </div>

            {/* Author Bio */}
            {author && (
              <div className="mt-8 bg-white rounded-2xl p-8 shadow-lg">
                <div className="flex items-start gap-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#00B4D8] to-[#FF4D00] flex items-center justify-center text-white font-bold text-xl">
                    {author.name.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{author.name}</h3>
                    <p className="text-[#00B4D8] text-sm font-medium mb-2">{author.role}</p>
                    <p className="text-gray-600 text-sm leading-relaxed">{author.bio}</p>
                  </div>
                </div>
              </div>
            )}
          </motion.article>

          {/* Sidebar */}
          <aside className="lg:col-span-4 space-y-6 lg:sticky lg:top-24 lg:self-start">
            <RelatedArticles 
              currentArticle={article}
              articles={allArticles}
              maxCount={3}
            />

            <div className="bg-gradient-to-br from-[#FF4D00] to-[#FF4D00]/80 rounded-2xl p-6 text-white shadow-lg">
              <h3 className="text-xl font-bold mb-2">Готови ли сте?</h3>
              <p className="text-white/90 text-sm mb-4">
                Свържете се с нас за безплатна консултация и оферта.
              </p>
              <Link 
                to="/contact" 
                className="block w-full text-center px-6 py-3 bg-white text-[#FF4D00] rounded-full font-semibold text-sm hover:bg-gray-100 transition-colors"
              >
                Заяви оферта
              </Link>
            </div>
          </aside>
        </div>

        {/* Back to Blog */}
        <div className="mt-12 mb-12">
          <Link 
            to="/blog" 
            className="inline-flex items-center gap-2 text-gray-500 hover:text-[#FF4D00] transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
            Обратно към блога
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}
