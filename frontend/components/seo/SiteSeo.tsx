import React from 'react';
import { SEOMetaTags } from '../blog/SchemaMarkup';
import { absoluteUrl } from '../../lib/site';
import type { PageSeoConfig } from '../../lib/seo/config';
import type { JsonLd } from '../../lib/seo/jsonLd';

function JsonLdScript({ data }: { data: JsonLd }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export interface SiteSeoProps {
  config: PageSeoConfig;
  schemas?: JsonLd[];
}

/** Unified SEO head tags + JSON-LD for non-blog pages. */
export const SiteSeo: React.FC<SiteSeoProps> = ({ config, schemas = [] }) => {
  return (
    <>
      <SEOMetaTags
        title={config.title}
        description={config.description}
        keywords={config.keywords}
        ogImage={config.ogImage}
        ogType={config.ogType}
        canonicalUrl={config.canonicalPath}
        robots={config.noindex ? 'noindex, follow' : 'index, follow'}
      />
      <link rel="alternate" hrefLang="bg" href={absoluteUrl(config.canonicalPath)} />
      <link rel="alternate" hrefLang="x-default" href={absoluteUrl(config.canonicalPath)} />
      {schemas.map((schema, i) => (
        <JsonLdScript key={i} data={schema} />
      ))}
    </>
  );
};
