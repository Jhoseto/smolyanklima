import { absoluteUrl } from '../site';

export const DEFAULT_OG_IMAGE = '/images/hero-new.jpg';

export type PageSeoConfig = {
  title: string;
  description: string;
  keywords?: string[];
  canonicalPath: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  noindex?: boolean;
};

const REGION_KEYWORDS = [
  'климатик Смолян',
  'климатици Смолян',
  'монтаж климатик Смолян',
  'климатик Рудозем',
  'климатик Мадан',
  'климатик Девин',
  'климатик Чепеларе',
  'климатизация Родопи',
];

export const PAGE_SEO: Record<string, PageSeoConfig> = {
  home: {
    title: 'Климатици Смолян | Продажба, монтаж и сервиз — Смолян Клима',
    description:
      'Смолян Клима — официален магазин за климатици в Смолян. Продажба, професионален монтаж за 24–48 ч, гаранция и сервиз. Daikin, Mitsubishi, Fudjitsu, Toshiba. Обслужваме Смолян, Рудозем, Мадан, Девин и региона.',
    keywords: [...REGION_KEYWORDS, 'инверторен климатик', 'монтаж климатик цена', 'климатик на изплащане'],
    canonicalPath: '/',
    ogImage: DEFAULT_OG_IMAGE,
  },
  catalog: {
    title: 'Каталог климатици Смолян | Цени с монтаж — Смолян Клима',
    description:
      'Разгледайте пълния каталог климатици в Смолян — стенни, мулти-сплит, касетни. Филтри по BTU, марка и енергиен клас. Безплатна консултация и монтаж от лицензиран екип.',
    keywords: [...REGION_KEYWORDS, 'каталог климатици', 'климатик цена', 'BTU климатик'],
    canonicalPath: '/catalog',
  },
  services: {
    title: 'Монтаж, профилактика и сервиз на климатици Смолян | Смолян Клима',
    description:
      'Професионален монтаж на климатици в Смолян и региона, годишна профилактика, ремонт и сервиз на всички марки. Лицензирани техници, гаранция за изработката.',
    keywords: [...REGION_KEYWORDS, 'сервиз климатик', 'профилактика климатик', 'монтаж климатик'],
    canonicalPath: '/services',
  },
  contact: {
    title: 'Контакти — Смолян Клима | Магазин и монтаж климатици Смолян',
    description:
      'Свържете се със Смолян Клима — ул. „Наталия" 19, кв. Райково, Смолян. Тел. 0888 58 58 16. Безплатна консултация, оглед и оферта за климатик с монтаж.',
    keywords: [...REGION_KEYWORDS, 'Смолян Клима контакти', 'магазин климатици Смолян'],
    canonicalPath: '/contact',
  },
  about: {
    title: 'За нас — Смолян Клима | 25+ години опит в климатизацията',
    description:
      'Смолян Клима — семеен бизнес от 1990-те с над 3000 монтажа в Смолян, Рудозем, Мадан и Родопите. Оторизиран дилър, професионален монтаж и честна гаранция.',
    keywords: [...REGION_KEYWORDS, 'Смолян Клима', 'климатизация опит'],
    canonicalPath: '/za-nas',
    ogImage: '/images/about-hero.png',
  },
  privacy: {
    title: 'Политика за поверителност | Смолян Клима',
    description: 'Политика за поверителност и защита на личните данни на smolyanklima.com.',
    canonicalPath: '/politika-za-poveritelnost',
    noindex: true,
  },
  cookies: {
    title: 'Политика за бисквитки | Смолян Клима',
    description: 'Информация за бисквитки и проследяващи технологии на smolyanklima.com.',
    canonicalPath: '/biskvitki',
    noindex: true,
  },
  terms: {
    title: 'Общи условия | Смолян Клима',
    description: 'Общи условия за ползване на сайта и услугите на Смолян Клима ЕООД.',
    canonicalPath: '/obshti-usloviya',
    noindex: true,
  },
};

export function productSeo(product: {
  name: string;
  brand: string;
  type?: string;
  price: number;
  metaTitle?: string;
  metaDescription?: string;
  id: string;
  image?: string;
}): PageSeoConfig {
  const title =
    product.metaTitle?.trim() ||
    `${product.name} | ${product.brand} — €${product.price} | Смолян Клима`;
  const description =
    product.metaDescription?.trim() ||
    `Купете ${product.name} (${product.brand}) в Смолян с монтаж и гаранция. ${product.type ?? 'Климатик'} на цена €${product.price}. Безплатна консултация от Смолян Клима.`;
  return {
    title,
    description,
    keywords: [product.name, product.brand, 'климатик Смолян', product.type ?? 'климатик'].filter(Boolean),
    canonicalPath: `/product/${product.id}`,
    ogImage: product.image || DEFAULT_OG_IMAGE,
  };
}

export function absoluteCanonical(path: string): string {
  return absoluteUrl(path);
}

export type LandingSeoConfig = PageSeoConfig & {
  h1: string;
  lead: string;
  cityName?: string;
  sections: Array<{ title: string; body: string }>;
  relatedLinks?: Array<{ label: string; path: string }>;
};

export const LANDING_PAGE_SEO: Record<string, LandingSeoConfig> = {
  smolyan: {
    ...{
      title: 'Климатици Смолян | Продажба и монтаж — Смолян Клима',
      description: 'Купете климатик в Смолян с професионален монтаж и гаранция. Официален дилър Daikin, Mitsubishi, Fudjitsu, Toshiba. Магазин в кв. Райково.',
      keywords: ['климатик смолян', 'климатици смолян', 'магазин климатици смолян'],
      canonicalPath: '/klimatik-smolyan',
      ogImage: DEFAULT_OG_IMAGE,
    },
    h1: 'Климатици Смолян — продажба, монтаж и сервиз',
    lead: 'Официален магазин в кв. Райково с над 25 години опит и 10000+ монтажа в региона.',
    cityName: 'Смолян',
    sections: [
      {
        title: 'Защо Смолян Клима в Смолян?',
        body: 'Семеен бизнес с лицензиран монтажен екип, официална гаранция и сервиз на всички марки. Безплатен оглед и персонализирана оферта.',
      },
      {
        title: 'Марки и модели',
        body: 'Daikin, Mitsubishi Electric, Mitsubishi Heavy, Samsung, LG, Fujitsu, Gree, Panasonic и други — стенни, мулти-сплит и промишлени решения.',
      },
    ],
    relatedLinks: [
      { label: 'Монтаж Смолян', path: '/montaj-klimatik-smolyan' },
      { label: 'Рудозем', path: '/klimatik-rudozem' },
      { label: 'Мадан', path: '/klimatik-madan' },
    ],
  },
  rudozem: {
    title: 'Климатици Рудозем | Монтаж — Смолян Клима',
    description: 'Продажба и монтаж на климатици в Рудозем. Безплатен оглед от екипа на Смолян Клима.',
    keywords: ['климатик рудозем', 'монтаж климатик рудозем'],
    canonicalPath: '/klimatik-rudozem',
    ogImage: DEFAULT_OG_IMAGE,
    h1: 'Климатици Рудозем',
    lead: 'Монтаж и сервиз от Смолян Клима — идваме при вас в Рудозем и околността.',
    cityName: 'Рудозем',
    sections: [{ title: 'Услуги в Рудозем', body: 'Продажба, монтаж, профилактика и ремонт. Стандартен монтаж от ~€150.' }],
    relatedLinks: [{ label: 'Смолян', path: '/klimatik-smolyan' }, { label: 'Мадан', path: '/klimatik-madan' }],
  },
  madan: {
    title: 'Климатици Мадан | Монтаж — Смолян Клима',
    description: 'Климатици с монтаж в Мадан. Инверторни модели за планински климат.',
    keywords: ['климатик мадан', 'монтаж климатик мадан'],
    canonicalPath: '/klimatik-madan',
    ogImage: DEFAULT_OG_IMAGE,
    h1: 'Климатици Мадан',
    lead: 'Ефективно отопление и охлаждане за планински условия.',
    cityName: 'Мадан',
    sections: [{ title: 'Планински климат', body: 'Препоръчваме инверторни модели с добър SCOP за отопление през зимата.' }],
    relatedLinks: [{ label: 'Смолян', path: '/klimatik-smolyan' }, { label: 'Девин', path: '/klimatik-devin' }],
  },
  devin: {
    title: 'Климатици Девин | Монтаж — Смолян Клима',
    description: 'Климатици и монтаж в Девин — жилищни и търговски обекти.',
    keywords: ['климатик девин', 'монтаж климатик девин'],
    canonicalPath: '/klimatik-devin',
    ogImage: DEFAULT_OG_IMAGE,
    h1: 'Климатици Девин',
    lead: 'Решения за домове, хотели и SPA обекти в Девин.',
    cityName: 'Девин',
    sections: [{ title: 'Девин и околност', body: 'Монтаж и сервиз с гаранция от лицензиран екип базиран в Смолян.' }],
    relatedLinks: [{ label: 'Чепеларе', path: '/klimatik-chepelare' }, { label: 'Смолян', path: '/klimatik-smolyan' }],
  },
  chepelare: {
    title: 'Климатици Чепеларе | Монтаж — Смолян Клима',
    description: 'Климатици с монтаж в Чепеларе — ефективни модели за планина.',
    keywords: ['климатик чепеларе', 'монтаж климатик чепеларе'],
    canonicalPath: '/klimatik-chepelare',
    ogImage: DEFAULT_OG_IMAGE,
    h1: 'Климатици Чепеларе',
    lead: 'Климатизация за къщи, апартаменти и търговски обекти в Чепеларе.',
    cityName: 'Чепеларе',
    sections: [{ title: 'Ски зона и жилища', body: 'Подбор на мощност и монтаж съобразен с изложение и изолация.' }],
    relatedLinks: [{ label: 'Смолян', path: '/klimatik-smolyan' }, { label: 'Девин', path: '/klimatik-devin' }],
  },
  'montaj-smolyan': {
    title: 'Монтаж на климатик Смолян | Цени от €150 — Смолян Клима',
    description: 'Професионален монтаж на климатик в Смолян. Вакуумиране, гаранция, монтаж до 48 ч.',
    keywords: ['монтаж климатик смолян', 'монтаж климатик цена', 'инсталация климатик'],
    canonicalPath: '/montaj-klimatik-smolyan',
    ogImage: DEFAULT_OG_IMAGE,
    h1: 'Монтаж на климатик в Смолян',
    lead: 'Лицензиран екип, стандартен монтаж от ~€150, безплатен оглед.',
    cityName: 'Смолян',
    sections: [
      {
        title: 'Какво включва монтажът',
        body: 'До 3 m меден тръбен път, пробив, монтаж на блоковете, вакуумиране с помпа и пускане в експлоатация — задължително за валидна гаранция.',
      },
      {
        title: 'Срокове',
        body: 'При наличен климатик — монтаж до 48 часа след уговорка. Работим чисто и оставяме обекта подреден.',
      },
    ],
    relatedLinks: [{ label: 'Климатици Смолян', path: '/klimatik-smolyan' }, { label: 'Каталог', path: '/catalog' }],
  },
};
