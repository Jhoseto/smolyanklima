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
  Headphones,
  MessageSquare,
  CalendarClock,
  UserCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AdminRole } from "@/lib/admin/db";
import type { AdminNavIconKey } from "@/lib/admin/adminNavIconStyles";
import type { AdminNavSectionId } from "@/lib/admin/useAdminNavSections";

/** Hub на сервизните документи — един и същ на desktop и PWA. */
export const DOCUMENTS_HUB_HREF = "/admin/service/documents";

export type AdminNavLinkDef = {
  href: string;
  label: string;
  /** Кратък етикет за долната лента на PWA (ако label е твърде дълъг). */
  shortLabel?: string;
  iconKey: AdminNavIconKey;
  Icon: LucideIcon;
  exact?: boolean;
};

export type AdminNavSectionDef = {
  id: AdminNavSectionId;
  title: string;
  links: AdminNavLinkDef[];
};

export const DASHBOARD_LINK: AdminNavLinkDef = {
  href: "/admin",
  label: "Табло",
  iconKey: "dashboard",
  Icon: LayoutDashboard,
  exact: true,
};

export const PROFILE_LINK: AdminNavLinkDef = {
  href: "/admin/profile",
  label: "Профил",
  iconKey: "dashboard",
  Icon: UserCircle,
};

function officeSectionLinks(role: AdminRole): AdminNavLinkDef[] {
  const links: AdminNavLinkDef[] = [
    { href: "/admin/products", label: "Продукти", iconKey: "products", Icon: Package },
  ];

  if (role === "master_admin" || role === "office_staff") {
    links.push(
      { href: "/admin/history", label: "Продажби", iconKey: "sales", Icon: Receipt },
      { href: "/admin/supplier-orders", label: "Поръчки", iconKey: "orders", Icon: Truck },
    );
  }

  links.push(
    { href: "/admin/contacts", label: "Контакти", iconKey: "contacts", Icon: Users },
    {
      href: "/admin/chat",
      label: "Чат на живо",
      shortLabel: "Чат",
      iconKey: "chat",
      Icon: Headphones,
    },
    { href: "/admin/inquiries", label: "Запитвания", iconKey: "inquiries", Icon: MessageSquare },
    { href: "/admin/articles", label: "Статии", iconKey: "articles", Icon: FileText },
  );

  if (role === "office_staff") {
    links.push({
      href: "/admin/ai-agent",
      label: "СК Help Agent",
      iconKey: "ai-agent",
      Icon: Bot,
    });
  }

  return links;
}

const DOCUMENTS_LINK: AdminNavLinkDef = {
  href: DOCUMENTS_HUB_HREF,
  label: "Документи",
  iconKey: "documents",
  Icon: FolderOpen,
};

const TASKS_LINK: AdminNavLinkDef = {
  href: "/admin/service/tasks",
  label: "Задачи",
  iconKey: "tasks",
  Icon: CalendarClock,
};

/** Секции в sidebar / drawer — един източник на истина за desktop и PWA. */
export function getAdminNavSections(role: AdminRole): AdminNavSectionDef[] {
  const sections: AdminNavSectionDef[] = [];

  if (role === "master_admin" || role === "office_staff") {
    sections.push({
      id: "office",
      title: "Офис",
      links: officeSectionLinks(role),
    });
  }

  if (role === "service_staff") {
    sections.push({
      id: "catalog",
      title: "Каталог",
      links: [{ href: "/admin/products", label: "Продукти", iconKey: "products", Icon: Package }],
    });
  }

  // service_staff has Задачи in their bottom bar (ServiceTasksClient — different view).
  // master_admin + office_staff already see WorkItemsPlanner on the dashboard — no separate Tasks link.
  const serviceLinks: AdminNavLinkDef[] =
    role === "service_staff" ? [TASKS_LINK, DOCUMENTS_LINK] : [DOCUMENTS_LINK];

  sections.push({
    id: "service",
    title: "Сервиз",
    links: serviceLinks,
  });

  if (role === "master_admin" || role === "office_staff") {
    sections.push({
      id: "reports",
      title: "Отчети",
      links: [
        { href: "/admin/ratings", label: "Оценки", iconKey: "ratings", Icon: Star },
        { href: "/admin/activity", label: "Активност", iconKey: "activity", Icon: Activity },
      ],
    });

    const adminLinks: AdminNavLinkDef[] = [
      { href: "/admin/staff", label: "Персонал", iconKey: "staff", Icon: ShieldCheck },
    ];

    if (role === "master_admin") {
      adminLinks.push(
        { href: "/admin/settings", label: "Настройки", iconKey: "settings", Icon: Settings },
        { href: "/admin/ai-agent", label: "СК Help Agent", iconKey: "ai-agent", Icon: Bot },
      );
    }

    sections.push({
      id: "admin",
      title: "Администрация",
      links: adminLinks,
    });
  }

  return sections;
}

/** Основни табове в долната лента на PWA — същите модули като desktop, подредени за бърз достъп. */
export function getMobilePrimaryLinks(role: AdminRole): AdminNavLinkDef[] {
  if (role === "service_staff") {
    // ServiceTasksClient at /admin/service/tasks is the primary task view for service_staff.
    // master_admin/office_staff see WorkItemsPlanner on the dashboard — no Tasks tab needed.
    return [
      DASHBOARD_LINK,
      { href: "/admin/products", label: "Продукти", iconKey: "products", Icon: Package },
      TASKS_LINK,
      DOCUMENTS_LINK,
      PROFILE_LINK,
    ];
  }

  if (role === "office_staff") {
    return [
      DASHBOARD_LINK,
      { href: "/admin/contacts", label: "Контакти", iconKey: "contacts", Icon: Users },
      {
        href: "/admin/chat",
        label: "Чат на живо",
        shortLabel: "Чат",
        iconKey: "chat",
        Icon: Headphones,
      },
      { href: "/admin/inquiries", label: "Запитвания", iconKey: "inquiries", Icon: MessageSquare },
      PROFILE_LINK,
    ];
  }

  return [
    DASHBOARD_LINK,
    { href: "/admin/contacts", label: "Контакти", iconKey: "contacts", Icon: Users },
    {
      href: "/admin/chat",
      label: "Чат на живо",
      shortLabel: "Чат",
      iconKey: "chat",
      Icon: Headphones,
    },
    { href: "/admin/inquiries", label: "Запитвания", iconKey: "inquiries", Icon: MessageSquare },
  ];
}

export function isNavLinkActive(pathname: string, href: string, exact = false): boolean {
  if (exact) return pathname === href;
  if (href === DOCUMENTS_HUB_HREF) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
