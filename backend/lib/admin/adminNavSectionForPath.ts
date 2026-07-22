import type { AdminRole } from "@/lib/admin/db";
import type { AdminNavSectionId } from "@/lib/admin/useAdminNavSections";

/** Коя секция в мобилното/десктоп меню е активна за даден път. */
export function adminNavSectionForPath(pathname: string, role: AdminRole): AdminNavSectionId | null {
  if (
    pathname === "/admin/contacts" ||
    pathname.startsWith("/admin/contacts/") ||
    pathname === "/admin/chat" ||
    pathname.startsWith("/admin/chat/") ||
    pathname === "/admin/inquiries" ||
    pathname.startsWith("/admin/inquiries/") ||
    pathname === "/admin/history" ||
    pathname.startsWith("/admin/history/") ||
    pathname === "/admin/supplier-orders" ||
    pathname.startsWith("/admin/supplier-orders/") ||
    pathname === "/admin/containers" ||
    pathname.startsWith("/admin/containers/")
  ) {
    return "office";
  }
  if (role !== "service_staff" && (pathname === "/admin/products" || pathname.startsWith("/admin/products/"))) {
    return "office";
  }
  if (pathname === "/admin/service" || pathname.startsWith("/admin/service/")) return "service";
  if (
    pathname === "/admin/ratings" ||
    pathname.startsWith("/admin/ratings/") ||
    pathname === "/admin/activity" ||
    pathname.startsWith("/admin/activity/")
  ) {
    return "reports";
  }
  if (
    pathname === "/admin/staff" ||
    pathname.startsWith("/admin/staff/") ||
    pathname === "/admin/articles" ||
    pathname.startsWith("/admin/articles/") ||
    pathname === "/admin/settings" ||
    pathname.startsWith("/admin/settings/") ||
    pathname === "/admin/about" ||
    pathname.startsWith("/admin/about/")
  ) {
    return "admin";
  }
  if (pathname === "/admin/ai-agent" || pathname.startsWith("/admin/ai-agent/")) {
    return role === "office_staff" ? "office" : "admin";
  }
  return null;
}
