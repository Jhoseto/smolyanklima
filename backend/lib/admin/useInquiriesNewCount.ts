"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { INQUIRIES_COUNT_CHANGED } from "@/lib/admin/inquiries-count-events";

// 10-minute poll — badge updates instantly via INQUIRIES_COUNT_CHANGED DOM event on
// admin-initiated changes; this poll only catches new external submissions.
const POLL_MS = 600_000;
const COUNT_URL = "/api/admin/inquiries/count";

type Options = { /** По подразбиране true; false за роли без „Запитвания“ (напр. service_staff). */ enabled?: boolean };

/**
 * Брой нови запитвания за навигация.
 * Poll на 10 мин + пауза при скрит tab; без poll на /admin/inquiries (там има SSE).
 * Admin-инициирани промени → badge се обновява веднага чрез INQUIRIES_COUNT_CHANGED event.
 */
export function useInquiriesNewCount(options?: Options): number {
  const enabled = options?.enabled !== false;
  const pathname = usePathname();
  const onInquiriesPage =
    pathname === "/admin/inquiries" || pathname.startsWith("/admin/inquiries/");
  const [count, setCount] = useState(0);

  const applyCount = useCallback(
    (n: number) => {
      setCount(onInquiriesPage ? 0 : n);
    },
    [onInquiriesPage],
  );

  useEffect(() => {
    if (!enabled || onInquiriesPage) {
      setCount(0);
      return;
    }

    let aborted = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      if (aborted) return;
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(COUNT_URL, { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { newCount?: number };
        if (!aborted && typeof data.newCount === "number") applyCount(data.newCount);
      } catch {
        /* ignore */
      }
    }

    function startTimer() {
      if (timer) clearInterval(timer);
      timer = setInterval(poll, POLL_MS);
    }

    function onVisibilityChange() {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      } else {
        void poll();
        startTimer();
      }
    }

    function onCountEvent(ev: Event) {
      const detail = (ev as CustomEvent<{ count?: number }>).detail;
      if (typeof detail?.count === "number") {
        if (!aborted) applyCount(detail.count);
      } else {
        void poll();
      }
    }

    void poll();
    startTimer();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
      document.addEventListener(INQUIRIES_COUNT_CHANGED, onCountEvent);
    }

    return () => {
      aborted = true;
      if (timer) clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        document.removeEventListener(INQUIRIES_COUNT_CHANGED, onCountEvent);
      }
    };
  }, [enabled, onInquiriesPage, applyCount]);

  return count;
}
