import React, { useEffect } from 'react';
import { ServicesSection } from '../components/sections/ServicesSection';

export default function ServicesPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans">
      <main className="pt-20">
        <ServicesSection />
      </main>
    </div>
  );
}
