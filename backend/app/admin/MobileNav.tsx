"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { useAdminBackHandler } from "@/lib/admin/useAdminBackHandler";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { adminNavSectionForPath } from "@/lib/admin/adminNavSectionForPath";
import { logoutAction } from "@/app/login/actions";
import {
  LayoutDashboard, Package, Users, MoreHorizontal, X,
  FileText, Star, Activity, Settings, LogOut, Headphones,
  ShieldCheck, FolderOpen, MessageSquare, Receipt, Truck, Bot,
  UserCircle,
} from "lucide-react";
import type { AdminRole } from "@/lib/admin/db";
import type { AdminNavIconKey } from "@/lib/admin/adminNavIconStyles";
import type { LucideIcon } from "lucide-react";
import { useInquiriesNewCount } from "@/lib/admin/useInquiriesNewCount";
import { AdminNavCollapsibleSection } from "./AdminNavCollapsibleSection";
import { AdminNavIcon } from "./AdminNavIcon";
import { useAdminNavSections, type AdminNavSectionId } from "@/lib/admin/useAdminNavSections";

type DrawerSection = {
  id: AdminNavSectionId;
  title: string;
  links: { href: string; label: string; icon: LucideIcon; iconKey: AdminNavIconKey }[];
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
  const profileTab = {
    href: "/admin/profile",
    label: "Профил",
    icon: UserCircle,
    exact: false,
  } as const;
  const profileInBottomBar = role === "service_staff" || role === "office_staff";

  const primaryLinks = role === "service_staff"
    ? [
        { href: "/admin", label: "Табло", icon: LayoutDashboard, exact: true },
        { href: "/admin/products", label: "Продукти", icon: Package, exact: false },
        { href: "/admin/service/tasks", label: "Задачи", icon: Headphones, exact: false },
        { href: "/admin/service/documents", label: "Документи", icon: FolderOpen, exact: false },
        profileTab,
      ]
    : role === "office_staff"
      ? [
          { href: "/admin", label: "Табло", icon: LayoutDashboard, exact: true },
          { href: "/admin/contacts", label: "Контакти", icon: Users, exact: false },
          { href: "/admin/chat", label: "Чат", icon: Headphones, exact: false },
          { href: "/admin/inquiries", label: "Запитвания", icon: MessageSquare, exact: false },
          profileTab,
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
              { href: "/admin/products", label: "Продукти", icon: Package, iconKey: "products" },
              ...(role === "master_admin" || role === "office_staff"
                ? [
                    { href: "/admin/history", label: "Продажби", icon: Receipt, iconKey: "sales" as const },
                    { href: "/admin/supplier-orders", label: "Поръчки", icon: Truck, iconKey: "orders" as const },
                  ]
                : []),
              { href: "/admin/articles", label: "Статии", icon: FileText, iconKey: "articles" },
              ...(role === "office_staff"
                ? [{ href: "/admin/ai-agent", label: "СК Help Agent", icon: Bot, iconKey: "ai-agent" as const }]
                : []),
            ],
          },
          {
            id: "service",
            title: "Сервиз",
            links: [
              { href: "/admin/service/tasks", label: "Задачи", icon: Headphones, iconKey: "service" as const },
              { href: "/admin/service/documents", label: "Документи", icon: FolderOpen, iconKey: "documents" },
            ],
          },
        ];
        if (role === "master_admin" || role === "office_staff") {
          sections.push({
            id: "reports",
            title: "Отчети",
            links: [
              { href: "/admin/ratings", label: "Оценки", icon: Star, iconKey: "ratings" },
              { href: "/admin/activity", label: "Активност", icon: Activity, iconKey: "activity" },
            ],
          });
          sections.push({
            id: "admin",
            title: "Администрация",
            links: [
              { href: "/admin/staff", label: "Персонал", icon: ShieldCheck, iconKey: "staff" },
              ...(role === "master_admin"
                ? [
                    { href: "/admin/settings", label: "Настройки", icon: Settings, iconKey: "settings" as const },
                    { href: "/admin/ai-agent", label: "СК Help Agent", icon: Bot, iconKey: "ai-agent" as const },
                  ]
                : []),
            ],
          });
        }
        return sections;
      })();

  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useAdminBackHandler(drawerOpen, () => setDrawerOpen(false), "mobile-nav-drawer");

  // Lock body scroll when drawer is open to prevent background scroll on iOS
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.body.style.overflow = drawerOpen ? "hidden" : "";
    }
    return () => {
      if (typeof document !== "undefined") document.body.style.overflow = "";
    };
  }, [drawerOpen]);
  const inquiriesNewCount = useInquiriesNewCount();
  const { open, toggle, expand } = useAdminNavSections();

  useEffect(() => {
    const active = adminNavSectionForPath(pathname, role);
    if (active) expand(active);
  }, [pathname, role, expand]);

  const documentsHubHref = "/admin/service/documents";

  function navigateDocuments(e: MouseEvent) {
    if (pathname === documentsHubHref) return;
    if (pathname.startsWith(`${documentsHubHref}/`)) {
      e.preventDefault();
      router.push(documentsHubHref);
    }
  }

  function isActive(href: string, exact = false) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  }

  const allDrawerLinks = drawerSections.flatMap((s) => s.links);
  const onProfile =
    pathname === "/admin/profile" || pathname.startsWith("/admin/profile/");
  const anyMoreActive =
    (!profileInBottomBar && onProfile) ||
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
        className={`md:hidden fixed left-0 right-0 bottom-0 z-50 bg-white/95 backdrop-blur-xl rounded-t-[28px] border-t border-slate-200/60 shadow-[0_-4px_60px_rgba(15,23,42,0.22)] transition-transform duration-300 ease-out ${
          drawerOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3.5 pb-0.5">
          <div className="w-12 h-1.5 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-base font-black text-slate-900 tracking-tight">Меню</span>
          <button
            onClick={() => setDrawerOpen(false)}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:bg-slate-200 transition-colors"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        {!profileInBottomBar && (
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
        )}

        <div className="px-4 pb-2 space-y-2 max-h-[55vh] overflow-y-auto overscroll-contain">
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
                    onClick={(e) => {
                      if (link.href === documentsHubHref) navigateDocuments(e);
                      setDrawerOpen(false);
                    }}
                    className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl text-center transition-all duration-150 active:scale-[0.96] ${
                      active
                        ? "bg-brand-orange-500 text-white shadow-sm shadow-brand-orange-200"
                        : "bg-slate-50 text-slate-700 active:bg-slate-100"
                    }`}
                  >
                    <AdminNavIcon navKey={link.iconKey} size="drawer">
                      <Icon className={`w-5 h-5 ${active ? "text-white" : ""}`} />
                    </AdminNavIcon>
                    <span className={`text-[11px] font-bold leading-tight ${active ? "text-white" : ""}`}>{link.label}</span>
                  </Link>
                );
              })}
            </AdminNavCollapsibleSection>
          ))}
        </div>

        <div className="px-4 pb-5 pt-3 border-t border-slate-100 mt-1">
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex items-center gap-3 w-full px-4 py-3.5 rounded-2xl text-red-600 bg-red-50/60 active:bg-red-100 transition-colors font-semibold text-sm min-h-[52px]"
            >
              <LogOut className="w-5 h-5 shrink-0" />
              Изход от системата
            </button>
          </form>
        </div>
        {/* Safe area bottom padding */}
        <div className="h-safe-area-inset-bottom" />
      </div>

      {/* Fixed bottom navigation bar — glass/blur for premium PWA feel */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-1px_0_rgba(15,23,42,0.06),0_-8px_32px_rgba(15,23,42,0.08)]">
        <div className="flex items-stretch justify-around px-2 pt-2 pb-1.5">
          {primaryLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.href, link.exact);
            const showInquiriesBadge =
              link.href === "/admin/inquiries" && inquiriesNewCount > 0 && !active;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={link.href === documentsHubHref ? navigateDocuments : undefined}
                className="flex flex-col items-center gap-1 px-1.5 py-1 rounded-2xl min-w-0 flex-1 min-h-[48px] justify-center select-none active:opacity-70 transition-opacity"
              >
                <div
                  className={`relative w-12 h-8 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                    active
                      ? "bg-brand-orange-500 shadow-sm shadow-brand-orange-300"
                      : "bg-transparent"
                  }`}
                >
                  <Icon
                    className={`w-[22px] h-[22px] transition-colors ${active ? "text-white" : "text-slate-500"}`}
                    strokeWidth={active ? 2.5 : 1.75}
                  />
                  {showInquiriesBadge && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center leading-none ring-2 ring-white">
                      {inquiriesNewCount > 9 ? "9+" : inquiriesNewCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold tracking-wide leading-none transition-colors ${
                    active ? "text-brand-orange-600" : "text-slate-400"
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
              className="flex flex-col items-center gap-1 px-1.5 py-1 rounded-2xl flex-1 min-h-[48px] justify-center select-none active:opacity-70 transition-opacity"
            >
              <div
                className={`w-12 h-8 rounded-2xl flex items-center justify-center transition-all duration-200 ${
                  anyMoreActive
                    ? "bg-brand-orange-500 shadow-sm shadow-brand-orange-300"
                    : "bg-transparent"
                }`}
              >
                <MoreHorizontal
                  className={`w-[22px] h-[22px] transition-colors ${anyMoreActive ? "text-white" : "text-slate-500"}`}
                  strokeWidth={anyMoreActive ? 2.5 : 1.75}
                />
              </div>
              <span className={`text-[10px] font-bold tracking-wide leading-none transition-colors ${anyMoreActive ? "text-brand-orange-600" : "text-slate-400"}`}>
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
