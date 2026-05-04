/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { Routes, Route, useLocation, Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { PageTransition } from './components/layout/PageTransition';
import { Navbar } from './components/layout/Navbar';
import { HeroSection } from './components/sections/HeroSection';
import { SmartAdvisorSection } from './components/sections/SmartAdvisor';
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
import { GradientMeshMorphing, BokehOrbs } from './components/effects';
import { AIChatWidget } from './components/ai-assistant';
import { LiveChatWidget } from './components/live-chat/LiveChatWidget';

// Lazy load страници за по-бързо начално зареждане
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const BlogHomePage = lazy(() => import('./pages/BlogHomePage'));
const BlogArticlePage = lazy(() => import('./pages/BlogArticlePage'));
const AccessoryDetailsPage = lazy(() => import('./pages/AccessoryDetailsPage'));

// ── Главна страница ──────────────────────────────────
const HomePage = ({ onOpenAssistantChat }: { onOpenAssistantChat?: () => void }) => (
  <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#FF4D00]/20 selection:text-[#FF4D00]">
    <main>
      {/* Hero с Gradient Mesh — ефектът само на десктоп */}
      <section className="relative min-h-screen overflow-hidden">
        <div className="hidden md:block">
          <GradientMeshMorphing intensity="normal" />
        </div>
        <div className="relative z-10">
          <HeroSection onFreeConsultationClick={onOpenAssistantChat} />
        </div>
      </section>
      
      {/* Smart Advisor — замества FeaturesSection */}
      <SmartAdvisorSection onOpenChat={onOpenAssistantChat} />
      
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

const LIVE_SESSION_KEY = "smolyan-klima-live-chat-v1";
const LIVE_API = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";

function loadLiveChatSession() {
  try {
    const raw = localStorage.getItem(LIVE_SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p?.chatId && p?.sessionToken ? p as { chatId: string; sessionToken: string } : null;
  } catch { return null; }
}

function playBgNotificationSound() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
  } catch { /* autoplay policy */ }
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [liveChat, setLiveChat] = useState<{ open: boolean; context?: Array<{ role: 'user' | 'assistant'; content: string }> }>({ open: false });
  const [assistantOpenSignal, setAssistantOpenSignal] = useState(0);
  const [liveUnread, setLiveUnread] = useState(0);
  const [hasLiveSession, setHasLiveSession] = useState(() => !!loadLiveChatSession());
  const lastAdminMsgCountRef = useRef(-1);

  // Background polling — when widget is minimized but session is active
  useEffect(() => {
    if (liveChat.open) { lastAdminMsgCountRef.current = -1; return; }
    const session = loadLiveChatSession();
    if (!session) { setHasLiveSession(false); return; }
    setHasLiveSession(true);

    const poll = async () => {
      try {
        const res = await fetch(`${LIVE_API}/api/chat/${session.chatId}`, {
          headers: { "Content-Type": "application/json", "X-Chat-Session-Token": session.sessionToken },
        });
        if (!res.ok) { setHasLiveSession(false); return; }
        const data = await res.json();
        if (data.chat?.status === "closed") { setHasLiveSession(false); return; }
        const adminCount = (data.messages ?? []).filter((m: { sender_role: string }) => m.sender_role === "admin").length;
        if (lastAdminMsgCountRef.current >= 0 && adminCount > lastAdminMsgCountRef.current) {
          const newMsgs = adminCount - lastAdminMsgCountRef.current;
          setLiveUnread(prev => prev + newMsgs);
          playBgNotificationSound();
        }
        lastAdminMsgCountRef.current = adminCount;
      } catch { /* network error, ignore */ }
    };

    poll();
    const timer = setInterval(poll, 5_000);
    return () => clearInterval(timer);
  }, [liveChat.open]);

  const openAssistantFromHero = () => {
    setLiveChat({ open: false });
    setAssistantOpenSignal((n) => n + 1);
  };

  return (
    <Suspense fallback={<PageLoader />}>
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes location={location}>
          <Route path="/" element={<PageTransition><HomePage onOpenAssistantChat={openAssistantFromHero} /></PageTransition>} />
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
          <Route path="*" element={<PageTransition><HomePage onOpenAssistantChat={openAssistantFromHero} /></PageTransition>} />
        </Routes>
      </AnimatePresence>
      <Footer />

      {/* Live Chat Widget — показва се вместо AI при прехвърляне */}
      {liveChat.open ? (
        <div
          style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999, width: 380, maxWidth: 'calc(100vw - 40px)', height: 580, borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 70px rgba(15,23,42,0.18)', border: '1px solid rgba(226,232,240,0.8)' }}
        >
          {/* Unread badge while chat is in background */}
          {liveUnread > 0 && (
            <div
              onClick={() => setLiveUnread(0)}
              style={{ position: 'absolute', top: -8, right: -8, zIndex: 10, backgroundColor: '#ef4444', color: 'white', fontSize: 11, fontWeight: 700, minWidth: 20, height: 20, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px', border: '2px solid white', cursor: 'pointer' }}
            >
              {liveUnread}
            </div>
          )}
          <LiveChatWidget
            aiContext={liveChat.context}
            onClose={() => { setLiveChat({ open: false }); setLiveUnread(0); }}
            onNavigate={(slug) => navigate(`/product/${slug}`)}
            onUnreadChange={setLiveUnread}
          />
        </div>
      ) : (
        <AIChatWidget
          position="bottom-right"
          primaryColor="#00B4D8"
          accentColor="#FF4D00"
          welcomeMessage="Здравейте! Аз съм Вашият личен асистент от Смолян Клима. Как мога да помогна?"
          enableVoiceInput={true}
          liveUnread={liveUnread}
          hasActiveLiveSession={hasLiveSession}
          openSignal={assistantOpenSignal}
          onRequestLiveChat={(context) => { setLiveChat({ open: true, context }); setLiveUnread(0); }}
        />
      )}
    </Suspense>
  );
}

export default App;
