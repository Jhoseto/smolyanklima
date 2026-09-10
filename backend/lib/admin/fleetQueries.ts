import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeIlikeTerm } from "@/lib/security/sanitizeSearchTerm";
import {
  FLEET_ALL_COMPLIANCE_KINDS,
  FLEET_CORE_COMPLIANCE_KINDS,
  type FleetComplianceKind,
  type FleetComplianceRecordRow,
  type FleetMaintenanceEventRow,
  type FleetVehicleListRow,
  type FleetVehicleRow,
  type FleetVehicleStatus,
} from "./fleetTypes";
import {
  buildComplianceSummaryMap,
  matchesAlertFilter,
  overallLevelFromSummary,
} from "./fleetComplianceStatus";

export type FleetListFilters = {
  status?: FleetVehicleStatus | "all";
  alertLevel?: "all" | "alert" | "critical";
  q?: string;
  assignedAdminUserId?: string;
  sortBy?: "registration" | "alert" | "odometer";
  sortDir?: "asc" | "desc";
};

export type FleetSummaryCounts = {
  total: number;
  critical: number;
  warning: number;
  ok: number;
  missing: number;
};

const VEHICLE_SELECT = `
  id,
  registration_number,
  make,
  model,
  year,
  vin,
  fuel_type,
  odometer_km,
  status,
  assigned_admin_user_id,
  notes,
  created_at,
  updated_at,
  assigned_admin:admin_users ( id, name )
`;

function unwrapAdmin(
  row: FleetVehicleRow & { assigned_admin?: FleetVehicleRow["assigned_admin"] },
): FleetVehicleRow {
  const admin = row.assigned_admin;
  if (Array.isArray(admin)) {
    return { ...row, assigned_admin: admin[0] ?? null };
  }
  return row;
}

function alertSortRank(level: string): number {
  switch (level) {
    case "expired":
      return 0;
    case "critical":
      return 1;
    case "warning":
      return 2;
    case "ok":
      return 3;
    default:
      return 4;
  }
}

function earliestExpiry(
  summary: Record<FleetComplianceKind, { expires_on: string | null } | null>,
): string | null {
  const dates = FLEET_CORE_COMPLIANCE_KINDS.map((k) => summary[k]?.expires_on).filter(Boolean) as string[];
  if (!dates.length) return null;
  return dates.sort()[0] ?? null;
}

export async function fetchFleetComplianceForVehicles(
  supabase: SupabaseClient,
  vehicleIds: string[],
): Promise<Map<string, FleetComplianceRecordRow[]>> {
  const map = new Map<string, FleetComplianceRecordRow[]>();
  if (!vehicleIds.length) return map;

  const { data, error } = await supabase
    .from("fleet_compliance_records")
    .select("*")
    .in("vehicle_id", vehicleIds)
    .order("expires_on", { ascending: false });

  if (error) throw error;

  for (const row of (data ?? []) as FleetComplianceRecordRow[]) {
    const list = map.get(row.vehicle_id) ?? [];
    list.push(row);
    map.set(row.vehicle_id, list);
  }
  return map;
}

export function enrichFleetVehicleRow(
  row: FleetVehicleRow,
  complianceRecords: FleetComplianceRecordRow[],
): FleetVehicleListRow {
  const compliance_summary = buildComplianceSummaryMap(complianceRecords, FLEET_ALL_COMPLIANCE_KINDS);
  const overall_level = overallLevelFromSummary(compliance_summary, FLEET_CORE_COMPLIANCE_KINDS);
  return { ...row, compliance_summary, overall_level };
}

export async function listFleetVehicles(
  supabase: SupabaseClient,
  filters: FleetListFilters = {},
): Promise<FleetVehicleListRow[]> {
  const {
    status = "all",
    alertLevel = "all",
    q,
    assignedAdminUserId,
    sortBy = "registration",
    sortDir = "asc",
  } = filters;

  let query = supabase.from("fleet_vehicles").select(VEHICLE_SELECT);
  if (status !== "all") query = query.eq("status", status);
  if (assignedAdminUserId) query = query.eq("assigned_admin_user_id", assignedAdminUserId);
  if (q?.trim()) {
    const term = sanitizeIlikeTerm(q.trim());
    if (term) {
      query = query.or(
        `registration_number.ilike.%${term}%,make.ilike.%${term}%,model.ilike.%${term}%,vin.ilike.%${term}%`,
      );
    }
  }

  const { data, error } = await query.order("registration_number", { ascending: true });
  if (error) throw error;

  const rawRows = ((data ?? []) as FleetVehicleRow[]).map(unwrapAdmin);
  const ids = rawRows.map((r) => r.id);
  const complianceMap = await fetchFleetComplianceForVehicles(supabase, ids);

  let rows = rawRows.map((row) =>
    enrichFleetVehicleRow(row, complianceMap.get(row.id) ?? []),
  );

  if (alertLevel !== "all") {
    rows = rows.filter((r) => matchesAlertFilter(r.overall_level, alertLevel));
  }

  rows.sort((a, b) => {
    let cmp = 0;
    if (sortBy === "registration") {
      cmp = a.registration_number.localeCompare(b.registration_number, "bg");
    } else if (sortBy === "odometer") {
      cmp = a.odometer_km - b.odometer_km;
    } else {
      cmp = alertSortRank(a.overall_level) - alertSortRank(b.overall_level);
      if (cmp === 0) {
        const ea = earliestExpiry(a.compliance_summary);
        const eb = earliestExpiry(b.compliance_summary);
        if (ea && eb) cmp = ea.localeCompare(eb);
        else if (ea) cmp = -1;
        else if (eb) cmp = 1;
      }
    }
    return sortDir === "desc" ? -cmp : cmp;
  });

  return rows;
}

export async function getFleetVehicleById(
  supabase: SupabaseClient,
  id: string,
): Promise<FleetVehicleListRow | null> {
  const { data, error } = await supabase.from("fleet_vehicles").select(VEHICLE_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = unwrapAdmin(data as FleetVehicleRow);
  const { data: compliance } = await supabase
    .from("fleet_compliance_records")
    .select("*")
    .eq("vehicle_id", id)
    .order("expires_on", { ascending: false });

  return enrichFleetVehicleRow(row, (compliance ?? []) as FleetComplianceRecordRow[]);
}

export async function fetchFleetComplianceHistory(
  supabase: SupabaseClient,
  vehicleId: string,
): Promise<FleetComplianceRecordRow[]> {
  const { data, error } = await supabase
    .from("fleet_compliance_records")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("expires_on", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FleetComplianceRecordRow[];
}

export async function fetchFleetMaintenanceHistory(
  supabase: SupabaseClient,
  vehicleId: string,
): Promise<FleetMaintenanceEventRow[]> {
  const { data, error } = await supabase
    .from("fleet_maintenance_events")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .order("performed_on", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FleetMaintenanceEventRow[];
}

export async function computeFleetSummary(supabase: SupabaseClient): Promise<FleetSummaryCounts> {
  const rows = await listFleetVehicles(supabase, { status: "active" });
  const summary: FleetSummaryCounts = {
    total: rows.length,
    critical: 0,
    warning: 0,
    ok: 0,
    missing: 0,
  };

  for (const row of rows) {
    const level = row.overall_level;
    if (level === "expired" || level === "critical") summary.critical += 1;
    else if (level === "warning") summary.warning += 1;
    else if (level === "ok") summary.ok += 1;
    else summary.missing += 1;
  }
  return summary;
}

export type FleetYearCosts = {
  year: number;
  compliance_eur: number;
  maintenance_eur: number;
  total_eur: number;
};

export async function computeFleetYearCosts(
  supabase: SupabaseClient,
  vehicleId: string,
  year = new Date().getFullYear(),
): Promise<FleetYearCosts> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const [{ data: compliance }, { data: maintenance }] = await Promise.all([
    supabase
      .from("fleet_compliance_records")
      .select("cost_eur, valid_from, expires_on, created_at")
      .eq("vehicle_id", vehicleId),
    supabase
      .from("fleet_maintenance_events")
      .select("cost_eur, performed_on")
      .eq("vehicle_id", vehicleId)
      .gte("performed_on", yearStart)
      .lte("performed_on", yearEnd),
  ]);

  const compliance_eur = (compliance ?? []).reduce((s, r) => {
    const anchor = r.valid_from ?? r.expires_on ?? String(r.created_at ?? "").slice(0, 10);
    if (!anchor || anchor < yearStart || anchor > yearEnd) return s;
    return s + Number(r.cost_eur ?? 0);
  }, 0);
  const maintenance_eur = (maintenance ?? []).reduce((s, r) => s + Number(r.cost_eur ?? 0), 0);

  return {
    year,
    compliance_eur,
    maintenance_eur,
    total_eur: compliance_eur + maintenance_eur,
  };
}
