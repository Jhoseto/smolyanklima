"use client";

import { useEffect, type ReactNode } from "react";
import { bootstrapOfflineQueue } from "@/lib/offline/sync";
import { OfflineQueueProvider } from "@/lib/hooks/useOfflineQueue";

/**
 * Обвива децата с `OfflineQueueProvider` и при mount:
 *   1) изчиства "syncing" мутации, останали зомби от убит tab/SW (P3)
 *   2) изтрива стари clean cached документи (P11)
 *   3) регистрира service worker-а (scope=/admin/) — нужен за push известия
 *      и Background Sync API
 *
 * Държим всичко в един "use client" компонент, за да минимизираме client
 * boundary-та в admin layout-а.
 */
/**
 * Public site SW (scope /) cache-first-ва /_next/*.js. След deploy старият bundle +
 * нов HTML → React hydration #418 на всеки admin link. Премахваме го в admin контекст.
 */
async function dropPublicSiteSwPoison(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        const scriptUrl =
          reg.active?.scriptURL ?? reg.installing?.scriptURL ?? reg.waiting?.scriptURL ?? "";
        if (scriptUrl.endsWith("/sw.js")) {
          await reg.unregister();
        }
      }
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      for (const key of keys.filter((k) => k.startsWith("sk-public-"))) {
        const cache = await caches.open(key);
        const reqs = await cache.keys();
        await Promise.all(
          reqs
            .filter((r) => {
              const p = new URL(r.url).pathname;
              return p.startsWith("/_next/") || p.startsWith("/admin") || p === "/login";
            })
            .map((r) => cache.delete(r)),
        );
      }
    }
  } catch {
    /* ignore */
  }
}

export function OfflineBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 0. Public SW must not cache Next admin bundles (production hydration #418)
    void dropPublicSiteSwPoison();

    // 1. Recovery + cleanup на offline опашката (idempotent)
    void bootstrapOfflineQueue();

    // 2. Регистрация на Service Worker
    if (!("serviceWorker" in navigator)) return;

    (async () => {
      try {
        const reg = await navigator.serviceWorker.register("/admin/sw-admin.js", { scope: "/admin/" });
        await reg.update().catch(() => { /* ignore */ });

        // Background Sync API — Android Chrome автоматично flush-ва когато мрежата се върне,
        // дори когато приложението е затворено. Safari/Firefox: fallback от страницата
        // (виж useOfflineQueue → postMessage FLUSH_QUEUE).
        const swReg = reg as ServiceWorkerRegistration & {
          sync?: { register: (tag: string) => Promise<void> };
        };
        if (swReg.sync && typeof swReg.sync.register === "function") {
          try {
            await swReg.sync.register("sk-admin-mutation-sync");
          } catch { /* ignore — потребителят е блокирал background sync */ }
        }
      } catch {
        // SW регистрацията не е критична за основната UX — fail silently.
      }
    })();
  }, []);

  return <OfflineQueueProvider>{children}</OfflineQueueProvider>;
}
