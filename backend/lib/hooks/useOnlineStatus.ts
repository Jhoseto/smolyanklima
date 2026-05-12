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
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Sync веднага след монтиране — реалната стойност от браузъра.
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return online;
}
