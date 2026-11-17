import type { AdminRole, AdminSession } from "@/lib/admin/db";

type RepairProtocolOwner = { created_by: string | null };

/** service_staff вижда/пипа само своите; офис и master — всички. */
export function repairProtocolVisibleTo(session: AdminSession, row: RepairProtocolOwner): boolean {
  if (session.role !== "service_staff") return true;
  return row.created_by === session.userId;
}

export function assertRepairProtocolVisible(
  session: AdminSession,
  row: RepairProtocolOwner | null | undefined,
): { ok: true } | { ok: false; status: 403 | 404; error: string } {
  if (!row) return { ok: false, status: 404, error: "Не е намерен" };
  if (!repairProtocolVisibleTo(session, row)) {
    return { ok: false, status: 403, error: "Нямате достъп до този протокол" };
  }
  return { ok: true };
}

export function canEditSignedRepairProtocol(role: AdminRole): boolean {
  return role === "master_admin" || role === "office_staff";
}
