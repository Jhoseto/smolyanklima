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
export function OfflineBootstrap({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;

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
