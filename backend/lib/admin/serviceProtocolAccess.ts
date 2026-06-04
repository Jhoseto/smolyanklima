import type { AdminSession } from "@/lib/admin/db";

type ServiceProtocolQuery<T> = {
  or(filter: string): T;
};

type RepairProtocolQuery<T> = {
  eq(column: string, value: string): T;
};

type AcceptanceProtocolAccessRow = {
  created_by?: string | null;
  work_item_id?: string | null;
};

type RepairProtocolAccessRow = {
  created_by?: string | null;
};

export function canServiceStaffAccessAcceptanceProtocol(
  row: AcceptanceProtocolAccessRow | null | undefined,
  userId: string,
): boolean {
  return Boolean(row && (row.created_by === userId || row.work_item_id));
}

export function canServiceStaffAccessRepairProtocol(
  row: RepairProtocolAccessRow | null | undefined,
  userId: string,
): boolean {
  return Boolean(row && row.created_by === userId);
}

export function scopeAcceptanceProtocolQueryForSession<T extends ServiceProtocolQuery<T>>(
  query: T,
  session: Pick<AdminSession, "role" | "userId">,
): T {
  if (session.role !== "service_staff") return query;
  return query.or(`created_by.eq.${session.userId},work_item_id.not.is.null`);
}

export function scopeRepairProtocolQueryForSession<T extends RepairProtocolQuery<T>>(
  query: T,
  session: Pick<AdminSession, "role" | "userId">,
): T {
  if (session.role !== "service_staff") return query;
  return query.eq("created_by", session.userId);
}
