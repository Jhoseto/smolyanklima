import React, { useEffect } from 'react';
import { ContactSection } from '../components/sections/ContactSection';
import { ContactInfoSection } from '../components/sections/ContactInfoSection';
import { SiteSeo } from '../components/seo/SiteSeo';
import { PAGE_SEO } from '../lib/seo/config';
import { breadcrumbSchema, localBusinessSchema } from '../lib/seo/jsonLd';

export default function ContactPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      <SiteSeo
        config={PAGE_SEO.contact}
        schemas={[
          localBusinessSchema(),
          breadcrumbSchema([
            { name: 'Начало', path: '/' },
            { name: 'Контакти', path: '/contact' },
          ]),
        ]}
      />
      <main className="pt-20">
        <ContactInfoSection />
        <ContactSection hideTitle={true} />
      </main>
    </div>
  );
}
