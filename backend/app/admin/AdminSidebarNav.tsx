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
import type { AdminNavIconKey } from "@/lib/admin/adminNavIconStyles";
import { ChatNavBadge } from "./chat/ChatNavBadge";
import { InquiriesNavBadge } from "./inquiries/InquiriesNavBadge";
import { AdminNavCollapsibleSection } from "./AdminNavCollapsibleSection";
import { AdminNavIcon } from "./AdminNavIcon";
import { useAdminNavSections } from "@/lib/admin/useAdminNavSections";
import { adminNavSectionForPath } from "@/lib/admin/adminNavSectionForPath";

function NavLink({
  href,
  label,
  iconKey,
  icon,
  exact = false,
}: {
  href: string;
  label: string;
  iconKey: AdminNavIconKey;
  icon: React.ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg font-semibold no-underline transition-colors text-xs border focus:outline-none focus:ring-2 focus:ring-slate-200 ${
        active
          ? "bg-slate-50 text-slate-900 border-slate-200"
          : "text-slate-600 bg-transparent border-transparent hover:bg-slate-50 hover:text-slate-900"
      }`}
    >
      <AdminNavIcon navKey={iconKey}>{icon}</AdminNavIcon>
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
      <NavLink
        href="/admin"
        label="Табло"
        iconKey="dashboard"
        exact
        icon={<LayoutDashboard className="w-4 h-4" />}
      />

      {showOffice && (
        <AdminNavCollapsibleSection id="office" label="Офис" open={open.office} onToggle={toggle}>
          <NavLink href="/admin/products" label="Продукти" iconKey="products" icon={<Package className="w-4 h-4" />} />
          {showSales && (
            <>
              <NavLink href="/admin/history" label="Продажби" iconKey="sales" icon={<Receipt className="w-4 h-4" />} />
              <NavLink
                href="/admin/supplier-orders"
                label="Поръчки"
                iconKey="orders"
                icon={<Truck className="w-4 h-4" />}
              />
            </>
          )}
          <NavLink href="/admin/contacts" label="Контакти" iconKey="contacts" icon={<Users className="w-4 h-4" />} />
          <ChatNavBadge />
          <InquiriesNavBadge />
          <NavLink href="/admin/articles" label="Статии" iconKey="articles" icon={<FileText className="w-4 h-4" />} />
          {role === "office_staff" && (
            <NavLink href="/admin/ai-agent" label="СК Help Agent" iconKey="ai-agent" icon={<Bot className="w-4 h-4" />} />
          )}
        </AdminNavCollapsibleSection>
      )}

      {role === "service_staff" && (
        <AdminNavCollapsibleSection id="catalog" label="Каталог" open={open.catalog} onToggle={toggle}>
          <NavLink href="/admin/products" label="Продукти" iconKey="products" icon={<Package className="w-4 h-4" />} />
        </AdminNavCollapsibleSection>
      )}

      {showService && (
        <AdminNavCollapsibleSection id="service" label="Сервиз" open={open.service} onToggle={toggle}>
          <NavLink
            href="/admin/service/documents"
            label="Документи"
            iconKey="documents"
            icon={<FolderOpen className="w-4 h-4" />}
          />
        </AdminNavCollapsibleSection>
      )}

      {showReports && (
        <AdminNavCollapsibleSection id="reports" label="Отчети" open={open.reports} onToggle={toggle}>
          <NavLink href="/admin/ratings" label="Оценки" iconKey="ratings" icon={<Star className="w-4 h-4" />} />
          <NavLink href="/admin/activity" label="Активност" iconKey="activity" icon={<Activity className="w-4 h-4" />} />
        </AdminNavCollapsibleSection>
      )}

      {(showStaff || showSettings) && (
        <AdminNavCollapsibleSection id="admin" label="Администрация" open={open.admin} onToggle={toggle}>
          {showStaff && (
            <NavLink href="/admin/staff" label="Персонал" iconKey="staff" icon={<ShieldCheck className="w-4 h-4" />} />
          )}
          {showSettings && (
            <NavLink href="/admin/settings" label="Настройки" iconKey="settings" icon={<Settings className="w-4 h-4" />} />
          )}
          {showSettings && role === "master_admin" && (
            <NavLink href="/admin/ai-agent" label="СК Help Agent" iconKey="ai-agent" icon={<Bot className="w-4 h-4" />} />
          )}
        </AdminNavCollapsibleSection>
      )}
    </nav>
  );
}
