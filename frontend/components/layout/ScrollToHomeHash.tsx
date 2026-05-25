import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { scrollToHomeSection } from '../../lib/navigation/homeSections';

/** След SPA навигация към /#section — превърта до секцията на началната страница. */
export function ScrollToHomeHash() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (pathname !== '/') return;
    const sectionId = hash.replace(/^#/, '');
    if (!sectionId) return;

    let cancelled = false;
    let attempts = 0;

    const tryScroll = () => {
      if (cancelled) return;
      if (scrollToHomeSection(sectionId, 'auto')) return;
      attempts += 1;
      if (attempts < 30) requestAnimationFrame(tryScroll);
    };

    tryScroll();
    return () => {
      cancelled = true;
    };
  }, [pathname, hash]);

  return null;
}
