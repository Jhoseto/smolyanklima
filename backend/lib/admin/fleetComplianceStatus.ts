import {
  FLEET_CORE_COMPLIANCE_KINDS,
  type FleetComplianceKind,
  type FleetComplianceLevel,
  type FleetComplianceRecordRow,
  type FleetComplianceSummaryItem,
} from "./fleetTypes";

const LEVEL_RANK: Record<FleetComplianceLevel, number> = {
  expired: 5,
  critical: 4,
  warning: 3,
  ok: 2,
  missing: 1,
};

function todayIsoInSofia(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Sofia" });
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function daysUntilExpiry(expiresOn: string | null | undefined, todayIso = todayIsoInSofia()): number | null {
  if (!expiresOn?.trim()) return null;
  const exp = parseIsoDate(expiresOn);
  const today = parseIsoDate(todayIso);
  const ms = exp.getTime() - today.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function complianceLevelFromExpiresOn(
  expiresOn: string | null | undefined,
  todayIso = todayIsoInSofia(),
): FleetComplianceLevel {
  if (!expiresOn?.trim()) return "missing";
  const daysLeft = daysUntilExpiry(expiresOn, todayIso);
  if (daysLeft === null) return "missing";
  if (daysLeft < 0) return "expired";
  if (daysLeft <= 7) return "critical";
  if (daysLeft <= 30) return "warning";
  return "ok";
}

export function worstComplianceLevel(levels: FleetComplianceLevel[]): FleetComplianceLevel {
  if (levels.length === 0) return "missing";
  return levels.reduce((worst, level) => (LEVEL_RANK[level] > LEVEL_RANK[worst] ? level : worst), "missing");
}

export function pickLatestComplianceByKind(
  records: FleetComplianceRecordRow[],
  kind: FleetComplianceKind,
  todayIso = todayIsoInSofia(),
): FleetComplianceRecordRow | null {
  const rows = records.filter((r) => r.kind === kind);
  if (rows.length === 0) return null;
  const active = rows.filter((r) => r.expires_on >= todayIso);
  const pool = active.length > 0 ? active : rows;
  return [...pool].sort((a, b) => b.expires_on.localeCompare(a.expires_on))[0] ?? null;
}

export function buildComplianceSummaryItem(
  record: FleetComplianceRecordRow | null,
  kind: FleetComplianceKind,
  todayIso = todayIsoInSofia(),
): FleetComplianceSummaryItem {
  if (!record) {
    return {
      kind,
      expires_on: null,
      provider: null,
      reference_number: null,
      level: "missing",
      days_left: null,
      record_id: null,
    };
  }
  const daysLeft = daysUntilExpiry(record.expires_on, todayIso);
  return {
    kind,
    expires_on: record.expires_on,
    provider: record.provider,
    reference_number: record.reference_number,
    level: complianceLevelFromExpiresOn(record.expires_on, todayIso),
    days_left: daysLeft,
    record_id: record.id,
  };
}

export function buildComplianceSummaryMap(
  records: FleetComplianceRecordRow[],
  kinds: FleetComplianceKind[] = FLEET_CORE_COMPLIANCE_KINDS,
  todayIso = todayIsoInSofia(),
): Record<FleetComplianceKind, FleetComplianceSummaryItem | null> {
  const map = {} as Record<FleetComplianceKind, FleetComplianceSummaryItem | null>;
  for (const kind of kinds) {
    map[kind] = buildComplianceSummaryItem(pickLatestComplianceByKind(records, kind), kind, todayIso);
  }
  return map;
}

export function overallLevelFromSummary(
  summary: Record<FleetComplianceKind, FleetComplianceSummaryItem | null>,
  kinds: FleetComplianceKind[] = FLEET_CORE_COMPLIANCE_KINDS,
): FleetComplianceLevel {
  return worstComplianceLevel(
    kinds.map((kind) => summary[kind]?.level ?? "missing"),
  );
}

export function fleetComplianceLevelLabel(level: FleetComplianceLevel): string {
  switch (level) {
    case "expired":
      return "Изтекло";
    case "critical":
      return "Критично";
    case "warning":
      return "Скоро";
    case "ok":
      return "OK";
    default:
      return "Липсва";
  }
}

export function fleetComplianceLevelClass(level: FleetComplianceLevel): string {
  switch (level) {
    case "expired":
    case "critical":
      return "bg-red-100 text-red-800 border-red-200";
    case "warning":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "ok":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function fleetComplianceDotClass(level: FleetComplianceLevel): string {
  switch (level) {
    case "expired":
    case "critical":
      return "bg-red-500";
    case "warning":
      return "bg-amber-500";
    case "ok":
      return "bg-emerald-500";
    default:
      return "bg-slate-300";
  }
}

export function matchesAlertFilter(level: FleetComplianceLevel, alertFilter: "all" | "alert" | "critical"): boolean {
  if (alertFilter === "all") return true;
  if (alertFilter === "critical") return level === "expired" || level === "critical";
  return level === "expired" || level === "critical" || level === "warning";
}
