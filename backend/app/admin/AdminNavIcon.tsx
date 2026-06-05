import { adminNavIconClass, type AdminNavIconKey } from "@/lib/admin/adminNavIconStyles";

export function AdminNavIcon({
  navKey,
  size = "sidebar",
  children,
}: {
  navKey: AdminNavIconKey;
  size?: "sidebar" | "drawer";
  children: React.ReactNode;
}) {
  return <span className={adminNavIconClass(navKey, size)}>{children}</span>;
}
