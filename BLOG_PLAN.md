# 📰 BLOG PLAN - SmolyanKlima
## Модерен SEO-Оптимизиран Блог Система

**Версия:** 1.0  
**Дата:** Април 2026  
**Статус:** Frontend-only (без backend зависимости)

---

## 🎯 Цел на Блога

**Primary:** Brutal SEO оптимизация за класиране в Google по ключови думи свързани с климатици в Смолян и региона.

**Secondary:** 
- Lead generation (събиране на запитвания)
- Authority building (E-E-A-T)
- Content marketing

---

## 🏗️ Структура на Блога

### URL Структура (SEO-Friendly)

```
/blog                          → Blog Homepage (последни статии)
/blog/kategoria/:slug          → Category Archive
/blog/avtor/:slug              → Author Archive  
/blog/tag/:slug                → Tag Archive
/blog/tursi?q=...              → Search Results
/blog/:slug                    → Single Article
```

### Страници

| Страница | URL | Purpose |
|----------|-----|---------|
| **Blog Home** | `/blog` | Hero grid + Latest + Featured + Categories |
| **Category** | `/blog/kategoria/:slug` | Filtered articles by category |
| **Tag** | `/blog/tag/:slug` | Filtered by topic tag |
| **Author** | `/blog/avtor/:slug` | Author profile + their articles |
| **Search** | `/blog/tursi` | Full-text search results |
| **Article** | `/blog/:slug` | Individual blog post |

---

## 🎨 Визуален Дизайн (Консистентен със Сайта)

### Цветова Палитра

```
Primary Orange:    #FF4D00    (CTAs, акценти, hover states)
Primary Blue:      #00B4D8    (Links, info elements, градиенти)
Background:        #FAFAFA    (Page background)
Card Background:   #FFFFFF    (Cards, content areas)
Text Primary:      #111827    (Headlines, body text)
Text Secondary:    #6B7280    (Meta, captions, dates)
Text Muted:        #9CA3AF    (Labels, placeholders)
Border:            #E5E7EB    (Dividers, card borders)
Success Green:     #27AE60    (Highlights, checkmarks)
```

### Типография

```
Headlines:    Inter, system-ui, sans-serif
Body:         Inter, system-ui, sans-serif  
Accent/Meta:  Inter, system-ui, sans-serif

Sizes:
- H1: 48px / 3rem (blog article title)
- H2: 36px / 2.25rem (section titles)
- H3: 24px / 1.5rem (card titles)
- Body: 18px / 1.125rem (article text)
- Meta: 14px / 0.875rem (dates, categories)
```

### Компоненти Стил

**Cards:**
- Rounded corners: `rounded-2xl` (16px)
- Shadow: `shadow-lg hover:shadow-xl` transition
- Border: subtle 1px `#E5E7EB`
- Image aspect: 16:9 or 4:3
- Hover: scale 1.02 + shadow increase

**Buttons:**
- Primary: `bg-[#FF4D00] text-white rounded-full`
- Secondary: `bg-[#00B4D8] text-white rounded-full`
- Outline: `border-2 border-[#FF4D00] text-[#FF4D00] rounded-full`

---

## 📄 Страница: Blog Homepage (`/blog`)

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  NAVBAR (existing)                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  BLOG HERO SECTION                                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │  "Блог за Климатици"                            │   │
│  │  Експертни съвети, сравнения и новини          │   │
│  │  [Search Bar]                                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  FEATURED ARTICLE (Hero Card - Largest)                 │
│  ┌─────────────────────────────────────────────────┐   │
│  │  [Image 16:9]                                   │   │
│  │  КАТЕГОРИЯ • 5 мин четене                       │   │
│  │  "Как да изберем климатик за 25 кв.м."         │   │
│  │  Excerpt...                                     │   │
│  │  [Прочети още →]                                │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  CATEGORY CHIPS (Filter pills)                          │
│  [Всички] [Съвети] [Сравнения] [Монтаж] [Ремонт] ...  │
├─────────────────────────────────────────────────────────┤
│  LATEST ARTICLES GRID                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │  Article 1   │ │  Article 2   │ │  Article 3   │     │
│  └──────────────┘ └──────────────┘ └──────────────┘     │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐     │
│  │  Article 4   │ │  Article 5   │ │  Article 6   │     │
│  └──────────────┘ └──────────────┘ └──────────────┘     │
├─────────────────────────────────────────────────────────┤
│  POPULAR / TRENDING SECTION                             │
│  (Most viewed articles this month)                      │
├─────────────────────────────────────────────────────────┤
│  NEWSLETTER SECTION                                     │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📧 Абонирай се за бюлетина                     │   │
│  │  Получавай ексклузивни съвети и оферти          │   │
│  │  [Email input] [Абонирай се]                    │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  FOOTER (existing)                                    │
└─────────────────────────────────────────────────────────┘
```

### Компоненти за Blog Homepage

**1. BlogHeroSection**
- Full-width gradient background (blue to orange subtle)
- Animated headline with scramble text effect (reuse от CatalogHero)
- Search bar with autocomplete
- Breadcrumb: Начало > Блог

**2. FeaturedArticleCard (Hero Size)**
- 16:9 aspect ratio image
- Category badge (colored pill)
- Reading time
- Title (H1 size)
- Excerpt (2-3 lines)
- CTA button

**3. CategoryFilterBar**
- Horizontal scrollable pills on mobile
- Active state: filled orange
- Hover: scale + shadow
- Categories: Всички, Съвети при избор, Сравнения, Монтаж, Ремонт, Профилактика, Енергийна ефективност, Новини

**4. ArticleCard (Standard)**
- 4:3 aspect image
- Category pill (top-left overlay)
- Date + Reading time
- Title (H3)
- Excerpt (2 lines max)
- Author avatar + name
- Hover: lift + shadow

**5. TrendingSection**
- "Най-четени този месец"
- Numbered list 1-5
- Compact cards (horizontal layout)
- View count indicator

**6. NewsletterSection**
- Consistent с ContactSection styling
- Orange accent
- Email input + subscribe button
- Privacy checkbox (GDPR)

---

## 📄 Страница: Single Article (`/blog/:slug`)

### Layout Structure

```
┌─────────────────────────────────────────────────────────┐
│  NAVBAR                                                 │
├─────────────────────────────────────────────────────────┤
│  ARTICLE HEADER                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  КАТЕГОРИЯ                                      │   │
│  │  Заглавие на Статията                           │   │
│  │  [Author Avatar] Име • Дата • 8 мин четене     │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  FEATURED IMAGE                                         │
│  [Full-width hero image with overlay gradient]          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────┐ ┌───────────────────────────┐   │
│  │                     │ │   TABLE OF CONTENTS       │   │
│  │   ARTICLE           │ │   (Sticky sidebar)        │   │
│  │   CONTENT           │ │   • Introduction          │   │
│  │                     │ │   • Point 1                 │   │
│  │   (70% width)       │ │   • Point 2                 │   │
│  │                     │ │   • Conclusion              │   │
│  │                     │ │   [CTA Box]                 │   │
│  │                     │ │   ┌─────────────────────┐   │   │
│  │                     │ │   │ Искаш оферта?       │   │   │
│  │                     │ │   │ [Запитване]         │   │   │
│  │                     │ │   └─────────────────────┘   │   │
│  │                     │ │                             │   │
│  │                     │ │   RELATED ARTICLES          │   │
│  │                     │ │   ┌─────┐ ┌─────┐ ┌─────┐   │   │
│  │                     │ │   │Art 1│ │Art 2│ │Art 3│   │   │
│  │                     │ │   └─────┘ └─────┘ └─────┘   │   │
│  └─────────────────────┘ └───────────────────────────┘   │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  AUTHOR BIO BOX                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  [Avatar]                                         │   │
│  │  Име на Автор                                     │   │
│  │  Биография...                                     │   │
│  │  [Facebook] [LinkedIn]                            │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  RELATED ARTICLES (Full-width grid)                    │
│  "Още статии по темата"                                │
├─────────────────────────────────────────────────────────┤
│  COMMENTS SECTION (optional for now)                     │
├─────────────────────────────────────────────────────────┤
│  NEWSLETTER SECTION                                     │
├─────────────────────────────────────────────────────────┤
│  FOOTER                                                 │
└─────────────────────────────────────────────────────────┘
```

### Article Content Components

**1. Rich Content Blocks:**
```
- H2, H3 headings (auto-generated IDs for TOC)
- Paragraphs with optimal line length (65ch)
- Bullet lists (styled with custom bullets)
- Numbered lists
- Blockquotes (styled with orange left border)
- Tables (comparison tables with striped rows)
- Images (with captions and lazy loading)
- Video embeds (responsive)
- Code blocks (if technical content)
- Info/Warning/Tip boxes (colored callouts)
```

**2. Inline Elements:**
```
- Links (orange color, underline on hover)
- Bold/Italic
- Highlighted text (orange background)
- Internal links to products (contextual CTAs)
```

**3. Article CTAs (Strategic Placement):**
```
- After introduction: "Вижте нашите климатици →"
- Middle of article: "Искате оферта? [Button]"
- After conclusion: "Свържете се с нас"
- Sidebar (sticky): "Готови ли сте да купите?"
```

---

## 🏷️ Таксономия (Категории и Тагове)

### Категории (Основни)

| Категория | Slug | Описание |
|-----------|------|----------|
| **Съвети при избор** | `saveti-pri-izbor` | Как да изберем, размери, мощности |
| **Сравнения** | `sravneniya` | Daikin vs Mitsubishi, марки |
| **Монтаж** | `montaj` | Инсталация, цени, процес |
| **Профилактика** | `profilaktika` | Поддръжка, чистене, сезони |
| **Ремонт** | `remont` | Проблеми, решения, диагностика |
| **Енергийна ефективност** | `energiya` | Ток, икономия, класове |
| **Новини** | `novini` | Нови модели, промоции |
| **Регионални** | `regionalni` | Смолян, планински климатици |

### Тагове (Специфични)

```
Daikin, Mitsubishi, Gree, LG, Fujitsu
Инвертор, Инверторен
9000 BTU, 12000 BTU, 18000 BTU, 24000 BTU
Спалня, Хол, Офис
Летен режим, Зимен режим
Монтаж Смолян, Монтаж Чепеларе
Проблем, Решение
```

---

## 📱 Responsive Breakpoints

```
Mobile:     < 640px    (Single column, stacked)
Tablet:     640-1024px (2-column grid)
Desktop:    > 1024px   (3-column grid + sidebar)
Wide:       > 1280px   (Max-width container)
```

### Mobile Optimizations
- Hamburger filter for categories
- Single column article layout
- Collapsible TOC (accordion)
- Sticky bottom CTA bar
- Touch-friendly tap targets (min 44px)

---

## 🔍 SEO Оптимизация (Brutal Level)

### 1. Meta Tags (Per Article)

```typescript
interface ArticleSEO {
  title: string;                    // <title> - 50-60 chars
  description: string;              // <meta name="description"> - 150-160 chars
  keywords: string[];               // <meta name="keywords"> (less important now)
  canonical: string;                // <link rel="canonical">
  
  // Open Graph (Facebook, LinkedIn)
  ogTitle: string;
  ogDescription: string;
  ogImage: string;                  // 1200x630px
  ogType: 'article';
  ogUrl: string;
  
  // Twitter Card
  twitterCard: 'summary_large_image';
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  
  // Article Schema
  articleSchema: {
    headline: string;
    description: string;
    image: string[];
    datePublished: string;
    dateModified: string;
    author: {
      name: string;
      url?: string;
    };
    publisher: {
      name: string;
      logo: string;
    };
  };
}
```

### 2. Structured Data (Schema.org)

**Article Schema (JSON-LD):**
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Как да изберем климатик за 25 кв.м.",
  "description": "Пълно ръководство за избор на климатик...",
  "image": [
    "https://smolyanklima.bg/blog/klimatik-25kvm.jpg"
  ],
  "datePublished": "2026-04-26T08:00:00+03:00",
  "dateModified": "2026-04-26T08:00:00+03:00",
  "author": {
    "@type": "Person",
    "name": "Иван Иванов",
    "url": "https://smolyanklima.bg/blog/avtor/ivan-ivanov"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Smolyan Klima",
    "logo": {
      "@type": "ImageObject",
      "url": "https://smolyanklima.bg/logo.png"
    }
  }
}
```

**Breadcrumb Schema:**
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Начало",
      "item": "https://smolyanklima.bg/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Блог",
      "item": "https://smolyanklima.bg/blog"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Как да изберем климатик...",
      "item": "https://smolyanklima.bg/blog/kak-da-izberem-klimatik-25kvm"
    }
  ]
}
```

**FAQPage Schema (for FAQ sections):**
```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Колко струва монтаж на климатик?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Монтажът на климатик в Смолян струва..."
      }
    }
  ]
}
```

### 3. URL Structure (Best Practices)

```
✅ https://smolyanklima.bg/blog/kak-da-izberem-klimatik-25kvm
✅ https://smolyanklima.bg/blog/kategoria/saveti-pri-izbor
✅ https://smolyanklima.bg/blog/tag/daikin

❌ https://smolyanklima.bg/blog/post?id=123
❌ https://smolyanklima.bg/blog/article.php?slug=test
```

### 4. Heading Hierarchy

```
H1: Article Title (only one per page)
  H2: Main Sections
    H3: Subsections
      H4: Details (if needed)
```

### 5. Internal Linking Strategy

**Contextual Links in Articles:**
- 3-5 internal links per article
- Link to relevant products: "Вижте нашите [Daikin климатици](/catalog?brand=daikin)"
- Link to related articles
- Link to service pages
- Use descriptive anchor text (not "click here")

### 6. Image Optimization

```
- Format: WebP with JPEG fallback
- Lazy loading: native loading="lazy"
- Alt text: Descriptive, include keywords naturally
- Dimensions: Specify width/height to prevent CLS
- Captions: Use figcaption for context
- Compression: < 100KB per image
```

### 7. Performance (Core Web Vitals)

```
LCP (Largest Contentful Paint): < 2.5s
FID (First Input Delay): < 100ms  
CLS (Cumulative Layout Shift): < 0.1

Strategies:
- Preload hero image
- Lazy load below-fold images
- Minimize JavaScript
- Use system fonts (Inter)
- Optimize CSS (Purge unused)
```

---

## 📝 Контент Стратегия

### Първи 10 Статии (SEO Focused)

| # | Заглавие | Целева Ключова Дума | Тип |
|---|----------|---------------------|-----|
| 1 | "Как да изберем климатик за 25 кв.м. - Пълно ръководство 2026" | "климатик 25 кв м" | Информационна |
| 2 | "Най-добрите климатици за Смолян и планински регион" | "климатик смолян" | Локална |
| 3 | "Монтаж на климатик цени Смолян 2026 - Какво включва?" | "монтаж на климатик цени смолян" | Транзакционна |
| 4 | "Daikin vs Mitsubishi vs Gree - Кой да изберем?" | "daikin vs mitsubishi" | Сравнителна |
| 5 | "Колко ток харчи климатикът? [Калкулатор 2026]" | "колко ток харчи климатик" | Информационна |
| 6 | "Климатикът тече вода - 5 причини и решения" | "климатик тече вода" | Проблем/Решение |
| 7 | "Кога да правим профилактика на климатика? [По месеци]" | "профилактика климатик" | Сезонна |
| 8 | "Инверторен vs Конвенционален климатик - Разлики" | "инверторен климатик" | Обяснителна |
| 9 | "Най-тихите климатици за спалня 2026 [Топ 5]" | "тих климатик за спалня" | Списък/Ревю |
| 10 | "Климатик зима vs лято - Настройки за икономия" | "климатик зима настройки" | Сезонна |

### Article Template Structure

```
1. Hook (Встъпление) - 100-150 думи
   - Задай проблема
   - Обещай решение
   - Include target keyword in first 100 words

2. Table of Contents
   - Jump links

3. Main Content - 1200-2000 думи
   - H2 sections
   - H3 subsections
   - Lists, tables, images
   - Internal links
   - Statistics/data

4. FAQ Section (3-5 questions)
   - Schema markup
   - Long-tail keywords

5. Conclusion
   - Summary
   - Call-to-action

6. Author Bio
   - E-E-A-T signal
```

---

## 🗂️ Файлова Структура

```
frontend/
├── pages/
│   ├── BlogHomePage.tsx          # /blog
│   ├── BlogArticlePage.tsx       # /blog/:slug
│   ├── BlogCategoryPage.tsx      # /blog/kategoria/:slug
│   ├── BlogTagPage.tsx           # /blog/tag/:slug
│   ├── BlogAuthorPage.tsx        # /blog/avtor/:slug
│   └── BlogSearchPage.tsx        # /blog/tursi
│
├── components/
│   └── blog/
│       ├── BlogHeroSection.tsx
│       ├── FeaturedArticleCard.tsx
│       ├── ArticleCard.tsx
│       ├── ArticleGrid.tsx
│       ├── CategoryFilterBar.tsx
│       ├── ArticleContent.tsx
│       ├── TableOfContents.tsx   # Sticky sidebar
│       ├── AuthorCard.tsx
│       ├── NewsletterSection.tsx
│       ├── TrendingSection.tsx
│       ├── SearchBar.tsx
│       ├── Breadcrumb.tsx
│       ├── ShareButtons.tsx      # Social sharing
│       ├── ArticleSchema.tsx     # JSON-LD
│       └── ReadingProgress.tsx   # Top progress bar
│
├── data/
│   └── blog/
│       ├── articles.ts           # All articles data
│       ├── categories.ts         # Categories config
│       ├── authors.ts            # Authors data
│       └── tags.ts               # Tags data
│
└── hooks/
    └── useBlogSearch.ts          # Search functionality
```

---

## 🔧 Техническа Реализация

### 1. Routing (React Router)

```tsx
// App.tsx additions
<Route path="/blog" element={<BlogHomePage />} />
<Route path="/blog/kategoria/:slug" element={<BlogCategoryPage />} />
<Route path="/blog/tag/:slug" element={<BlogTagPage />} />
<Route path="/blog/avtor/:slug" element={<BlogAuthorPage />} />
<Route path="/blog/tursi" element={<BlogSearchPage />} />
<Route path="/blog/:slug" element={<BlogArticlePage />} />
```

### 2. Data Structure (Articles)

```typescript
// data/blog/articles.ts
export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;           // Markdown or JSX
  category: string;
  tags: string[];
  author: string;
  
  // Media
  featuredImage: string;
  images?: string[];
  
  // SEO
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  ogImage: string;
  
  // Dates
  publishedAt: string;
  modifiedAt: string;
  
  // Stats
  readingTime: number;      // minutes
  viewCount?: number;
  
  // Schema
  schema: ArticleSchema;
}

export const articles: Article[] = [
  {
    id: '1',
    slug: 'kak-da-izberem-klimatik-25kvm',
    title: 'Как да изберем климатик за 25 кв.м. - Пълно ръководство 2026',
    // ... rest of data
  }
];
```

### 3. Utilities

```typescript
// utils/blog.ts

// Generate reading time
export function getReadingTime(content: string): number {
  const wordsPerMinute = 200;
  const words = content.split(/\s+/).length;
  return Math.ceil(words / wordsPerMinute);
}

// Generate slug from title
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 60);
}

// Generate meta description
export function generateMetaDescription(content: string): string {
  // Take first 160 chars, end at word boundary
  const clean = content.replace(/<[^>]*>/g, '').substring(0, 160);
  return clean + (clean.length >= 160 ? '...' : '');
}

// Generate JSON-LD schema
export function generateArticleSchema(article: Article): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.metaDescription,
    image: [article.featuredImage],
    datePublished: article.publishedAt,
    dateModified: article.modifiedAt,
    author: {
      '@type': 'Person',
      name: article.author,
    },
    // ... more fields
  });
}
```

---

## 📊 Analytics & Tracking

### Events to Track

```
- Article View (page_view with article_id)
- Scroll Depth (25%, 50%, 75%, 100%)
- Time on Page
- CTA Click ("Искам оферта", "Виж продукти")
- Social Share
- Newsletter Subscribe
- Search Query (what people search for)
- Category Filter Click
```

---

## ✅ Implementation Checklist

### Phase 1: Core Structure
- [ ] Create file structure
- [ ] Set up routing
- [ ] Create article data structure
- [ ] Add 3 sample articles with full SEO

### Phase 2: Pages
- [ ] BlogHomePage with all sections
- [ ] BlogArticlePage with sidebar
- [ ] BlogCategoryPage
- [ ] BlogTagPage
- [ ] BlogSearchPage

### Phase 3: Components
- [ ] BlogHeroSection
- [ ] ArticleCard (3 sizes: hero, standard, compact)
- [ ] CategoryFilterBar
- [ ] ArticleContent renderer
- [ ] TableOfContents (sticky)
- [ ] AuthorCard
- [ ] NewsletterSection
- [ ] Breadcrumb
- [ ] ShareButtons
- [ ] ReadingProgress

### Phase 4: SEO
- [ ] Meta tags component
- [ ] Schema.org JSON-LD
- [ ] Open Graph tags
- [ ] Twitter Card tags
- [ ] Canonical URLs
- [ ] Sitemap generation (manual for now)

### Phase 5: Content
- [ ] Write 10 SEO-optimized articles
- [ ] Create category pages content
- [ ] Author bios
- [ ] Images with alt text

### Phase 6: Polish
- [ ] Responsive testing
- [ ] Performance optimization
- [ ] Accessibility (a11y)
- [ ] Cross-browser testing

---

## 🚀 Post-Launch (Future Backend Integration)

When backend is ready:
1. Move articles to CMS/Database
2. Add comments system
3. Real view counts
4. Dynamic search
5. A/B testing for headlines
6. Auto-generated OG images
7. Newsletter automation

---

**Status:** Ready for implementation  
**Priority:** HIGH (SEO критично за сезона)  
**Estimated Time:** 3-4 дни за MVP с 3 статии
