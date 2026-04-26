/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Navbar } from './components/layout/Navbar';
import { HeroSection } from './components/sections/HeroSection';
import { FeaturesSection } from './components/sections/FeaturesSection';
import { ProductsSection } from './components/sections/ProductsSection';
import { ServicesSection } from './components/sections/ServicesSection';
import { StatsSection } from './components/sections/StatsSection';
import { TestimonialsSection } from './components/sections/TestimonialsSection';
import { ProjectsSection } from './components/sections/ProjectsSection';
import { ContactSection } from './components/sections/ContactSection';
import { FAQSection } from './components/sections/FAQSection';
import { Footer } from './components/layout/Footer';

function App() {
  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#FF4D00]/20 selection:text-[#FF4D00]">
      <Navbar />
      
      <main>
        <HeroSection />
        <FeaturesSection />
        <ProductsSection />
        <ServicesSection />
        <StatsSection />
        <TestimonialsSection />
        <ProjectsSection />
        <ContactSection />
        <FAQSection />
      </main>

      <Footer />
    </div>
  );
}

export default App;
