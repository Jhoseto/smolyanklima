"use client";

import { useState } from "react";
import { useAdminBackHandler } from "@/lib/admin/useAdminBackHandler";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import {
  LayoutDashboard, Package, Users, MoreHorizontal, X,
  FileText, Star, Activity, Settings, LogOut, Headphones,
  ShieldCheck, FolderOpen, MessageSquare, Receipt, Truck, Bot,
} from "lucide-react";
import type { AdminRole } from "@/lib/admin/db";
import type { LucideIcon } from "lucide-react";
import { useInquiriesNewCount } from "@/lib/admin/useInquiriesNewCount";
import { AdminNavCollapsibleSection } from "./AdminNavCollapsibleSection";
import { useAdminNavSections, type AdminNavSectionId } from "@/lib/admin/useAdminNavSections";

type DrawerSection = {
  id: AdminNavSectionId;
  title: string;
  links: { href: string; label: string; icon: LucideIcon }[];
};

export function MobileNav({
  role,
  userName,
  avatarUrl,
}: {
  role: AdminRole;
  userName: string;
  avatarUrl: string | null;
}) {
  const initial = (userName || "?").trim().charAt(0).toUpperCase() || "?";
  const primaryLinks = role === "service_staff"
    ? [
        { href: "/admin", label: "Табло", icon: LayoutDashboard, exact: true },
        { href: "/admin/products", label: "Продукти", icon: Package, exact: false },
        { href: "/admin/service/documents", label: "Документи", icon: FolderOpen, exact: false },
      ]
    : [
        { href: "/admin", label: "Табло", icon: LayoutDashboard, exact: true },
        { href: "/admin/contacts", label: "Контакти", icon: Users, exact: false },
        { href: "/admin/chat", label: "Чат", icon: Headphones, exact: false },
        { href: "/admin/inquiries", label: "Запитвания", icon: MessageSquare, exact: false },
      ];

  const drawerSections: DrawerSection[] = role === "service_staff"
    ? []
    : (() => {
        const sections: DrawerSection[] = [
          {
            id: "office",
            title: "Офис",
            links: [
              { href: "/admin/products", label: "Продукти", icon: Package },
              ...(role === "master_admin" || role === "office_staff"
                ? [
                    { href: "/admin/history", label: "Продажби", icon: Receipt },
                    { href: "/admin/supplier-orders", label: "Поръчки", icon: Truck },
                  ]
                : []),
              { href: "/admin/articles", label: "Статии", icon: FileText },
              ...(role === "office_staff"
                ? [{ href: "/admin/ai-agent", label: "СК Help Agent", icon: Bot }]
                : []),
            ],
          },
          {
            id: "service",
            title: "Сервиз",
            links: [
              { href: "/admin/service/documents", label: "Документи", icon: FolderOpen },
            ],
          },
        ];
        if (role === "master_admin" || role === "office_staff") {
          sections.push({
            id: "reports",
            title: "Отчети",
            links: [
              { href: "/admin/ratings", label: "Оценки", icon: Star },
              { href: "/admin/activity", label: "Активност", icon: Activity },
            ],
          });
          sections.push({
            id: "admin",
            title: "Администрация",
            links: [
              { href: "/admin/staff", label: "Персонал", icon: ShieldCheck },
              ...(role === "master_admin"
                ? [
                    { href: "/admin/settings", label: "Настройки", icon: Settings },
                    { href: "/admin/ai-agent", label: "СК Help Agent", icon: Bot },
                  ]
                : []),
            ],
          });
        }
        return sections;
      })();

  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useAdminBackHandler(drawerOpen, () => setDrawerOpen(false), "mobile-nav-drawer");
  const inquiriesNewCount = useInquiriesNewCount();
  const { open, toggle } = useAdminNavSections();

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const allDrawerLinks = drawerSections.flatMap((s) => s.links);
  const anyMoreActive =
    pathname === "/admin/profile" ||
    pathname.startsWith("/admin/profile/") ||
    allDrawerLinks.some((l) => isActive(l.href));
  const hasDrawer = drawerSections.length > 0;

  return (
    <>
      {/* Backdrop for "More" drawer */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Slide-up "More" drawer */}
      <div
        className={`md:hidden fixed left-0 right-0 bottom-0 z-50 bg-white rounded-t-3xl border-t border-slate-200 shadow-[0_-8px_40px_rgba(15,23,42,0.18)] transition-transform duration-300 ease-out ${
          drawerOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-sm font-black text-slate-900 tracking-wide uppercase">Меню</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 active:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <Link
          href="/admin/profile"
          onClick={() => setDrawerOpen(false)}
          className={`mx-4 mb-3 flex items-center gap-3 rounded-2xl border px-3 py-2.5 no-underline transition-colors active:scale-[0.99] ${
            isActive("/admin/profile")
              ? "border-brand-orange-200 bg-brand-orange-50"
              : "border-slate-200 bg-slate-50 hover:bg-white"
          }`}
        >
          <div className="w-11 h-11 rounded-full bg-brand-blue-100 text-brand-blue-700 flex items-center justify-center font-extrabold text-base shrink-0 overflow-hidden ring-1 ring-slate-200/80">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-slate-900 truncate">{userName || "—"}</div>
            <div className="text-[11px] font-semibold text-brand-orange-600">Моят профил</div>
          </div>
        </Link>

        <div className="px-4 pb-2 space-y-3 max-h-[55vh] overflow-y-auto">
          {drawerSections.map((section) => (
            <AdminNavCollapsibleSection
              key={section.id}
              id={section.id}
              label={section.title}
              open={open[section.id]}
              onToggle={toggle}
              variant="drawer"
            >
              {section.links.map((link) => {
                const Icon = link.icon;
                const active = isActive(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-2xl text-center transition-colors active:scale-95 ${
                      active
                        ? "bg-brand-orange-50 text-brand-orange-600"
                        : "text-slate-600 hover:bg-slate-50 active:bg-slate-100"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${active ? "bg-brand-orange-100 text-brand-orange-600" : "bg-slate-100"}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold leading-tight">{link.label}</span>
                  </Link>
                );
              })}
            </AdminNavCollapsibleSection>
          ))}
        </div>

        <div className="px-4 pb-6 pt-2 border-t border-slate-100 mt-2">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-5 py-3.5 rounded-2xl text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors font-semibold text-sm"
            >
              <LogOut className="w-5 h-5" />
              Изход от системата
            </button>
          </form>
        </div>
        {/* Safe area bottom padding */}
        <div className="h-safe-area-inset-bottom" />
      </div>

      {/* Fixed bottom navigation bar — solid bg for performance on older phones */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-slate-200 shadow-[0_-2px_16px_rgba(15,23,42,0.06)]">
        <div className="flex items-stretch justify-around px-1 pt-1.5 pb-1">
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href, link.exact);
            const showInquiriesBadge =
              link.href === "/admin/inquiries" && inquiriesNewCount > 0 && !active;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-150 min-w-0 flex-1 min-h-[44px] justify-center ${
                  active ? "text-brand-orange-600" : "text-slate-500"
                }`}
              >
                <div
                  className={`relative w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    active ? "bg-brand-orange-100" : ""
                  }`}
                >
                  <Icon
                    className="w-5 h-5"
                    strokeWidth={active ? 2.5 : 1.75}
                  />
                  {showInquiriesBadge && (
                    <span className="absolute -top-0.5 -right-1 min-w-[1rem] h-4 px-0.5 rounded-full bg-orange-500 text-white text-[8px] font-black flex items-center justify-center leading-none">
                      {inquiriesNewCount > 9 ? "9+" : inquiriesNewCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-semibold tracking-wide leading-none ${
                    active ? "text-brand-orange-600" : "text-slate-500"
                  }`}
                >
                  {link.label}
                </span>
              </Link>
            );
          })}

          {hasDrawer && (
            <button
              onClick={() => setDrawerOpen(true)}
              className={`flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-150 flex-1 min-h-[44px] justify-center ${
                anyMoreActive ? "text-brand-orange-600" : "text-slate-500"
              }`}
            >
              <div
                className={`w-10 h-7 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  anyMoreActive ? "bg-brand-orange-100" : ""
                }`}
              >
                <MoreHorizontal className="w-5 h-5" strokeWidth={anyMoreActive ? 2.5 : 1.75} />
              </div>
              <span className={`text-[10px] font-semibold tracking-wide leading-none ${anyMoreActive ? "text-brand-orange-600" : "text-slate-500"}`}>
                Още
              </span>
            </button>
          )}
        </div>
        {/* iOS safe area */}
        <div className="pb-safe" />
      </nav>
    </>
  );
}
