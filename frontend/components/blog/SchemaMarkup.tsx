import React from 'react';
import type { Article } from '../../data/blog';
import { LEGAL_COMPANY } from '../../data/legal/company';
import { absoluteUrl, SITE_ORIGIN } from '../../lib/site';

interface FAQItem {
  question: string;
  answer: string;
}

interface SchemaMarkupProps {
  article?: Article;
  type: 'article' | 'breadcrumb' | 'faqpage' | 'organization';
  breadcrumbs?: { name: string; url: string }[];
  faqs?: FAQItem[];
}

export const SchemaMarkup: React.FC<SchemaMarkupProps> = ({ 
  article, 
  type,
  breadcrumbs = [],
  faqs = []
}) => {
  const generateSchema = () => {
    switch (type) {
      case 'article':
        return {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: article.title,
          description: article.excerpt,
          image: [article.featuredImage],
          datePublished: article.publishedAt,
          dateModified: article.modifiedAt,
          author: {
            '@type': 'Person',
            name: article.schema.author.name,
            url: absoluteUrl(article.schema.author.url)
          },
          publisher: {
            '@type': 'Organization',
            name: 'Smolyan Klima',
            url: SITE_ORIGIN,
            logo: {
              '@type': 'ImageObject',
              url: absoluteUrl('/icon-192.png')
            }
          },
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': absoluteUrl(`/blog/${article.slug}`)
          }
        };

      case 'breadcrumb':
        return {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Начало',
              item: absoluteUrl('/')
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Блог',
              item: absoluteUrl('/blog')
            },
            ...breadcrumbs.map((crumb, index) => ({
              '@type': 'ListItem',
              position: index + 3,
              name: crumb.name,
              item: absoluteUrl(crumb.url)
            }))
          ]
        };

      case 'faqpage':
        return {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer
            }
          }))
        };

      case 'organization':
        return {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Smolyan Klima',
          url: SITE_ORIGIN,
          logo: absoluteUrl('/logo.png'),
          description: 'Специализиран магазин за климатици в Смолян - продажба, монтаж и сервиз на климатични системи.',
          address: {
            '@type': 'PostalAddress',
            streetAddress: LEGAL_COMPANY.tradeAddress,
            addressLocality: 'Смолян',
            postalCode: LEGAL_COMPANY.postalCode,
            addressCountry: 'BG'
          },
          contactPoint: {
            '@type': 'ContactPoint',
            telephone: LEGAL_COMPANY.phoneE164,
            email: LEGAL_COMPANY.email,
            contactType: 'sales',
            areaServed: 'BG',
            availableLanguage: 'Bulgarian'
          },
          sameAs: [
            'https://facebook.com/smolyanklima',
            'https://instagram.com/smolyanklima'
          ]
        };

      default:
        return null;
    }
  };

  const schema = generateSchema();
  if (!schema) return null;

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
};

// Meta Tags Component
interface SEOMetaTagsProps {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  ogType?: 'website' | 'article';
  canonicalUrl?: string;
  robots?: string;
}

export const SEOMetaTags: React.FC<SEOMetaTagsProps> = ({
  title,
  description,
  keywords = [],
  ogImage = '/images/og-default.jpg',
  ogType = 'website',
  canonicalUrl,
  robots = 'index, follow',
}) => {
  return (
    <>
      {/* Basic Meta */}
      <title>{title}</title>
      <meta name="description" content={description} />
      {keywords.length > 0 && <meta name="keywords" content={keywords.join(', ')} />}
      
      {/* Canonical */}
      {canonicalUrl && <link rel="canonical" href={absoluteUrl(canonicalUrl)} />}
      
      {/* Open Graph */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonicalUrl ? absoluteUrl(canonicalUrl) : SITE_ORIGIN} />
      <meta property="og:image" content={absoluteUrl(ogImage)} />
      <meta property="og:site_name" content="Smolyan Klima" />
      <meta property="og:locale" content="bg_BG" />
      
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={absoluteUrl(ogImage)} />
      
      {/* Robots */}
      <meta name="robots" content={robots} />
      
      {/* RSS Feed */}
      <link rel="alternate" type="application/rss+xml" title="Smolyan Klima Blog" href={absoluteUrl('/rss.xml')} />
      
      {/* Preconnect for performance */}
      <link rel="preconnect" href="https://images.unsplash.com" />
      <link rel="dns-prefetch" href="https://images.unsplash.com" />
    </>
  );
};
