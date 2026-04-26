import React, { useEffect } from 'react';
import { ContactSection } from '../components/sections/ContactSection';
import { ContactInfoSection } from '../components/sections/ContactInfoSection';

export default function ContactPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      <main className="pt-20">
        <ContactInfoSection />
        <ContactSection hideTitle={true} />
      </main>
    </div>
  );
}
