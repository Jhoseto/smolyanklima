/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense } from 'react';
import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { PageTransition } from './components/layout/PageTransition';
import { Navbar } from './components/layout/Navbar';
import { HeroSection } from './components/sections/HeroSection';
import { FeaturesSection } from './components/sections/FeaturesSection';
import { ProductsSection } from './components/sections/ProductsSection';
import { ServicesSection } from './components/sections/ServicesSection';
import { StatsSection } from './components/sections/StatsSection';
import { TestimonialsSection } from './components/sections/TestimonialsSection';
import { ProjectsSection } from './components/sections/ProjectsSection';
import { ContactSection } from './components/sections/ContactSection';
import { ContactInfoSection } from './components/sections/ContactInfoSection';
import { FAQSection } from './components/sections/FAQSection';
import { BrandsSection } from './components/sections/BrandsSection';
import { Footer } from './components/layout/Footer';
import { GradientMeshMorphing, BokehOrbs, TechGrid } from './components/effects';
import { AIChatWidget } from './components/ai-assistant';

// Lazy load страници за по-бързо начално зареждане
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const BlogHomePage = lazy(() => import('./pages/BlogHomePage'));
const BlogArticlePage = lazy(() => import('./pages/BlogArticlePage'));
const AccessoryDetailsPage = lazy(() => import('./pages/AccessoryDetailsPage'));

// ── Главна страница ──────────────────────────────────
const HomePage = () => (
  <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#FF4D00]/20 selection:text-[#FF4D00]">
    <main>
      {/* Hero с Gradient Mesh — ефектът само на десктоп */}
      <section className="relative min-h-screen overflow-hidden">
        <div className="hidden md:block">
          <GradientMeshMorphing intensity="normal" />
        </div>
        <div className="relative z-10">
          <HeroSection />
        </div>
      </section>
      
      {/* Features с Tech Grid — ефектът само на десктоп */}
      <section className="relative overflow-hidden">
        <div className="hidden md:block">
          <TechGrid gridSize={80} />
        </div>
        <div className="relative z-10">
          <FeaturesSection />
        </div>
      </section>
      
      <ProductsSection />
      
      {/* Services с Bokeh Orbs — ефектът само на десктоп */}
      <section className="relative overflow-hidden bg-white/50">
        <div className="hidden md:block">
          <BokehOrbs orbCount={8} />
        </div>
        <div className="relative z-10">
          <ServicesSection />
        </div>
      </section>
      
      <StatsSection />
      <TestimonialsSection />
      <ProjectsSection />
      <ContactSection />
      <ContactInfoSection />
      <FAQSection />
    </main>
  </div>
);

// ── Loader за Suspense ────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 rounded-full border-4 border-[#00B4D8]/20 border-t-[#00B4D8] animate-spin" />
      <p className="text-gray-400 text-sm font-medium">Зареждане...</p>
    </div>
  </div>
);

function App() {
  const location = useLocation();

  return (
    <Suspense fallback={<PageLoader />}>
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes location={location}>
          <Route path="/" element={<PageTransition><HomePage /></PageTransition>} />
          <Route path="/catalog" element={<PageTransition><CatalogPage /></PageTransition>} />
          <Route path="/product/:id" element={<PageTransition><ProductDetailsPage /></PageTransition>} />
          <Route path="/contact" element={<PageTransition><ContactPage /></PageTransition>} />
          <Route path="/services" element={<PageTransition><ServicesPage /></PageTransition>} />
          <Route path="/blog" element={<PageTransition><BlogHomePage /></PageTransition>} />
          <Route path="/blog/kategoria/:slug" element={<PageTransition><BlogHomePage /></PageTransition>} />
          <Route path="/blog/tag/:slug" element={<PageTransition><BlogHomePage /></PageTransition>} />
          <Route path="/blog/tursi" element={<PageTransition><BlogHomePage /></PageTransition>} />
          <Route path="/blog/:slug" element={<PageTransition><BlogArticlePage /></PageTransition>} />
          <Route path="/aksesoari" element={<Navigate to="/catalog?tab=accessories" replace />} />
          <Route path="/aksesoar/:id" element={<PageTransition><AccessoryDetailsPage /></PageTransition>} />
          <Route path="*" element={<PageTransition><HomePage /></PageTransition>} />
        </Routes>
      </AnimatePresence>
      <Footer />
      
      {/* AI Assistant - Global on all pages */}
      <AIChatWidget 
        position="bottom-right"
        primaryColor="#00B4D8"
        accentColor="#FF4D00"
        welcomeMessage="Здравейте! Аз съм Вашият личен асистент от Смолян Клима. Как мога да помогна?"
        enableVoiceInput={true}
      />
    </Suspense>
  );
}

export default App;
