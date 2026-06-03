import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/login/actions";
import { adminSession, type AdminRole } from "@/lib/admin/db";
import { MobileNav } from "./MobileNav";
import { SplashScreen } from "./SplashScreen";
import { AdminSidebarNav } from "./AdminSidebarNav";
import { AdminPushBanner } from "./AdminPushBanner";
import { OfflineBootstrap } from "./OfflineBootstrap";
import { OfflineExplainerCard } from "./OfflineExplainerCard";
import { AdminLogo } from "./AdminLogo";
import { AdminChatAlertsShell } from "./AdminChatAlertsShell";
import { AdminBackNavigation } from "./AdminBackNavigation";
import { LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<AdminRole, string> = {
  master_admin: "Главен администратор",
  office_staff: "Офис служител",
  service_staff: "Сервизен техник",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let role: AdminRole = "office_staff";
  let userName = "";
  let avatarUrl: string | null = null;

  try {
    const session = await adminSession();
    role = session.role;
    userName = session.name;
    avatarUrl = session.avatarUrl;
  } catch {
    redirect("/login");
  }

  const initial = (userName || "?").trim().charAt(0).toUpperCase() || "?";
  const roleLabel = ROLE_LABELS[role] ?? role;

  return (
    <>
      <AdminBackNavigation />
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

          {/* Профил на оператора — клик → Моят профил */}
          <Link
            href="/admin/profile"
            className="px-3 py-3 border-b border-slate-100 flex items-center gap-2.5 no-underline hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-slate-200"
          >
            <div className="w-10 h-10 rounded-full bg-brand-blue-100 text-brand-blue-700 flex items-center justify-center font-extrabold text-base shrink-0 overflow-hidden ring-1 ring-slate-200/80">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                initial
              )}
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
          </Link>

          <AdminSidebarNav role={role} />

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
        <main className="flex flex-col flex-1 min-h-0 w-full min-w-0 overflow-x-hidden overflow-y-auto p-2 pb-24 md:p-4 md:pb-4">
          <OfflineBootstrap>
            <div className="flex flex-col flex-1 min-h-0 min-w-0">
              <OfflineExplainerCard />
              <AdminPushBanner role={role} />
              <div className="flex flex-col flex-1 min-h-0 min-w-0">
                <AdminChatAlertsShell role={role}>{children}</AdminChatAlertsShell>
              </div>
            </div>
          </OfflineBootstrap>
        </main>

        {/* Mobile nav */}
        <MobileNav role={role} userName={userName} avatarUrl={avatarUrl} />
      </div>
    </>
  );
}
