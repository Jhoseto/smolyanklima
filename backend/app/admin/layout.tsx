import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { adminSession, type AdminRole } from "@/lib/admin/db";
import { InfoDot } from "./ui";
import { MobileNav } from "./MobileNav";
import { SplashScreen } from "./SplashScreen";
import { ChatNavBadge } from "./chat/ChatNavBadge";
import {
  LayoutDashboard, Package, Users, FileText, Star,
  MessageSquare, History, Activity, Settings, LogOut,
  CalendarClock, ShieldCheck, ClipboardList,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let role: AdminRole = "office_staff";
  let userName = "";

  try {
    const session = await adminSession();
    role = session.role;
    userName = session.name;
  } catch {
    redirect("/login");
  }

  // service_staff has their own minimal layout — render only children
  if (role === "service_staff") {
    return (
      <>
        <SplashScreen />
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans text-sm">
          <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
              <ClipboardList className="w-4 h-4 text-amber-500" />
              Мои задачи
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-slate-500">{userName}</span>
              <form action={logoutAction}>
                <button type="submit" className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1 transition-colors">
                  <LogOut className="w-3.5 h-3.5" /> Изход
                </button>
              </form>
            </div>
          </header>
          <main className="p-4 pb-10">{children}</main>
        </div>
      </>
    );
  }

  return (
    <>
      <SplashScreen />
      <div className="h-screen flex flex-col overflow-hidden bg-slate-50 text-slate-900 font-sans text-sm md:grid md:grid-cols-[220px_minmax(0,1fr)]">

        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col border-r border-slate-200 bg-white p-3 min-h-0 overflow-y-auto">
          <div className="inline-flex items-center gap-2 font-bold mb-3 text-slate-900 text-sm tracking-wide px-0.5">
            <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
              <LayoutDashboard className="w-4 h-4" />
            </div>
            Админ панел
            <InfoDot text="Център за управление: продукти, контакти, съдържание и настройки." />
          </div>

          <nav className="flex flex-col gap-0.5 flex-1">
            {/* Visible to all (office + master) */}
            <NavLink href="/admin" label="Табло" icon={<LayoutDashboard className="w-4 h-4" />} />
            <NavLink href="/admin/operations" label="Поръчки & Монтажи" icon={<CalendarClock className="w-4 h-4" />} />
            <NavLink href="/admin/contacts" label="Контакти" icon={<Users className="w-4 h-4" />} />
            <NavLink href="/admin/inquiries" label="Запитвания" icon={<MessageSquare className="w-4 h-4" />} />
            <ChatNavBadge />
            <NavLink href="/admin/products" label="Продукти" icon={<Package className="w-4 h-4" />} />
            <NavLink href="/admin/articles" label="Статии" icon={<FileText className="w-4 h-4" />} />

            {/* master_admin only */}
            {role === "master_admin" && (
              <>
                <div className="mt-2 mb-1 px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Отчети</div>
                <NavLink href="/admin/ratings" label="Оценки" icon={<Star className="w-4 h-4" />} />
                <NavLink href="/admin/history" label="История продажби" icon={<History className="w-4 h-4" />} />
                <NavLink href="/admin/activity" label="Активност" icon={<Activity className="w-4 h-4" />} />
                <div className="mt-2 mb-1 px-2.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Администрация</div>
                <NavLink href="/admin/staff" label="Персонал" icon={<ShieldCheck className="w-4 h-4" />} />
                <NavLink href="/admin/settings" label="Настройки" icon={<Settings className="w-4 h-4" />} />
              </>
            )}
          </nav>

          <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
            <p className="px-2.5 text-[11px] text-slate-400 truncate">{userName}</p>
            <form action={logoutAction}>
              <button
                type="submit"
                className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 text-xs hover:bg-slate-50 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <LogOut className="w-4 h-4" />
                Изход
              </button>
            </form>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-h-0 w-full min-w-0 overflow-x-hidden overflow-y-auto p-3 md:p-4 pb-24 md:pb-4">
          {children}
        </main>

        {/* Mobile nav */}
        <MobileNav role={role} />
      </div>
    </>
  );
}

function NavLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-slate-600 font-semibold no-underline bg-transparent hover:bg-slate-50 hover:text-slate-900 transition-colors text-xs border border-transparent focus:outline-none focus:ring-2 focus:ring-slate-200"
    >
      <span className="text-slate-400">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
