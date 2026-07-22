import type { AdminRole, AdminSession } from "@/lib/admin/db";

export type RepairProtocolStatus = "prepared" | "in_progress" | "signed";

export type RepairProtocolAccessRow = {
  id: string;
  created_by: string | null;
  status: RepairProtocolStatus | string;
};

/** service_staff вижда/пипа само своите; офис и master — всички. */
export function repairProtocolVisibleTo(session: AdminSession, row: Pick<RepairProtocolAccessRow, "created_by">): boolean {
  if (session.role !== "service_staff") return true;
  return row.created_by === session.userId;
}

export function assertRepairProtocolVisible(
  session: AdminSession,
  row: Pick<RepairProtocolAccessRow, "created_by"> | null | undefined,
): { ok: true } | { ok: false; status: 403 | 404; error: string } {
  if (!row) return { ok: false, status: 404, error: "Не е намерен" };
  if (!repairProtocolVisibleTo(session, row)) {
    return { ok: false, status: 403, error: "Нямате достъп до този протокол" };
  }
  return { ok: true };
}

/**
 * Правила за запис на сервизен протокол:
 * - service_staff не пипа signed
 * - само master може да връща статус назад от signed
 * - office/master могат да редактират съдържание на signed (като при приемните)
 */
export function assertRepairProtocolWritable(
  session: AdminSession,
  current: Pick<RepairProtocolAccessRow, "created_by" | "status">,
  incomingStatus: RepairProtocolStatus | undefined,
): { ok: true } | { ok: false; status: 400 | 403 | 404; error: string } {
  const visible = assertRepairProtocolVisible(session, current);
  if (!visible.ok) return visible;

  const isSigned = current.status === "signed";

  if (isSigned && session.role === "service_staff") {
    return { ok: false, status: 403, error: "Подписан протокол е само за преглед" };
  }

  if (
    isSigned &&
    incomingStatus !== undefined &&
    incomingStatus !== "signed" &&
    session.role !== "master_admin"
  ) {
    return { ok: false, status: 400, error: "Подписан протокол не може да се върне назад" };
  }

  return { ok: true };
}

export function canEditSignedRepairProtocol(role: AdminRole): boolean {
  return role === "master_admin" || role === "office_staff";
}
