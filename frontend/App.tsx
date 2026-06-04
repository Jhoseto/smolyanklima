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
import { SiteSeo } from './components/seo/SiteSeo';
import { PAGE_SEO } from './lib/seo/config';
import { faqPageSchema, localBusinessSchema, webSiteSchema } from './lib/seo/jsonLd';
import { HOME_FAQS } from './data/seo/faqs';
import { BokehOrbs } from './components/effects';
import { HeroBackground } from './components/sections/HeroBackground';
import { AIChatWidget } from './components/ai-assistant';
import { LiveChatWidget } from './components/live-chat/LiveChatWidget';
import { AnalyticsPageTracker } from './lib/consent/ConsentProvider';
import { ScrollToHomeHash } from './components/layout/ScrollToHomeHash';

// Lazy load страници за по-бързо начално зареждане
const CatalogPage = lazy(() => import('./pages/CatalogPage'));
const ProductDetailsPage = lazy(() => import('./pages/ProductDetailsPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const MountPage = lazy(() => import('./pages/MountPage'));
const BlogHomePage = lazy(() => import('./pages/BlogHomePage'));
const BlogArticlePage = lazy(() => import('./pages/BlogArticlePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const AccessoryDetailsPage = lazy(() => import('./pages/AccessoryDetailsPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const CookiePolicyPage = lazy(() => import('./pages/CookiePolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const RegionalLandingPage = lazy(() => import('./pages/RegionalLandingPage'));

// ── Главна страница ──────────────────────────────────
const HomePage = ({ onOpenAssistantChat }: { onOpenAssistantChat?: () => void }) => (
  <div className="min-h-screen bg-[#FAFAFA] font-sans selection:bg-[#FF4D00]/20 selection:text-[#FF4D00]">
    <SiteSeo
      config={PAGE_SEO.home}
      schemas={[localBusinessSchema(), webSiteSchema(), faqPageSchema(HOME_FAQS)]}
    />
    <main>
      {/* Hero с Gradient Mesh — ефектът само на десктоп */}
      <section className="relative min-h-[100dvh] overflow-hidden">
        <HeroBackground />
        <div className="relative z-10 flex min-h-[100dvh] flex-col">
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
      <FAQSection />
      <ContactSection />
      <ContactInfoSection />
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
const LIVE_API = import.meta.env.VITE_API_BASE_URL ?? "";

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

function clearLiveChatSession() {
  try {
    localStorage.removeItem(LIVE_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const [liveChat, setLiveChat] = useState<{ open: boolean; context?: Array<{ role: 'user' | 'assistant'; content: string }> }>({ open: false });
  const [assistantOpenSignal, setAssistantOpenSignal] = useState(0);
  const [liveUnread, setLiveUnread] = useState(0);
  const [hasLiveSession, setHasLiveSession] = useState(() => !!loadLiveChatSession());
  const lastInboundMsgCountRef = useRef(-1);

  // Изчиства мъртва live chat сесия в localStorage (404 spam в лога).
  useEffect(() => {
    const session = loadLiveChatSession();
    if (!session) return;
    void fetch(`${LIVE_API}/api/chat/${session.chatId}`, {
      headers: { "Content-Type": "application/json", "X-Chat-Session-Token": session.sessionToken },
    }).then((res) => {
      if (!res.ok) {
        clearLiveChatSession();
        setHasLiveSession(false);
      }
    }).catch(() => { /* ignore */ });
  }, []);

  // Background polling — when widget is minimized but session is active.
  // GET /api/chat/[id] also runs inactivity checks server-side (no SSE needed).
  useEffect(() => {
    if (liveChat.open) {
      lastInboundMsgCountRef.current = -1;
      return;
    }
    const session = loadLiveChatSession();
    if (!session) {
      setHasLiveSession(false);
      return;
    }
    setHasLiveSession(true);

    let stopped = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stopPolling = () => {
      stopped = true;
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const poll = async () => {
      if (stopped || (typeof document !== "undefined" && document.hidden)) return;
      try {
        const res = await fetch(`${LIVE_API}/api/chat/${session.chatId}`, {
          headers: { "Content-Type": "application/json", "X-Chat-Session-Token": session.sessionToken },
        });
        if (!res.ok) {
          clearLiveChatSession();
          setHasLiveSession(false);
          stopPolling();
          return;
        }
        const data = await res.json();
        const inboundCount = (data.messages ?? []).filter(
          (m: { sender_role: string }) => m.sender_role === "admin" || m.sender_role === "system",
        ).length;
        if (lastInboundMsgCountRef.current >= 0 && inboundCount > lastInboundMsgCountRef.current) {
          const newMsgs = inboundCount - lastInboundMsgCountRef.current;
          setLiveUnread((prev) => prev + newMsgs);
          playBgNotificationSound();
          setLiveChat((prev) => ({ ...prev, open: true }));
        }
        lastInboundMsgCountRef.current = inboundCount;
        if (data.chat?.status === "closed") {
          clearLiveChatSession();
          setHasLiveSession(false);
          stopPolling();
        }
      } catch {
        /* network error, ignore */
      }
    };

    void poll();
    timer = setInterval(() => void poll(), 15_000);

    const onVisibility = () => {
      if (!document.hidden && !stopped) void poll();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [liveChat.open]);

  const openAssistantFromHero = () => {
    setLiveChat({ open: false });
    setAssistantOpenSignal((n) => n + 1);
  };

  const pagePath = location.pathname + location.search;

  return (
    <Suspense fallback={<PageLoader />}>
      <AnalyticsPageTracker pathname={pagePath} />
      <ScrollToHomeHash />
      <Navbar />
      <AnimatePresence mode="wait">
        <Routes location={location}>
          <Route path="/" element={<PageTransition><HomePage onOpenAssistantChat={openAssistantFromHero} /></PageTransition>} />
          <Route path="/catalog" element={<PageTransition><CatalogPage /></PageTransition>} />
          <Route path="/product/:id" element={<PageTransition><ProductDetailsPage /></PageTransition>} />
          <Route path="/contact" element={<PageTransition><ContactPage /></PageTransition>} />
          <Route path="/services" element={<PageTransition><ServicesPage /></PageTransition>} />
          <Route path="/montaz" element={<PageTransition><MountPage /></PageTransition>} />
          <Route path="/za-nas" element={<PageTransition><AboutPage /></PageTransition>} />
          <Route path="/blog" element={<PageTransition><BlogHomePage /></PageTransition>} />
          <Route path="/blog/kategoria/:slug" element={<PageTransition><BlogHomePage /></PageTransition>} />
          <Route path="/blog/tag/:slug" element={<PageTransition><BlogHomePage /></PageTransition>} />
          <Route path="/blog/tursi" element={<PageTransition><BlogHomePage /></PageTransition>} />
          <Route path="/blog/:slug" element={<PageTransition><BlogArticlePage /></PageTransition>} />
          <Route path="/aksesoari" element={<Navigate to="/catalog?tab=accessories" replace />} />
          <Route path="/aksesoar/:id" element={<PageTransition><AccessoryDetailsPage /></PageTransition>} />
          <Route path="/politika-za-poveritelnost" element={<PageTransition><PrivacyPolicyPage /></PageTransition>} />
          <Route path="/biskvitki" element={<PageTransition><CookiePolicyPage /></PageTransition>} />
          <Route path="/obshti-usloviya" element={<PageTransition><TermsPage /></PageTransition>} />
          <Route path="/klimatik-smolyan" element={<PageTransition><RegionalLandingPage slug="smolyan" /></PageTransition>} />
          <Route path="/klimatik-rudozem" element={<PageTransition><RegionalLandingPage slug="rudozem" /></PageTransition>} />
          <Route path="/klimatik-madan" element={<PageTransition><RegionalLandingPage slug="madan" /></PageTransition>} />
          <Route path="/klimatik-devin" element={<PageTransition><RegionalLandingPage slug="devin" /></PageTransition>} />
          <Route path="/klimatik-chepelare" element={<PageTransition><RegionalLandingPage slug="chepelare" /></PageTransition>} />
          <Route path="/montaj-klimatik-smolyan" element={<PageTransition><RegionalLandingPage slug="montaj-smolyan" /></PageTransition>} />
          <Route path="*" element={<PageTransition><NotFoundPage /></PageTransition>} />
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
            onNavigate={(productId) => navigate(`/product/${productId}`)}
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
