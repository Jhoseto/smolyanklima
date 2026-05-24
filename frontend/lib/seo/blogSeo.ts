import type { PageSeoConfig } from './config';

export const BLOG_HOME_SEO: PageSeoConfig = {
  title: 'Блог за климатици Смолян | Експертни съвети — Смолян Клима',
  description:
    'Експертни статии за избор, монтаж и поддръжка на климатици в Смолян и региона. Сравнения, цени, профилактика и регионални съвети за Родопите.',
  keywords: [
    'блог климатик',
    'съвети климатик',
    'монтаж климатик смолян',
    'климатик смолян',
    'избор климатик',
    'климатици смолян',
  ],
  canonicalPath: '/blog',
  ogImage: '/images/blog/og-blog-home.jpg',
};

export const BLOG_CATEGORY_SEO: Record<string, PageSeoConfig> = {
  'saveti-pri-izbor': {
    title: 'Съвети при избор на климатик | Блог — Смолян Клима',
    description: 'Как да изберете перфектния климатик — мощност BTU/kW, марки, функции и съвети за Смолян и региона.',
    keywords: ['избор климатик', 'BTU климатик', 'съвети климатик', 'климатик смолян'],
    canonicalPath: '/blog/kategoria/saveti-pri-izbor',
    ogImage: '/images/blog/og-blog-home.jpg',
  },
  sravneniya: {
    title: 'Сравнения на климатици | Блог — Смолян Клима',
    description: 'Детайлни сравнения между марки и модели климатици — Daikin, Mitsubishi, Samsung и други.',
    keywords: ['сравнение климатици', 'daikin vs mitsubishi', 'климатик марки'],
    canonicalPath: '/blog/kategoria/sravneniya',
    ogImage: '/images/blog/og-blog-home.jpg',
  },
  montaj: {
    title: 'Монтаж на климатици — статии и цени Смолян | Смолян Клима',
    description: 'Всичко за монтажа на климатици в Смолян — цени, процес, стандартен пакет и съвети от професионалисти.',
    keywords: ['монтаж климатик', 'монтаж климатик смолян', 'цена монтаж климатик'],
    canonicalPath: '/blog/kategoria/montaj',
    ogImage: '/images/blog/og-blog-home.jpg',
  },
  profilaktika: {
    title: 'Профилактика на климатици | Блог — Смолян Клима',
    description: 'Поддръжка, почистване и годишна профилактика на климатични системи — защо е важна и колко струва.',
    keywords: ['профилактика климатик', 'почистване климатик', 'сервиз климатик'],
    canonicalPath: '/blog/kategoria/profilaktika',
    ogImage: '/images/blog/og-blog-home.jpg',
  },
  remont: {
    title: 'Ремонт на климатици — проблеми и решения | Смолян Клима',
    description: 'Често срещани проблеми с климатици и бързи решения. Кога можете сами и кога да повикате сервиз.',
    keywords: ['ремонт климатик', 'климатик не охлажда', 'сервиз климатик смолян'],
    canonicalPath: '/blog/kategoria/remont',
    ogImage: '/images/blog/og-blog-home.jpg',
  },
  energiya: {
    title: 'Енергийна ефективност на климатици | Блог — Смолян Клима',
    description: 'Икономия на ток, SEER/SCOP, енергийни класове и отопление с климатик в планински климат.',
    keywords: ['енергийна ефективност климатик', 'икономия ток', 'отопление климатик'],
    canonicalPath: '/blog/kategoria/energiya',
    ogImage: '/images/blog/og-blog-home.jpg',
  },
  novini: {
    title: 'Новини за климатици | Блог — Смолян Клима',
    description: 'Нови модели, smart функции, промоции и актуалности от света на климатизацията.',
    keywords: ['новини климатици', 'wi-fi климатик', 'нов модел климатик'],
    canonicalPath: '/blog/kategoria/novini',
    ogImage: '/images/blog/og-blog-home.jpg',
  },
  regionalni: {
    title: 'Климатици Смолян и региона — регионални статии | Смолян Клима',
    description:
      'Специализирани съвети за климатици в Смолян, Рудозем, Девин, Чепеларе и Родопите. Монтаж, избор и отопление в планински климат.',
    keywords: ['климатик смолян', 'климатици смолян', 'климатик родопи', 'монтаж смолян', 'климатик девин'],
    canonicalPath: '/blog/kategoria/regionalni',
    ogImage: '/images/blog/og-blog-home.jpg',
  },
};

export function blogCategorySeo(slug: string): PageSeoConfig | null {
  return BLOG_CATEGORY_SEO[slug] ?? null;
}

export const BLOG_HOME_H1 = 'Блог за климатици Смолян и региона';
export const BLOG_HOME_LEAD =
  'Експертни съвети за избор, монтаж и поддръжка на климатици. Практически ръководства от сертифицирани специалисти.';
