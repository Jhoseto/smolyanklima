import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { adminSession, type AdminRole } from "@/lib/admin/db";
import { MobileNav } from "./MobileNav";
import { SplashScreen } from "./SplashScreen";
import { ChatNavBadge } from "./chat/ChatNavBadge";
import { AdminPushBanner } from "./AdminPushBanner";
import { OfflineBootstrap } from "./OfflineBootstrap";
import { OfflineExplainerCard } from "./OfflineExplainerCard";
import { AdminLogo } from "./AdminLogo";
import {
  LayoutDashboard, Package, Users, FileText, Star,
  Activity, Settings, LogOut,
  ShieldCheck, FolderOpen, MessageSquare, Receipt,
} from "lucide-react";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<AdminRole, string> = {
  master_admin: "Главен администратор",
  office_staff: "Офис служител",
  service_staff: "Сервизен техник",
};

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

  const initial = (userName || "?").trim().charAt(0).toUpperCase() || "?";
  const roleLabel = ROLE_LABELS[role] ?? role;

  // Кои секции вижда текущата роля
  const showOffice = role === "master_admin" || role === "office_staff";
  const showService = true; // всички роли виждат секция Сервиз → Документи
  const showReports = role === "master_admin";
  const showAdminSection = role === "master_admin";
  // „Продажби" е аналитичен модул — само за главен админ.
  const showSales = role === "master_admin";

  return (
    <>
      <SplashScreen />
      <div className="h-screen flex flex-col overflow-hidden bg-slate-50 text-slate-900 font-sans text-sm md:grid md:grid-cols-[240px_minmax(0,1fr)]">

        {/* Desktop sidebar */}
        <aside className="hidden md:flex flex-col border-r border-slate-200 bg-white min-h-0 overflow-y-auto">

          {/* Лого от публичния сайт */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            <AdminLogo size="sm" uniqueId="sidebar" />
            <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-900">
              Административен панел
            </div>
          </div>

          {/* Профил на оператора */}
          <div className="px-3 py-3 border-b border-slate-100 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-brand-blue-100 text-brand-blue-700 flex items-center justify-center font-extrabold text-base shrink-0">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-bold text-slate-900 truncate" title={userName}>
                {userName || "—"}
              </div>
              <div
                className="text-[10px] font-bold uppercase tracking-wider text-brand-orange-600 truncate"
                title={roleLabel}
              >
                {roleLabel}
              </div>
            </div>
          </div>

          {/* Навигация */}
          <nav className="flex flex-col gap-0.5 flex-1 p-2.5">
            {/* Главно: Табло */}
            <NavLink href="/admin" label="Табло" icon={<LayoutDashboard className="w-4 h-4" />} />

            {showOffice && (
              <>
                <SectionLabel label="Офис" />
                <NavLink href="/admin/contacts" label="Контакти" icon={<Users className="w-4 h-4" />} />
                <ChatNavBadge />
                <NavLink href="/admin/inquiries" label="Запитвания" icon={<MessageSquare className="w-4 h-4" />} />
                <NavLink href="/admin/products" label="Продукти" icon={<Package className="w-4 h-4" />} />
                {showSales && (
                  <NavLink href="/admin/history" label="Продажби" icon={<Receipt className="w-4 h-4" />} />
                )}
                <NavLink href="/admin/articles" label="Статии" icon={<FileText className="w-4 h-4" />} />
              </>
            )}

            {showService && (
              <>
                <SectionLabel label="Сервиз" />
                <NavLink href="/admin/service/documents" label="Документи" icon={<FolderOpen className="w-4 h-4" />} />
              </>
            )}

            {showReports && (
              <>
                <SectionLabel label="Отчети" />
                <NavLink href="/admin/ratings" label="Оценки" icon={<Star className="w-4 h-4" />} />
                <NavLink href="/admin/activity" label="Активност" icon={<Activity className="w-4 h-4" />} />
              </>
            )}

            {showAdminSection && (
              <>
                <SectionLabel label="Администрация" />
                <NavLink href="/admin/staff" label="Персонал" icon={<ShieldCheck className="w-4 h-4" />} />
                <NavLink href="/admin/settings" label="Настройки" icon={<Settings className="w-4 h-4" />} />
              </>
            )}
          </nav>

          {/* Изход */}
          <div className="p-2.5 border-t border-slate-100">
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
          <OfflineBootstrap>
            <OfflineExplainerCard />
            <AdminPushBanner role={role} />
            {children}
          </OfflineBootstrap>
        </main>

        {/* Mobile nav */}
        <MobileNav role={role} />
      </div>
    </>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mt-3 mb-1 px-2.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-[0.14em]">
      {label}
    </div>
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
