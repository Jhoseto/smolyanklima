"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Headphones } from "lucide-react";
import { useEffect, useState } from "react";

/** Polling badge — показва брой чакащи чатове в навигационното меню */
export function ChatNavBadge() {
  const pathname = usePathname();
  const active = pathname === "/admin/chat" || pathname.startsWith("/admin/chat/");
  const [count, setCount] = useState(0);

  useEffect(() => {
    let aborted = false;

    async function poll() {
      if (aborted) return;
      try {
        const res = await fetch("/api/admin/chat?status=waiting");
        if (!res.ok) return;
        const data = await res.json();
        if (!aborted) setCount((data.data ?? []).length);
      } catch { /* ignore */ }
    }

    poll();
    const timer = setInterval(poll, 5_000);
    return () => { aborted = true; clearInterval(timer); };
  }, []);

  return (
    <Link
      href="/admin/chat"
      className={`flex items-center justify-between px-2.5 py-2 rounded-lg font-semibold no-underline transition-colors text-xs border focus:outline-none focus:ring-2 focus:ring-slate-200 ${
        active
          ? "bg-sky-50 text-sky-700 border-sky-200"
          : "text-slate-600 bg-transparent border-transparent hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span className="flex items-center gap-2">
        <span className={active ? "text-sky-500" : "text-slate-400"}>
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
