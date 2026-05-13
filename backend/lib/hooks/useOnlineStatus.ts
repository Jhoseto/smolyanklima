"use client";

import { useEffect, useState } from "react";

/**
 * Реактивно следи дали браузърът е онлайн.
 *
 * Hydration safety:
 *   Винаги връща `true` при initial render (и на SSR, и на client),
 *   защото да четем `navigator.onLine` в useState инициализатора би
 *   създало mismatch между server HTML и client HTML, когато техникът
 *   зарежда страницата без мрежа. Реалната стойност се прилага в useEffect,
 *   след hydration — компонентите, които искат да реагират на offline,
 *   трябва да са подготвени за това (mounted gate или conditional rendering
 *   зад useEffect-задвижвано state).
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Windows/Chrome понякога оставят `navigator.onLine` грешен докато не се върне фокусът.
    window.addEventListener("focus", sync);
    window.addEventListener("pageshow", sync);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    document.addEventListener("visibilitychange", onVisible);
    // Sync веднага след монтиране — реалната стойност от браузъра.
    sync();
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("focus", sync);
      window.removeEventListener("pageshow", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return online;
}
