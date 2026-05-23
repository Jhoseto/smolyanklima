import React, { useEffect } from 'react';
import { ServicesSection } from '../components/sections/ServicesSection';
import { SiteSeo } from '../components/seo/SiteSeo';
import { PAGE_SEO } from '../lib/seo/config';
import { breadcrumbSchema, localBusinessSchema, serviceSchema } from '../lib/seo/jsonLd';

export default function ServicesPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      <SiteSeo
        config={PAGE_SEO.services}
        schemas={[
          localBusinessSchema(),
          serviceSchema(),
          breadcrumbSchema([
            { name: 'Начало', path: '/' },
            { name: 'Услуги', path: '/services' },
          ]),
        ]}
      />
      <main className="pt-20">
        <ServicesSection />
      </main>
    </div>
  );
}
