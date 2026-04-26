# 📰 SmolyanKlima Blog

SEO-оптимизиран блог система за климатични съвети, изградена с React + TypeScript + Tailwind CSS.

## ✅ Инсталирани Dependencies

```bash
npm install @tailwindcss/typography react-markdown remark-gfm --legacy-peer-deps
```

## 🗂️ Структура

```
frontend/
├── components/blog/
│   ├── BlogHeroSection.tsx      # Hero с търсачка
│   ├── ArticleCard.tsx           # Карти за статии (3 варианта)
│   ├── CategoryFilterBar.tsx     # Филтри по категории
│   ├── NewsletterSection.tsx     # Абонамент форма
│   ├── TrendingSection.tsx       # Най-четени
│   ├── Breadcrumb.tsx            # Навигация
│   ├── SchemaMarkup.tsx          # JSON-LD SEO
│   ├── SEOMetaTags.tsx           # Meta tags компонент
│   └── ArticleContent.tsx        # Markdown рендерер
├── pages/
│   ├── BlogHomePage.tsx          # /blog
│   └── BlogArticlePage.tsx       # /blog/:slug
├── data/blog/
│   ├── articles.ts               # 3 SEO статии
│   ├── categories.ts             # 8 категории
│   ├── authors.ts                # Автори
│   └── tags.ts                   # Тагове
└── index.css                     # + @tailwindcss/typography
```

## 🌐 URL Структура

| URL | Описание |
|-----|----------|
| `/blog` | Blog homepage |
| `/blog/:slug` | Статия (e.g., /blog/kak-da-izberem-klimatik-25kvm) |
| `/blog/kategoria/:slug` | Категория (пренасочва към /blog) |
| `/blog/tag/:slug` | Таг (пренасочва към /blog) |

## 🎨 Визуални Елементи

### Fallback за Липсващи Изображения

Всички компоненти имат вграден fallback за изображения:
- **ArticleCard**: Показва gradient placeholder с иконка
- **BlogArticlePage**: Gradient placeholder за featured image
- **Аватари**: Инициали върху gradient кръг

Пример аватар:
```tsx
<div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#00B4D8] to-[#FF4D00] flex items-center justify-center text-white font-bold text-sm">
  ИП
</div>
```

## 🔍 SEO Оптимизация

### Включено:

✅ **Meta Tags** (SEOMetaTags компонент)
- `<title>` - оптимизиран за всяка страница
- `<meta name="description">` - 150-160 chars
- `<meta name="keywords">` - релевантни ключови думи
- `<link rel="canonical">` - canonical URLs

✅ **Open Graph** (Facebook/LinkedIn)
- `og:title`, `og:description`, `og:image`, `og:type`, `og:url`

✅ **Twitter Cards**
- `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`

✅ **Schema.org JSON-LD**
- Article Schema
- BreadcrumbList Schema

### Пример Schema за Статия:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Как да изберем климатик за 25 кв.м.",
  "description": "...",
  "author": { "@type": "Person", "name": "Иван Петров" },
  "publisher": { "@type": "Organization", "name": "Smolyan Klima" }
}
```

## 📝 Добавяне на Нова Статия

1. **Отвори** `frontend/data/blog/articles.ts`

2. **Добави** нов обект в `articles` масива:

```typescript
{
  id: '4',
  slug: 'nova-statia-slug',
  title: 'Заглавие на Статията',
  excerpt: 'Кратко описание за SEO...',
  content: `
## Заглавие

Съдържание в **Markdown** формат...

- Лист елемент
- Друг елемент

| Таблица | Колона 2 |
|---------|----------|
| Данни 1 | Данни 2  |
  `,
  category: 'saveti-pri-izbor',
  tags: ['Daikin', '9000 BTU', 'инверторен'],
  author: 'ivan-petrov',
  featuredImage: '/images/blog/nova-statia.jpg',
  seo: {
    title: 'SEO Заглавие | Smolyan Klima',
    description: 'SEO описание 150-160 символа...',
    keywords: ['ключова дума 1', 'ключова дума 2'],
    ogImage: '/images/blog/og-nova-statia.jpg'
  },
  schema: {
    headline: 'Заглавие на Статията',
    description: 'Описание...',
    image: ['/images/blog/nova-statia.jpg'],
    datePublished: '2026-04-27T08:00:00+03:00',
    dateModified: '2026-04-27T08:00:00+03:00',
    author: { name: 'Иван Петров', url: '/blog/avtor/ivan-petrov' }
  },
  publishedAt: '2026-04-27',
  modifiedAt: '2026-04-27',
  readingTime: 8,
  viewCount: 0,
  featured: false
}
```

3. **Изчисли readingTime** с функцията:
```typescript
readingTime: Math.ceil(content.split(/\s+/).length / 200) // ~200 думи/мин
```

## 🚀 Build & Deploy

### Dev Mode:
```bash
npm run dev
```

### Production Build:
```bash
npm run build
```

### Lint Check:
```bash
npm run lint
```

## 📊 Текущи Статии (SEO Ready)

1. **Как да изберем климатик за 25 кв.м.**
   - Цел: "климатик 25 кв м", "9000 btu"
   - Тип: Информационна
   - Дължина: ~1,200 думи

2. **Най-добрите климатици за Смолян**
   - Цел: "климатик смолян", "планински климат"
   - Тип: Локална SEO
   - Дължина: ~1,100 думи

3. **Монтаж на климатик цени Смолян**
   - Цел: "монтаж на климатик цени"
   - Тип: Транзакционна
   - Дължина: ~1,300 думи

## 🎯 SEO Цели за Класиране

| Ключова Дума | Позиция Цел | Времеви Хоризонт |
|--------------|-------------|------------------|
| "климатик 25 кв м" | Топ 3 | 3 месеца |
| "монтаж климатик смолян" | Топ 1 | 2 месеца |
| "климатик смолян" | Топ 3 | 3 месеца |
| "daikin vs mitsubishi" | Топ 5 | 4 месеца |

## 📝 Content Strategy

### Препоръчителна Честота:
- **2-3 статии седмично** за първите 2 месеца
- **1 статия седмично** след това

### Идеи за Следващи Статии:
4. "Климатик тече вода - 5 причини и решения"
5. "Колко ток харчи климатикът? [Калкулатор 2026]"
6. "Инверторен vs Конвенционален климатик"
7. "Профилактика на климатик по месеци"
8. "Най-тихите климатици за спалня"

## 🔧 Често Срещани Проблеми

### CSS грешки за @tailwindcss/typography

Грешки като:
```
Unknown at rule @import
```

**Решение**: Това е нормално - стандартният CSS linter не разбира Tailwind 4 синтаксиса. Кодът работи коректно.

### Изображенията не се показват

Всички компоненти имат fallback. Ако добавите реални изображения в `public/images/blog/`, те ще се показват автоматично.

### Lazy Loading на Страници

Страниците са lazy loaded в `App.tsx`:
```tsx
const BlogHomePage = lazy(() => import('./pages/BlogHomePage'));
```

## 📱 Responsive Breakpoints

- **Mobile**: < 640px (single column)
- **Tablet**: 640-1024px (2 columns)
- **Desktop**: > 1024px (3 columns + sidebar)

## 🤝 Допълнителни Ресурси

- [Tailwind Typography](https://github.com/tailwindlabs/tailwindcss-typography)
- [React Markdown](https://github.com/remarkjs/react-markdown)
- [Schema.org Article](https://schema.org/Article)
- [Open Graph Protocol](https://ogp.me/)

---

**Статус**: ✅ Блогът е готов за production deployment

**Следваща Стъпка**: Добавете реални изображения в `public/images/blog/` или използвайте fallback gradient-ите които работат перфектно.
