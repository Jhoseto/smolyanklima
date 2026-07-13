import { absoluteUrl, SITE_ORIGIN } from './site';
import { LEGAL_COMPANY } from './company';

export type SeoPage = {
  title: string;
  description: string;
  keywords?: string[];
  canonicalPath: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
  bodyHtml?: string;
  schemas?: Record<string, unknown>[];
};

const OG = '/images/hero-new.jpg';

const REGION_KW = [
  'климатик Смолян', 'климатици Смолян', 'монтаж климатик Смолян',
  'климатик Рудозем', 'климатик Мадан', 'климатик Девин', 'климатик Чепеларе',
];

export const STATIC_PAGES: Record<string, SeoPage> = {
  '/': {
    title: 'Климатици Смолян | Продажба, монтаж и сервиз — Смолян Клима',
    description:
      'Смолян Клима — официален магазин за климатици в Смолян. Продажба, монтаж за 24–48 ч, гаранция и сервиз. Daikin, Mitsubishi, Fudjitsu, Toshiba.',
    keywords: [...REGION_KW, 'инверторен климатик', 'климатик на изплащане'],
    canonicalPath: '/',
    ogImage: OG,
    bodyHtml: `<h1>Климатици за Смолян и региона</h1><p>Продажба, монтаж и сервиз. Тел. ${LEGAL_COMPANY.phone}</p>`,
  },
  '/catalog': {
    title: 'Каталог климатици Смолян | Цени с монтаж — Смолян Клима',
    description: 'Пълен каталог климатици в Смолян — стенни, мулти-сплит, касетъчни, колонни. Филтри по BTU, марка, енергиен клас.',
    keywords: [...REGION_KW, 'каталог климатици', 'климатик цена'],
    canonicalPath: '/catalog',
    ogImage: OG,
    bodyHtml: '<h1>Каталог климатици Смолян</h1><p>Стенни, мулти-сплит и промишлени решения с монтаж.</p>',
  },
  '/services': {
    title: 'Монтаж, профилактика и сервиз на климатици Смолян | Смолян Клима',
    description: 'Професионален монтаж, профилактика и ремонт на климатици в Смолян и региона.',
    keywords: [...REGION_KW, 'сервиз климатик', 'профилактика климатик'],
    canonicalPath: '/services',
    ogImage: OG,
  },
  '/contact': {
    title: 'Контакти — Смолян Клима | Магазин климатици Смолян',
    description: `Смолян Клима — ${LEGAL_COMPANY.tradeAddress}. Тел. ${LEGAL_COMPANY.phone}.`,
    keywords: [...REGION_KW, 'Смолян Клима контакти'],
    canonicalPath: '/contact',
    ogImage: OG,
    bodyHtml: `<h1>Контакти</h1><p>${LEGAL_COMPANY.tradeAddress}. Тел: <a href="tel:${LEGAL_COMPANY.phoneE164}">${LEGAL_COMPANY.phone}</a></p>`,
  },
  '/za-nas': {
    title: 'За нас — Смолян Клима | 25+ години опит',
    description: 'Семеен бизнес с над 10000 монтажа в Смолян и региона.',
    keywords: [...REGION_KW],
    canonicalPath: '/za-nas',
    ogImage: OG,
  },
  '/blog': {
    title: 'Блог за климатици Смолян | Експертни съвети — Смолян Klima',
    description:
      'Експертни статии за избор, монтаж и поддръжка на климатици в Смолян и региона. Сравнения, цени, профилактика и регионални съвети за Родопите.',
    keywords: ['блог климатик', 'монтаж климатик смолян', 'климатик смолян', 'съвети климатик'],
    canonicalPath: '/blog',
    ogImage: OG,
    bodyHtml: '<h1>Блог за климатици Смолян и региона</h1><p>Експертни съвети за климатици от Smolyan Klima.</p>',
  },
  '/montaj-klimatik-smolyan': {
    title: 'Монтаж на климатик Смолян | Цени от €150 — Смолян Клима',
    description:
      'Професионален монтаж на климатик в Смолян и региона. Лицензиран екип, вакуумиране, гаранция. Безплатен оглед. Тел. 0878 58 16 16.',
    keywords: ['монтаж климатик смолян', 'монтаж климатик цена', 'инсталация климатик смолян', ...REGION_KW],
    canonicalPath: '/montaj-klimatik-smolyan',
    ogImage: OG,
    bodyHtml: '<h1>Монтаж на климатик в Смолян</h1><p>Стандартен монтаж от ~€150. Монтаж до 48 часа след доставка.</p>',
  },
};

export const LANDING_PAGES: Record<string, SeoPage> = {
  '/klimatik-smolyan': {
    title: 'Климатици Смолян | Продажба и монтаж — Смолян Клима',
    description:
      'Купете климатик в Смолян с професионален монтаж и гаранция. Официален дилър Daikin, Mitsubishi, Fujitsu, Toshiba. Магазин в кв. Райково.',
    keywords: ['климатик смолян', 'климатици смолян', 'магазин климатици смолян', 'монтаж климатик смолян'],
    canonicalPath: '/klimatik-smolyan',
    ogImage: OG,
    bodyHtml: '<h1>Климатици Смолян</h1><p>Официален магазин и монтажен екип в Смолян.</p>',
  },
  '/klimatik-rudozem': {
    title: 'Климатици Рудозем | Монтаж и сервиз — Смолян Клима',
    description: 'Продажба и монтаж на климатици в Рудозем и околността. Безплатен оглед. Обслужване от екипа на Смолян Клима.',
    keywords: ['климатик рудозем', 'монтаж климатик рудозем', 'климатици рудозем'],
    canonicalPath: '/klimatik-rudozem',
    ogImage: OG,
    bodyHtml: '<h1>Климатици Рудозем</h1><p>Монтаж и сервиз от Смолян Клима.</p>',
  },
  '/klimatik-madan': {
    title: 'Климатици Мадан | Монтаж и сервиз — Смолян Клима',
    description: 'Климатици с монтаж в Мадан. Инверторни модели за планински климат. Безплатна консултация.',
    keywords: ['климатик мадан', 'монтаж климатик мадан'],
    canonicalPath: '/klimatik-madan',
    ogImage: OG,
    bodyHtml: '<h1>Климатици Мадан</h1>',
  },
  '/klimatik-devin': {
    title: 'Климатици Девин | Монтаж и сервиз — Смолян Клима',
    description: 'Климатици и монтаж в Девин. Подходящи модели за SPA и жилищни обекти в Родопите.',
    keywords: ['климатик девин', 'монтаж климатик девин'],
    canonicalPath: '/klimatik-devin',
    ogImage: OG,
    bodyHtml: '<h1>Климатици Девин</h1>',
  },
  '/klimatik-chepelare': {
    title: 'Климатици Чепеларе | Монтаж и сервиз — Смолян Клима',
    description: 'Климатици с монтаж в Чепеларе — ефективно отопление и охлаждане за планински условия.',
    keywords: ['климатик чепеларе', 'монтаж климатик чепеларе'],
    canonicalPath: '/klimatik-chepelare',
    ogImage: OG,
    bodyHtml: '<h1>Климатици Чепеларе</h1>',
  },
};

export function localBusinessSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HVACBusiness',
    '@id': `${SITE_ORIGIN}/#localbusiness`,
    name: LEGAL_COMPANY.tradeName,
    legalName: LEGAL_COMPANY.legalName,
    url: SITE_ORIGIN,
    image: absoluteUrl('/images/hero-new.jpg'),
    logo: absoluteUrl('/icon-192.png'),
    telephone: LEGAL_COMPANY.phoneE164,
    email: LEGAL_COMPANY.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: LEGAL_COMPANY.tradeAddress,
      addressLocality: 'Смолян',
      postalCode: LEGAL_COMPANY.postalCode,
      addressCountry: 'BG',
    },
    geo: { '@type': 'GeoCoordinates', latitude: 41.5685, longitude: 24.734 },
    areaServed: ['Смолян', 'Рудозем', 'Мадан', 'Девин', 'Чепеларе'].map((name) => ({ '@type': 'City', name })),
    sameAs: ['https://www.facebook.com/smolyanklima', 'https://www.instagram.com/smolyanklima'],
  };
}

export function webSiteSchema(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: SITE_ORIGIN,
    name: LEGAL_COMPANY.tradeName,
    inLanguage: 'bg-BG',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_ORIGIN}/catalog?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function productSchema(input: {
  name: string;
  brand: string;
  price: number;
  description: string;
  slug: string;
  image?: string;
  rating?: number;
  reviews?: number;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description,
    image: input.image?.startsWith('http') ? input.image : absoluteUrl(input.image || OG),
    sku: input.slug,
    brand: { '@type': 'Brand', name: input.brand },
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/product/${input.slug}`),
      priceCurrency: 'EUR',
      price: input.price,
      availability: 'https://schema.org/InStock',
    },
    ...(input.rating && input.reviews
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: input.rating, reviewCount: input.reviews } }
      : {}),
  };
}

export function resolveStaticPage(pathname: string): SeoPage | null {
  const path = pathname.split('?')[0].replace(/\/$/, '') || '/';
  return STATIC_PAGES[path] ?? LANDING_PAGES[path] ?? null;
}

export function productSeoFromRow(row: {
  slug: string;
  name: string;
  price: number;
  meta_title?: string | null;
  meta_description?: string | null;
  brands?: { name?: string } | null;
  product_types?: { name?: string } | null;
}): SeoPage {
  const brand = row.brands?.name ?? '—';
  const type = row.product_types?.name ?? 'Климатик';
  return {
    title: row.meta_title?.trim() || `${row.name} | ${brand} — €${row.price} | Смолян Клима`,
    description:
      row.meta_description?.trim()
      || `Купете ${row.name} (${brand}) в Смолян с монтаж и гаранция. ${type} — €${row.price}.`,
    canonicalPath: `/product/${row.slug}`,
    ogImage: OG,
    bodyHtml: `<h1>${row.name}</h1><p>${brand} · ${type} · €${row.price}</p>`,
  };
}
