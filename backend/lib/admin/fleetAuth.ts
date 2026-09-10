import { requireRole, type AdminSession } from "@/lib/admin/db";

/** Автопарк: само офис и master admin (не service_staff). */
export function requireFleetAccess(session: AdminSession): void {
  requireRole(session, "master_admin", "office_staff");
}
