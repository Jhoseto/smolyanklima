import { LEGAL_COMPANY } from '../../data/legal/company';
import type { CatalogProduct } from '../../data/types/product';
import { absoluteUrl, SITE_ORIGIN } from '../site';
import type { PageSeoConfig } from './config';

export type JsonLd = Record<string, unknown>;

export function localBusinessSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'HVACBusiness',
    '@id': `${SITE_ORIGIN}/#localbusiness`,
    name: LEGAL_COMPANY.tradeName,
    legalName: LEGAL_COMPANY.legalName,
    url: SITE_ORIGIN,
    image: absoluteUrl('/images/hero-new.jpg'),
    logo: absoluteUrl('/icon-192.png'),
    description:
      'Продажба, монтаж, профилактика и сервиз на климатици в Смолян и региона. Оторизиран дилър на Daikin, Mitsubishi, Samsung и други марки.',
    telephone: LEGAL_COMPANY.phoneE164,
    email: LEGAL_COMPANY.email,
    priceRange: '€€',
    currenciesAccepted: 'EUR, BGN',
    paymentAccepted: 'Cash, Credit Card, Bank Transfer',
    address: {
      '@type': 'PostalAddress',
      streetAddress: LEGAL_COMPANY.tradeAddress,
      addressLocality: 'Смолян',
      addressRegion: 'Смолян',
      postalCode: LEGAL_COMPANY.postalCode,
      addressCountry: 'BG',
    },
    geo: {
      '@type': 'GeoCoordinates',
      latitude: 41.5685,
      longitude: 24.734,
    },
    areaServed: [
      { '@type': 'City', name: 'Смолян' },
      { '@type': 'City', name: 'Рудозем' },
      { '@type': 'City', name: 'Мадан' },
      { '@type': 'City', name: 'Девин' },
      { '@type': 'City', name: 'Чепеларе' },
      { '@type': 'AdministrativeArea', name: 'Област Смолян' },
    ],
    openingHoursSpecification: [
      { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], opens: '09:00', closes: '18:00' },
      { '@type': 'OpeningHoursSpecification', dayOfWeek: 'Saturday', opens: '09:00', closes: '14:00' },
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: LEGAL_COMPANY.phoneE164,
      contactType: 'customer service',
      areaServed: 'BG',
      availableLanguage: ['Bulgarian'],
    },
    sameAs: [
      'https://www.facebook.com/smolyanklima',
      'https://www.instagram.com/smolyanklima',
    ],
  };
}

export function webSiteSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_ORIGIN}/#website`,
    url: SITE_ORIGIN,
    name: LEGAL_COMPANY.tradeName,
    description: 'Официален сайт на Смолян Клима — климатици, монтаж и сервиз в Смолян.',
    inLanguage: 'bg-BG',
    publisher: { '@id': `${SITE_ORIGIN}/#localbusiness` },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_ORIGIN}/catalog?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function faqPageSchema(faqs: ReadonlyArray<{ question: string; answer: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function productSchema(product: CatalogProduct, seo: PageSeoConfig): JsonLd {
  const imageUrl = product.image?.startsWith('http') ? product.image : absoluteUrl(product.image || '/images/hero-new.jpg');
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: seo.description,
    image: imageUrl,
    sku: product.id,
    brand: { '@type': 'Brand', name: product.brand },
    category: product.type || 'Климатик',
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(seo.canonicalPath),
      priceCurrency: 'EUR',
      price: product.price,
      availability: 'https://schema.org/InStock',
      seller: { '@id': `${SITE_ORIGIN}/#localbusiness` },
    },
    ...(product.rating > 0 && product.reviews > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.rating,
            reviewCount: product.reviews,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    ...(product.coolingKw || product.seer
      ? {
          additionalProperty: [
            product.coolingKw ? { '@type': 'PropertyValue', name: 'Cooling power (kW)', value: product.coolingKw } : null,
            product.seer ? { '@type': 'PropertyValue', name: 'SEER', value: product.seer } : null,
            product.scop ? { '@type': 'PropertyValue', name: 'SCOP', value: product.scop } : null,
            product.coverageM2 ? { '@type': 'PropertyValue', name: 'Coverage (m²)', value: product.coverageM2 } : null,
          ].filter(Boolean),
        }
      : {}),
  };
}

export function serviceSchema(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    serviceType: 'Монтаж и сервиз на климатици',
    provider: { '@id': `${SITE_ORIGIN}/#localbusiness` },
    areaServed: { '@type': 'AdministrativeArea', name: 'Област Смолян' },
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: 'Услуги Смолян Клима',
      itemListElement: [
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Монтаж на климатик' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Профилактика на климатик' } },
        { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Сервиз и ремонт на климатик' } },
      ],
    },
  };
}
