"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import {
  LayoutDashboard,
} from "lucide-react";
import type { AdminRole } from "@/lib/admin/db";
import type { AdminNavIconKey } from "@/lib/admin/adminNavIconStyles";
import { ChatNavBadge } from "./chat/ChatNavBadge";
import { InquiriesNavBadge } from "./inquiries/InquiriesNavBadge";
import { AdminNavCollapsibleSection } from "./AdminNavCollapsibleSection";
import { AdminNavIcon } from "./AdminNavIcon";
import { useAdminNavSections } from "@/lib/admin/useAdminNavSections";
import { adminNavSectionForPath } from "@/lib/admin/adminNavSectionForPath";
import {
  DASHBOARD_LINK,
  getAdminNavSections,
  isNavLinkActive,
  type AdminNavLinkDef,
} from "@/lib/admin/adminNavConfig";

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
  const active = isNavLinkActive(pathname, href, exact);

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

function ConfigNavLink({ link }: { link: AdminNavLinkDef }) {
  const Icon = link.Icon;
  return (
    <NavLink
      href={link.href}
      label={link.label}
      iconKey={link.iconKey}
      exact={link.exact}
      icon={<Icon className="w-4 h-4" />}
    />
  );
}

export function AdminSidebarNav({ role }: { role: AdminRole }) {
  const pathname = usePathname();
  const { open, toggle, expand } = useAdminNavSections();
  const sections = getAdminNavSections(role);

  useEffect(() => {
    const active = adminNavSectionForPath(pathname, role);
    if (active) expand(active);
  }, [pathname, role, expand]);

  const officeSection = sections.find((s) => s.id === "office");
  const catalogSection = sections.find((s) => s.id === "catalog");
  const serviceSection = sections.find((s) => s.id === "service");
  const reportsSection = sections.find((s) => s.id === "reports");
  const adminSection = sections.find((s) => s.id === "admin");

  return (
    <nav className="flex flex-col gap-0.5 flex-1 p-2.5">
      <NavLink
        href={DASHBOARD_LINK.href}
        label={DASHBOARD_LINK.label}
        iconKey={DASHBOARD_LINK.iconKey}
        exact
        icon={<LayoutDashboard className="w-4 h-4" />}
      />

      {officeSection && (
        <AdminNavCollapsibleSection id="office" label={officeSection.title} open={open.office} onToggle={toggle}>
          {officeSection.links.map((link) => {
            if (link.href === "/admin/chat") return <ChatNavBadge key={link.href} />;
            if (link.href === "/admin/inquiries") return <InquiriesNavBadge key={link.href} />;
            return <ConfigNavLink key={link.href} link={link} />;
          })}
        </AdminNavCollapsibleSection>
      )}

      {catalogSection && (
        <AdminNavCollapsibleSection id="catalog" label={catalogSection.title} open={open.catalog} onToggle={toggle}>
          {catalogSection.links.map((link) => (
            <ConfigNavLink key={link.href} link={link} />
          ))}
        </AdminNavCollapsibleSection>
      )}

      {serviceSection && (
        <AdminNavCollapsibleSection id="service" label={serviceSection.title} open={open.service} onToggle={toggle}>
          {serviceSection.links.map((link) => (
            <ConfigNavLink key={link.href} link={link} />
          ))}
        </AdminNavCollapsibleSection>
      )}

      {reportsSection && (
        <AdminNavCollapsibleSection id="reports" label={reportsSection.title} open={open.reports} onToggle={toggle}>
          {reportsSection.links.map((link) => (
            <ConfigNavLink key={link.href} link={link} />
          ))}
        </AdminNavCollapsibleSection>
      )}

      {adminSection && (
        <AdminNavCollapsibleSection id="admin" label={adminSection.title} open={open.admin} onToggle={toggle}>
          {adminSection.links.map((link) => (
            <ConfigNavLink key={link.href} link={link} />
          ))}
        </AdminNavCollapsibleSection>
      )}
    </nav>
  );
}
