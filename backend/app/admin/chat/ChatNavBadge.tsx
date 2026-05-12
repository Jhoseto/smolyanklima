"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Headphones } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Polling badge — показва брой чакащи чатове в навигационното меню.
 *
 * Оптимизации (важни за production cost / battery / mobile data):
 *   1. Pause когато tab е в background (`document.hidden`) — спестява
 *      ~80% от заявките при типична употреба, защото потребителите
 *      рядко са активни в admin tab-а.
 *   2. Pause когато сме вече на /admin/chat — там има SSE streaming
 *      през `/api/admin/chat/stream`, така че polling-ът на баджа е
 *      излишен.
 *   3. Polling интервал 15s (вместо 5s) — баджът не е critical UI,
 *      15s latency за изскачащ бадж е напълно приемлив.
 *   4. Веднага poll-ва при visibility change → tab пак става активен
 *      (така че няма да чакаш 15s след връщане към tab-а).
 */
export function ChatNavBadge() {
  const pathname = usePathname();
  const active = pathname === "/admin/chat" || pathname.startsWith("/admin/chat/");
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Ако сме в самата чат страница — нея я хранят SSE stream-ове, така че
    // полингът е излишен (и ще дублира work-а). Просто се абонираме за
    // visibility change, за да поднем баджа при свиване на tab-а отново.
    if (active) {
      setCount(0);
      return;
    }

    let aborted = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function poll() {
      if (aborted) return;
      if (typeof document !== "undefined" && document.hidden) return; // skip когато tab е в background
      try {
        const res = await fetch("/api/admin/chat?status=waiting");
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted) setCount((data.data ?? []).length);
      } catch { /* ignore */ }
    }

    function startTimer() {
      if (timer) clearInterval(timer);
      // 15s — достатъчно бързо за UX („виж, ново съобщение“), достатъчно
      // бавно за да не натоварваме DB при дузина отворени admin tab-ове.
      timer = setInterval(poll, 15_000);
    }

    function onVisibilityChange() {
      if (typeof document === "undefined") return;
      if (document.hidden) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      } else {
        // Tab пак стана активен → веднага poll-ваме (без да чакаме 15s).
        void poll();
        startTimer();
      }
    }

    poll();
    startTimer();
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibilityChange);
    }

    return () => {
      aborted = true;
      if (timer) clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    };
  }, [active]);

  return (
    <Link
      href="/admin/chat"
      className={`flex items-center justify-between px-2.5 py-2 rounded-lg font-semibold no-underline transition-colors text-xs border focus:outline-none focus:ring-2 focus:ring-slate-200 ${
        active
          ? "bg-brand-blue-50 text-brand-blue-700 border-brand-blue-200"
          : "text-slate-600 bg-transparent border-transparent hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={active ? "text-brand-blue-500" : "text-slate-400"}>
          <Headphones className="w-4 h-4" />
        </span>
        Чат на живо
      </span>
      {count > 0 && (
        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-[9px] font-black shrink-0">
          {count}
        </span>
      )}
    </Link>
  );
}
