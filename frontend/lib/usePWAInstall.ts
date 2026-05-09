import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const IOS_BANNER_DISMISS_KEY = 'pwa-ios-hint-dismiss';

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOSLike(): boolean {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
}

/**
 * Android/Desktop Chromium: `beforeinstallprompt` + install диалог.
 * iPhone/iPad: няма API — показваме същия банер в hero и модал със стъпки „Добавяне към началния екран“.
 */
export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [chromiumInstallable, setChromiumInstallable] = useState(false);
  const [iosBannerVisible, setIosBannerVisible] = useState(false);
  const [iosGuideOpen, setIosGuideOpen] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) return;

    let iosDismissed = false;
    try {
      iosDismissed = sessionStorage.getItem(IOS_BANNER_DISMISS_KEY) === '1';
    } catch {
      /* private mode */
    }

    if (!iosDismissed && isIOSLike()) {
      setIosBannerVisible(true);
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setChromiumInstallable(true);
    };

    const onAppInstalled = () => {
      setChromiumInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const promptChromiumInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setChromiumInstallable(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const dismissIosBanner = useCallback(() => {
    try {
      sessionStorage.setItem(IOS_BANNER_DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setIosBannerVisible(false);
    setIosGuideOpen(false);
  }, []);

  const openIosGuide = useCallback(() => setIosGuideOpen(true), []);
  const closeIosGuide = useCallback(() => setIosGuideOpen(false), []);

  const standalone = typeof window !== 'undefined' && isStandaloneDisplay();
  const showHeroBanner =
    typeof window !== 'undefined' && !standalone && (chromiumInstallable || iosBannerVisible);

  const heroUsesChromiumPrompt = chromiumInstallable;

  const onHeroBannerActivate = useCallback(async () => {
    if (deferredPrompt) await promptChromiumInstall();
    else openIosGuide();
  }, [deferredPrompt, promptChromiumInstall, openIosGuide]);

  return {
    showHeroBanner,
    heroUsesChromiumPrompt,
    iosGuideOpen,
    dismissIosBanner,
    closeIosGuide,
    onHeroBannerActivate,
  };
}
