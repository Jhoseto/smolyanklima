"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  Users,
  FileText,
  Star,
  Activity,
  Settings,
  ShieldCheck,
  FolderOpen,
  Receipt,
  Truck,
  Bot,
} from "lucide-react";
import type { AdminRole } from "@/lib/admin/db";
import { ChatNavBadge } from "./chat/ChatNavBadge";
import { InquiriesNavBadge } from "./inquiries/InquiriesNavBadge";
import { AdminNavCollapsibleSection } from "./AdminNavCollapsibleSection";
import { useAdminNavSections } from "@/lib/admin/useAdminNavSections";
import { adminNavSectionForPath } from "@/lib/admin/adminNavSectionForPath";

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

export function AdminSidebarNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const { open, toggle, expand } = useAdminNavSections();

  const showOffice = role === "master_admin" || role === "office_staff";
  const showService = true;
  const showReports = role === "master_admin" || role === "office_staff";
  const showStaff = role === "master_admin" || role === "office_staff";
  const showSettings = role === "master_admin";
  const showSales = role === "master_admin" || role === "office_staff";

  useEffect(() => {
    const active = adminNavSectionForPath(pathname, role);
    if (active) expand(active);
  }, [pathname, role, expand]);

  return (
    <nav className="flex flex-col gap-0.5 flex-1 p-2.5">
      <NavLink href="/admin" label="Табло" icon={<LayoutDashboard className="w-4 h-4" />} />

      {showOffice && (
        <AdminNavCollapsibleSection id="office" label="Офис" open={open.office} onToggle={toggle}>
          <NavLink href="/admin/contacts" label="Контакти" icon={<Users className="w-4 h-4" />} />
          <ChatNavBadge />
          <InquiriesNavBadge />
          <NavLink href="/admin/products" label="Продукти" icon={<Package className="w-4 h-4" />} />
          {showSales && (
            <>
              <NavLink href="/admin/history" label="Продажби" icon={<Receipt className="w-4 h-4" />} />
              <NavLink href="/admin/supplier-orders" label="Поръчки" icon={<Truck className="w-4 h-4" />} />
            </>
          )}
          <NavLink href="/admin/articles" label="Статии" icon={<FileText className="w-4 h-4" />} />
          {role === "office_staff" && (
            <NavLink href="/admin/ai-agent" label="СК Help Agent" icon={<Bot className="w-4 h-4" />} />
          )}
        </AdminNavCollapsibleSection>
      )}

      {role === "service_staff" && (
        <AdminNavCollapsibleSection id="catalog" label="Каталог" open={open.catalog} onToggle={toggle}>
          <NavLink href="/admin/products" label="Продукти" icon={<Package className="w-4 h-4" />} />
        </AdminNavCollapsibleSection>
      )}

      {showService && (
        <AdminNavCollapsibleSection id="service" label="Сервиз" open={open.service} onToggle={toggle}>
          <NavLink href="/admin/service/documents" label="Документи" icon={<FolderOpen className="w-4 h-4" />} />
        </AdminNavCollapsibleSection>
      )}

      {showReports && (
        <AdminNavCollapsibleSection id="reports" label="Отчети" open={open.reports} onToggle={toggle}>
          <NavLink href="/admin/ratings" label="Оценки" icon={<Star className="w-4 h-4" />} />
          <NavLink href="/admin/activity" label="Активност" icon={<Activity className="w-4 h-4" />} />
        </AdminNavCollapsibleSection>
      )}

      {(showStaff || showSettings) && (
        <AdminNavCollapsibleSection id="admin" label="Администрация" open={open.admin} onToggle={toggle}>
          {showStaff && <NavLink href="/admin/staff" label="Персонал" icon={<ShieldCheck className="w-4 h-4" />} />}
          {showSettings && <NavLink href="/admin/settings" label="Настройки" icon={<Settings className="w-4 h-4" />} />}
          {showSettings && role === "master_admin" && (
            <NavLink href="/admin/ai-agent" label="СК Help Agent" icon={<Bot className="w-4 h-4" />} />
          )}
        </AdminNavCollapsibleSection>
      )}
    </nav>
  );
}
