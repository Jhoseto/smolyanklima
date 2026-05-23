import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { CookieBanner } from '../../components/consent/CookieBanner';
import { CookieSettingsModal } from '../../components/consent/CookieSettingsModal';
import { initAnalyticsIfGranted, trackPageView } from '../analytics/gtag';
import { readConsent, writeConsent, ACCEPT_ALL, NECESSARY_ONLY } from './storage';
import type { ConsentPreferences, CookieConsent } from './types';

interface ConsentContextValue {
  consent: CookieConsent | null;
  hasAnswered: boolean;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  savePreferences: (prefs: ConsentPreferences) => void;
  openSettings: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

function applyConsent(prefs: ConsentPreferences): CookieConsent {
  const saved = writeConsent(prefs);
  void initAnalyticsIfGranted(prefs);
  window.dispatchEvent(new CustomEvent('sk-consent-updated', { detail: saved }));
  return saved;
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<CookieConsent | null>(() => readConsent());
  const [showBanner, setShowBanner] = useState(() => readConsent() === null);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const stored = readConsent();
    if (stored) {
      void initAnalyticsIfGranted(stored);
    }
  }, []);

  const savePreferences = useCallback((prefs: ConsentPreferences) => {
    const saved = applyConsent(prefs);
    setConsent(saved);
    setShowBanner(false);
    setShowSettings(false);
  }, []);

  const acceptAll = useCallback(() => savePreferences(ACCEPT_ALL), [savePreferences]);
  const rejectNonEssential = useCallback(() => savePreferences(NECESSARY_ONLY), [savePreferences]);

  const openSettings = useCallback(() => {
    setShowSettings(true);
    setShowBanner(false);
  }, []);

  useEffect(() => {
    const handler = () => setShowSettings(true);
    window.addEventListener('sk-open-cookie-settings', handler);
    return () => window.removeEventListener('sk-open-cookie-settings', handler);
  }, []);

  const value = useMemo<ConsentContextValue>(
    () => ({
      consent,
      hasAnswered: consent !== null,
      functional: consent?.functional ?? false,
      analytics: consent?.analytics ?? false,
      marketing: consent?.marketing ?? false,
      acceptAll,
      rejectNonEssential,
      savePreferences,
      openSettings,
    }),
    [consent, acceptAll, rejectNonEssential, savePreferences, openSettings],
  );

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {showBanner && (
        <CookieBanner
          onAcceptAll={acceptAll}
          onReject={rejectNonEssential}
          onOpenSettings={() => {
            setShowBanner(false);
            setShowSettings(true);
          }}
        />
      )}
      {showSettings && (
        <CookieSettingsModal
          initial={{
            functional: consent?.functional ?? false,
            analytics: consent?.analytics ?? false,
            marketing: consent?.marketing ?? false,
          }}
          onSave={savePreferences}
          onClose={() => {
            setShowSettings(false);
            if (!consent) setShowBanner(true);
          }}
        />
      )}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('useConsent must be used within ConsentProvider');
  return ctx;
}

export function useConsentOptional(): ConsentContextValue | null {
  return useContext(ConsentContext);
}

/** Tracks SPA page views when analytics consent is granted. */
export function AnalyticsPageTracker({ pathname }: { pathname: string }) {
  const { analytics } = useConsent();

  useEffect(() => {
    if (!analytics) return;
    trackPageView(pathname);
  }, [analytics, pathname]);

  return null;
}
