"use client";

import { useEffect, useState } from "react";
import { useAdminBackHandler } from "@/lib/admin/useAdminBackHandler";
import { popAdminBackLayer, prepareAdminRouteNavigation } from "@/lib/admin/adminBackStack";
import { usePathname, useRouter } from "next/navigation";
import { adminNavSectionForPath } from "@/lib/admin/adminNavSectionForPath";
import { logoutAction } from "@/app/login/actions";
import { MoreHorizontal, X, LogOut } from "lucide-react";
import type { AdminRole } from "@/lib/admin/db";
import { useInquiriesNewCount } from "@/lib/admin/useInquiriesNewCount";
import { useAdminChatAlerts } from "./AdminChatAlertsProvider";
import { AdminNavIcon } from "./AdminNavIcon";
import { useAdminNavSections } from "@/lib/admin/useAdminNavSections";
import {
  getAdminNavSections,
  getMobilePrimaryLinks,
  isNavLinkActive,
  type AdminNavLinkDef,
  type AdminNavSectionDef,
} from "@/lib/admin/adminNavConfig";

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
  const profileInBottomBar =
    role === "service_staff" || role === "office_staff" || role === "master_admin";
  const primaryLinks = getMobilePrimaryLinks(role);
  // service_staff has no drawer — all links fit in bottom bar
  const drawerSections: AdminNavSectionDef[] =
    role === "service_staff" ? [] : getAdminNavSections(role);

  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  useAdminBackHandler(drawerOpen, () => setDrawerOpen(false), "mobile-nav-drawer");

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const inquiriesNewCount = useInquiriesNewCount({
    enabled: role === "master_admin" || role === "office_staff",
  });
  const { waitingCount: chatWaitingCount } = useAdminChatAlerts();
  const { expand } = useAdminNavSections();

  // Auto-expand the active section in desktop sidebar (shared localStorage)
  useEffect(() => {
    const active = adminNavSectionForPath(pathname, role);
    if (active) expand(active);
  }, [pathname, role, expand]);

  /** Затваря drawer и синхронизира history (X / backdrop). */
  function closeDrawer() {
    popAdminBackLayer("mobile-nav-drawer", false);
    setDrawerOpen(false);
  }

  /** Навигация от drawer или bottom bar — без history.back() race с router.push. */
  function navigateTo(href: string) {
    if (pathname === href || (href !== "/admin" && pathname.startsWith(`${href}/`))) {
      prepareAdminRouteNavigation(["mobile-nav-drawer"]);
      setDrawerOpen(false);
      return;
    }
    prepareAdminRouteNavigation(["mobile-nav-drawer"]);
    setDrawerOpen(false);
    void router.push(href);
  }

  function linkLabel(link: AdminNavLinkDef) {
    return link.shortLabel ?? link.label;
  }

  function isLinkActive(link: AdminNavLinkDef) {
    return isNavLinkActive(pathname, link.href, link.exact);
  }

  const allDrawerLinks = drawerSections.flatMap((s) => s.links);
  const onProfile =
    pathname === "/admin/profile" || pathname.startsWith("/admin/profile/");
  const anyMoreActive =
    (!profileInBottomBar && onProfile) ||
    allDrawerLinks.some((l) => isLinkActive(l));
  const hasDrawer = drawerSections.length > 0;

  function renderDrawerLink(link: AdminNavLinkDef) {
    const Icon = link.Icon;
    const active = isLinkActive(link);

    return (
      <button
        key={link.href}
        type="button"
        onClick={() => navigateTo(link.href)}
        className={`flex flex-col items-center gap-2 p-3.5 rounded-2xl text-center transition-all duration-150 active:scale-[0.96] ${
          active
            ? "bg-brand-orange-500 text-white shadow-sm shadow-brand-orange-200"
            : "bg-slate-50 text-slate-700 active:bg-slate-100"
        }`}
      >
        <AdminNavIcon navKey={link.iconKey} size="drawer">
          <Icon className={`w-5 h-5 ${active ? "text-white" : ""}`} />
        </AdminNavIcon>
        <span className={`text-[11px] font-bold leading-tight ${active ? "text-white" : ""}`}>
          {linkLabel(link)}
        </span>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm"
          onClick={() => closeDrawer()}
        />
      )}

      {/* Slide-up drawer */}
      <div
        className={`md:hidden fixed left-0 right-0 bottom-0 z-50 bg-white/98 backdrop-blur-xl rounded-t-[28px] border-t border-slate-200/60 shadow-[0_-4px_60px_rgba(15,23,42,0.22)] transition-transform duration-300 ease-out ${
          drawerOpen ? "translate-y-0 pointer-events-auto" : "translate-y-full pointer-events-none"
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3.5 pb-0.5">
          <div className="w-12 h-1.5 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-base font-black text-slate-900 tracking-tight">Меню</span>
          <button
            onClick={() => closeDrawer()}
            className="min-w-[44px] min-h-[44px] rounded-full bg-slate-100 flex items-center justify-center text-slate-500 active:bg-slate-200 transition-colors"
            aria-label="Затвори меню"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>

        {/* Profile card — shown in drawer for master_admin */}
        {!profileInBottomBar && (
          <button
            type="button"
            onClick={() => navigateTo("/admin/profile")}
            className={`mx-4 mb-3 flex items-center gap-3 rounded-2xl border px-3 py-2.5 w-[calc(100%-2rem)] transition-colors active:scale-[0.99] ${
              isNavLinkActive(pathname, "/admin/profile")
                ? "border-brand-orange-200 bg-brand-orange-50"
                : "border-slate-200 bg-slate-50 active:bg-white"
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
            <div className="min-w-0 flex-1 text-left">
              <div className="text-sm font-bold text-slate-900 truncate">{userName || "—"}</div>
              <div className="text-[11px] font-semibold text-brand-orange-600">Моят профил</div>
            </div>
          </button>
        )}

        {/* Sections — always fully expanded in drawer (no collapse), scroll if needed */}
        <div className="px-4 pb-2 max-h-[55vh] overflow-y-auto overscroll-contain space-y-4">
          {drawerSections.map((section) => (
            <div key={section.id}>
              <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-400 mb-2 px-1">
                {section.title}
              </p>
              <div className="grid grid-cols-3 gap-2">
                {section.links.map((link) => renderDrawerLink(link))}
              </div>
            </div>
          ))}
        </div>

        {/* Logout */}
        <div className="px-4 pb-5 pt-3 border-t border-slate-100 mt-2">
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
        <div className="pb-safe" />
      </div>

      {/* Bottom navigation bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/90 backdrop-blur-xl border-t border-slate-200/60 shadow-[0_-1px_0_rgba(15,23,42,0.06),0_-8px_32px_rgba(15,23,42,0.08)]">
        <div className="flex items-stretch justify-around px-2 pt-2 pb-1.5">
          {primaryLinks.map((link) => {
            const Icon = link.Icon;
            const active = isLinkActive(link);
            const showInquiriesBadge =
              link.href === "/admin/inquiries" && inquiriesNewCount > 0 && !active;
            const showChatBadge =
              link.href === "/admin/chat" && chatWaitingCount > 0 && !active;

            return (
              <button
                key={link.href}
                type="button"
                onClick={() => navigateTo(link.href)}
                className="flex flex-col items-center gap-1 px-1.5 py-1 rounded-2xl min-w-0 flex-1 min-h-[48px] justify-center select-none active:opacity-70 transition-opacity"
                title={link.label}
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
                  {showChatBadge && (
                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[9px] font-black flex items-center justify-center leading-none ring-2 ring-white">
                      {chatWaitingCount > 9 ? "9+" : chatWaitingCount}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] font-bold tracking-wide leading-none transition-colors ${
                    active ? "text-brand-orange-600" : "text-slate-400"
                  }`}
                >
                  {linkLabel(link)}
                </span>
              </button>
            );
          })}

          {hasDrawer && (
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="flex flex-col items-center gap-1 px-1.5 py-1 rounded-2xl flex-1 min-h-[48px] justify-center select-none active:opacity-70 transition-opacity"
              aria-label="Открий цялото меню"
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
        <div className="pb-safe" />
      </nav>
    </>
  );
}
