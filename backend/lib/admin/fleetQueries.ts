import type { SupabaseClient } from "@supabase/supabase-js";
import { sanitizeIlikeTerm } from "@/lib/security/sanitizeSearchTerm";
import {
  FLEET_ALL_COMPLIANCE_KINDS,
  FLEET_CORE_COMPLIANCE_KINDS,
  fleetComplianceKindLabel,
  fleetMaintenanceKindLabel,
  normalizeFleetRegistration,
  type FleetComplianceKind,
  type FleetComplianceLevel,
  type FleetComplianceRecordRow,
  type FleetMaintenanceEventRow,
  type FleetMaintenanceKind,
  type FleetVehicleListRow,
  type FleetVehicleRow,
  type FleetVehicleStatus,
} from "./fleetTypes";
import {
  buildComplianceSummaryMap,
  complianceLevelFromExpiresOn,
  daysUntilExpiry,
  matchesAlertFilter,
  overallLevelFromSummary,
  pickLatestComplianceByKind,
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

export async function computeFleetSummaryByKind(
  supabase: SupabaseClient,
): Promise<Record<FleetComplianceKind, { expired: number; critical: number; warning: number; ok: number; missing: number }>> {
  const rows = await listFleetVehicles(supabase, { status: "active" });
  const breakdown = {} as Record<
    FleetComplianceKind,
    { expired: number; critical: number; warning: number; ok: number; missing: number }
  >;
  for (const kind of FLEET_ALL_COMPLIANCE_KINDS) {
    breakdown[kind] = { expired: 0, critical: 0, warning: 0, ok: 0, missing: 0 };
  }
  for (const row of rows) {
    for (const kind of FLEET_ALL_COMPLIANCE_KINDS) {
      const level = row.compliance_summary[kind]?.level ?? "missing";
      if (level === "expired") breakdown[kind].expired += 1;
      else if (level === "critical") breakdown[kind].critical += 1;
      else if (level === "warning") breakdown[kind].warning += 1;
      else if (level === "ok") breakdown[kind].ok += 1;
      else breakdown[kind].missing += 1;
    }
  }
  return breakdown;
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

export type FleetComplianceAlertRow = {
  vehicle_id: string;
  registration_number: string;
  kind: FleetComplianceKind;
  expires_on: string | null;
  level: FleetComplianceLevel;
  days_left: number | null;
  provider: string | null;
};

export type FleetComplianceAlertFilters = {
  kind?: FleetComplianceKind | "all";
  daysAhead?: number;
  level?: "all" | "alert" | "critical";
};

export async function listFleetComplianceAlerts(
  supabase: SupabaseClient,
  filters: FleetComplianceAlertFilters = {},
): Promise<FleetComplianceAlertRow[]> {
  const { kind = "all", daysAhead = 30, level = "all" } = filters;
  const kinds: FleetComplianceKind[] =
    kind === "all" ? [...FLEET_ALL_COMPLIANCE_KINDS] : [kind];

  const vehicles = await listFleetVehicles(supabase, { status: "active" });
  const ids = vehicles.map((v) => v.id);
  const complianceMap = await fetchFleetComplianceForVehicles(supabase, ids);

  const alerts: FleetComplianceAlertRow[] = [];

  for (const vehicle of vehicles) {
    const records = complianceMap.get(vehicle.id) ?? [];
    for (const k of kinds) {
      const latest = pickLatestComplianceByKind(records, k);
      const expiresOn = latest?.expires_on ?? null;
      const alertLevel = latest
        ? complianceLevelFromExpiresOn(expiresOn)
        : ("missing" as FleetComplianceLevel);
      const daysLeft = expiresOn ? daysUntilExpiry(expiresOn) : null;

      const withinWindow =
        alertLevel === "missing" ||
        alertLevel === "expired" ||
        alertLevel === "critical" ||
        alertLevel === "warning" ||
        (daysLeft !== null && daysLeft >= 0 && daysLeft <= daysAhead);

      if (!withinWindow) continue;
      if (!matchesAlertFilter(alertLevel, level === "all" ? "all" : level)) continue;

      alerts.push({
        vehicle_id: vehicle.id,
        registration_number: vehicle.registration_number,
        kind: k,
        expires_on: expiresOn,
        level: alertLevel,
        days_left: daysLeft,
        provider: latest?.provider ?? null,
      });
    }
  }

  alerts.sort((a, b) => {
    const rank = (l: FleetComplianceLevel) => {
      switch (l) {
        case "expired":
          return 0;
        case "critical":
          return 1;
        case "warning":
          return 2;
        case "missing":
          return 3;
        default:
          return 4;
      }
    };
    const cmp = rank(a.level) - rank(b.level);
    if (cmp !== 0) return cmp;
    if (a.days_left != null && b.days_left != null) return a.days_left - b.days_left;
    return a.registration_number.localeCompare(b.registration_number, "bg");
  });

  return alerts;
}

export type FleetCostAggregate = {
  year: number;
  totals: {
    compliance_eur: number;
    maintenance_eur: number;
    repair_eur: number;
    total_eur: number;
  };
  byMonth: Array<{
    month: string;
    compliance_eur: number;
    maintenance_eur: number;
    repair_eur: number;
    total_eur: number;
  }>;
  byKind: Array<{ kind: string; label: string; total_eur: number }>;
  byVehicle: Array<{
    vehicle_id: string;
    registration: string;
    compliance_eur: number;
    maintenance_eur: number;
    repair_eur: number;
    total_eur: number;
  }>;
};

function maintenanceEventCost(row: FleetMaintenanceEventRow): number {
  const base = Number(row.cost_eur ?? 0);
  const parts = Number(row.parts_cost_eur ?? 0);
  const labor = Number(row.labor_cost_eur ?? 0);
  if (row.kind === "repair") return base + parts + labor;
  return base;
}

export async function aggregateFleetCosts(
  supabase: SupabaseClient,
  year = new Date().getFullYear(),
  vehicleId?: string,
): Promise<FleetCostAggregate> {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  let vehicleQuery = supabase.from("fleet_vehicles").select("id, registration_number").eq("status", "active");
  if (vehicleId) vehicleQuery = vehicleQuery.eq("id", vehicleId);
  const { data: vehicleRows, error: vehicleErr } = await vehicleQuery;
  if (vehicleErr) throw vehicleErr;

  const vehicles = (vehicleRows ?? []) as Array<{ id: string; registration_number: string }>;
  const vehicleIds = vehicles.map((v) => v.id);

  const byMonthMap = new Map<string, { compliance_eur: number; maintenance_eur: number; repair_eur: number }>();
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    byMonthMap.set(key, { compliance_eur: 0, maintenance_eur: 0, repair_eur: 0 });
  }

  const byKindMap = new Map<string, number>();
  const byVehicleMap = new Map<
    string,
    { registration: string; compliance_eur: number; maintenance_eur: number; repair_eur: number }
  >();
  for (const v of vehicles) {
    byVehicleMap.set(v.id, {
      registration: v.registration_number,
      compliance_eur: 0,
      maintenance_eur: 0,
      repair_eur: 0,
    });
  }

  const totals = { compliance_eur: 0, maintenance_eur: 0, repair_eur: 0, total_eur: 0 };

  if (vehicleIds.length) {
    const [{ data: compliance }, { data: maintenance }] = await Promise.all([
      supabase.from("fleet_compliance_records").select("*").in("vehicle_id", vehicleIds),
      supabase
        .from("fleet_maintenance_events")
        .select("*")
        .in("vehicle_id", vehicleIds)
        .gte("performed_on", yearStart)
        .lte("performed_on", yearEnd),
    ]);

    for (const row of (compliance ?? []) as FleetComplianceRecordRow[]) {
      const anchor = row.valid_from ?? row.expires_on ?? String(row.created_at ?? "").slice(0, 10);
      if (!anchor || anchor < yearStart || anchor > yearEnd) continue;
      const cost = Number(row.cost_eur ?? 0);
      const month = anchor.slice(0, 7);
      const monthBucket = byMonthMap.get(month);
      if (monthBucket) monthBucket.compliance_eur += cost;
      byKindMap.set(row.kind, (byKindMap.get(row.kind) ?? 0) + cost);
      const vBucket = byVehicleMap.get(row.vehicle_id);
      if (vBucket) vBucket.compliance_eur += cost;
      totals.compliance_eur += cost;
    }

    for (const row of (maintenance ?? []) as FleetMaintenanceEventRow[]) {
      const cost = maintenanceEventCost(row);
      const month = row.performed_on.slice(0, 7);
      const monthBucket = byMonthMap.get(month);
      const vBucket = byVehicleMap.get(row.vehicle_id);
      if (row.kind === "repair") {
        if (monthBucket) monthBucket.repair_eur += cost;
        if (vBucket) vBucket.repair_eur += cost;
        totals.repair_eur += cost;
        byKindMap.set("repair", (byKindMap.get("repair") ?? 0) + cost);
      } else {
        if (monthBucket) monthBucket.maintenance_eur += cost;
        if (vBucket) vBucket.maintenance_eur += cost;
        totals.maintenance_eur += cost;
        byKindMap.set(row.kind, (byKindMap.get(row.kind) ?? 0) + cost);
      }
    }
  }

  totals.total_eur = totals.compliance_eur + totals.maintenance_eur + totals.repair_eur;

  function kindLabel(kind: string): string {
    if (kind === "repair") return "Ремонт";
    if ((FLEET_ALL_COMPLIANCE_KINDS as string[]).includes(kind)) {
      return fleetComplianceKindLabel(kind as FleetComplianceKind);
    }
    return fleetMaintenanceKindLabel(kind as FleetMaintenanceKind);
  }

  return {
    year,
    totals,
    byMonth: [...byMonthMap.entries()].map(([month, v]) => ({
      month,
      ...v,
      total_eur: v.compliance_eur + v.maintenance_eur + v.repair_eur,
    })),
    byKind: [...byKindMap.entries()]
      .map(([kind, total_eur]) => ({
        kind,
        label: kindLabel(kind),
        total_eur,
      }))
      .sort((a, b) => b.total_eur - a.total_eur),
    byVehicle: [...byVehicleMap.entries()]
      .map(([vehicle_id, v]) => ({
        vehicle_id,
        registration: v.registration,
        compliance_eur: v.compliance_eur,
        maintenance_eur: v.maintenance_eur,
        repair_eur: v.repair_eur,
        total_eur: v.compliance_eur + v.maintenance_eur + v.repair_eur,
      }))
      .filter((v) => v.total_eur > 0 || vehicleId)
      .sort((a, b) => b.total_eur - a.total_eur),
  };
}

export async function getFleetVehicleByRegistration(
  supabase: SupabaseClient,
  registrationNumber: string,
): Promise<FleetVehicleListRow | null> {
  const normalized = normalizeFleetRegistration(registrationNumber);
  if (!normalized) return null;
  const { data, error } = await supabase
    .from("fleet_vehicles")
    .select(VEHICLE_SELECT)
    .eq("registration_number", normalized)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const term = sanitizeIlikeTerm(registrationNumber.trim());
    if (!term) return null;
    const { data: fuzzy, error: fuzzyErr } = await supabase
      .from("fleet_vehicles")
      .select(VEHICLE_SELECT)
      .ilike("registration_number", `%${term}%`)
      .limit(1)
      .maybeSingle();
    if (fuzzyErr) throw fuzzyErr;
    if (!fuzzy) return null;
    const row = unwrapAdmin(fuzzy as FleetVehicleRow);
    const { data: compliance } = await supabase
      .from("fleet_compliance_records")
      .select("*")
      .eq("vehicle_id", row.id)
      .order("expires_on", { ascending: false });
    return enrichFleetVehicleRow(row, (compliance ?? []) as FleetComplianceRecordRow[]);
  }
  const row = unwrapAdmin(data as FleetVehicleRow);
  const { data: compliance } = await supabase
    .from("fleet_compliance_records")
    .select("*")
    .eq("vehicle_id", row.id)
    .order("expires_on", { ascending: false });
  return enrichFleetVehicleRow(row, (compliance ?? []) as FleetComplianceRecordRow[]);
}
