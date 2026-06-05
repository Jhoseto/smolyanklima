"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { useInquiriesNewCount } from "@/lib/admin/useInquiriesNewCount";
import { AdminNavIcon } from "../AdminNavIcon";

/**
 * Badge за нови запитвания — poll 25s извън страницата, моментално при събитие
 * от InquiriesClient (SSE / промяна на статус).
 */
export function InquiriesNavBadge() {
  const pathname = usePathname();
  const active =
    pathname === "/admin/inquiries" || pathname.startsWith("/admin/inquiries/");
  const count = useInquiriesNewCount();

  return (
    <Link
      href="/admin/inquiries"
      className={`flex items-center justify-between px-2.5 py-2 rounded-lg font-semibold no-underline transition-colors text-xs border focus:outline-none focus:ring-2 focus:ring-slate-200 ${
        active
          ? "bg-brand-blue-50 text-brand-blue-700 border-brand-blue-200"
          : "text-slate-600 bg-transparent border-transparent hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <span className="flex items-center gap-2">
        <AdminNavIcon navKey="inquiries">
          <MessageSquare className="w-4 h-4" />
        </AdminNavIcon>
        Запитвания
      </span>
      {count > 0 && (
        <span className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1 rounded-full bg-orange-500 text-white text-[9px] font-black shrink-0">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
