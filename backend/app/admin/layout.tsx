import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { InfoDot } from "./ui";
import { MobileNav } from "./MobileNav";
import { SplashScreen } from "./SplashScreen";
import { ChatNavBadge } from "./chat/ChatNavBadge";
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Star,
  MessageSquare,
  History,
  Activity,
  Settings,
  LogOut,
  Headphones,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SplashScreen />
      <div className="h-screen flex flex-col overflow-hidden bg-slate-50 text-slate-900 font-sans text-sm md:grid md:grid-cols-[220px_minmax(0,1fr)]">
      {/* Desktop sidebar — hidden on mobile */}
      <aside className="hidden md:flex flex-col border-r border-slate-200 bg-white p-3 min-h-0 overflow-y-auto">
        <div className="inline-flex items-center gap-2 font-bold mb-3 text-slate-900 text-sm tracking-wide px-0.5">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center shrink-0">
            <LayoutDashboard className="w-4 h-4" />
          </div>
          Админ панел
          <InfoDot text="Център за управление: продукти, контакти, съдържание и настройки." />
        </div>
        <nav className="flex flex-col gap-0.5 flex-1">
          <NavLink href="/admin" label="Табло" icon={<LayoutDashboard className="w-4 h-4" />} />
          <NavLink href="/admin/products" label="Продукти" icon={<Package className="w-4 h-4" />} />
          <NavLink href="/admin/contacts" label="Контакти" icon={<Users className="w-4 h-4" />} />
          <NavLink href="/admin/articles" label="Статии" icon={<FileText className="w-4 h-4" />} />
          <NavLink href="/admin/ratings" label="Оценки" icon={<Star className="w-4 h-4" />} />
          <NavLink href="/admin/inquiries" label="Запитвания" icon={<MessageSquare className="w-4 h-4" />} />
          {/* Live chat с badge за чакащи */}
          <ChatNavBadge />
          <NavLink href="/admin/history" label="История продажби" icon={<History className="w-4 h-4" />} />
          <NavLink href="/admin/activity" label="Активност" icon={<Activity className="w-4 h-4" />} />
          <NavLink href="/admin/settings" label="Настройки" icon={<Settings className="w-4 h-4" />} />
        </nav>
        <form action={logoutAction} className="mt-2 pt-2 border-t border-slate-100">
          <button
            type="submit"
            className="flex items-center gap-2 w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white font-semibold text-slate-700 text-xs hover:bg-slate-50 hover:text-red-600 transition-colors focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            <LogOut className="w-4 h-4" />
            Изход
          </button>
        </form>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-h-0 w-full min-w-0 overflow-x-hidden overflow-y-auto p-3 md:p-4 pb-24 md:pb-4">
        {children}
      </main>

      {/* Mobile bottom navigation (client component) */}
      <MobileNav />
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
