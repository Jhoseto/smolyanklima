import type { SupabaseClient } from "@supabase/supabase-js";
import {
  aggregateFleetCosts,
  computeFleetSummary,
  computeFleetSummaryByKind,
  computeFleetYearCosts,
  fetchFleetComplianceHistory,
  fetchFleetMaintenanceHistory,
  fetchFleetMiscExpenses,
  getFleetVehicleById,
  getFleetVehicleByRegistration,
  listFleetComplianceAlerts,
  listFleetVehicles,
  type FleetListFilters,
} from "@/lib/admin/fleetQueries";
import {
  fleetComplianceKindLabel,
  fleetFuelTypeLabel,
  fleetMaintenanceKindLabel,
  fleetMiscExpenseCategoryLabel,
  fleetVehicleStatusLabel,
  type FleetComplianceKind,
  type FleetVehicleStatus,
} from "@/lib/admin/fleetTypes";
import { fleetComplianceLevelLabel } from "@/lib/admin/fleetComplianceStatus";
import {
  aggregateContainerCosts,
  getContainerByExactName,
  getContainerWithProducts,
  listContainers,
} from "@/lib/admin/containerQueries";
import { truncateToolResult } from "@/lib/ai/agent/truncateToolResult";
import { humanizeAdminDisplayText } from "@/lib/admin/activityLogLabels";

function formatDateBg(iso: string | null | undefined): string {
  if (!iso?.trim()) return "—";
  try {
    return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString("bg-BG", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatEur(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null;
  return `${value.toLocaleString("bg-BG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

const STOCK_STATUS_LABELS: Record<string, string> = {
  in_stock: "В наличност",
  out_of_stock: "Продаден",
  on_order: "По поръчка",
  reserved: "Резервиран",
  scrapped: "Бракуван",
  available: "Наличен",
  sold: "Продаден",
};

function stockStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  return STOCK_STATUS_LABELS[status] ?? humanizeAdminDisplayText(status);
}

function complianceKindLabel(kind: string): string {
  return fleetComplianceKindLabel(kind as FleetComplianceKind);
}

function formatComplianceExpiry(iso: string | null | undefined, level: string): string {
  const date = formatDateBg(iso);
  if (level === "missing") return "Липсва";
  return date;
}

export async function executeGetFleetSummary(db: SupabaseClient): Promise<Record<string, unknown>> {
  const [summary, byKind] = await Promise.all([computeFleetSummary(db), computeFleetSummaryByKind(db)]);

  const kindBreakdown = Object.entries(byKind).map(([kind, counts]) => ({
    kind: complianceKindLabel(kind),
    expired: counts.expired,
    critical: counts.critical,
    warning: counts.warning,
    ok: counts.ok,
    missing: counts.missing,
  }));

  return truncateToolResult({
    summary: {
      total: summary.total,
      critical: summary.critical,
      warning: summary.warning,
      ok: summary.ok,
      missing: summary.missing,
    },
    byComplianceKind: kindBreakdown,
    adminLink: "/admin/fleet",
    chartSuggestion: {
      chartType: "pie",
      title: "Статус на автопарка",
      labels: ["OK", "Скоро", "Критично", "Липсва"],
      values: [summary.ok, summary.warning, summary.critical, summary.missing],
    },
    note: "critical включва изтекли и ≤7 дни. Ползвай summary/chartSuggestion — не изброявай всички МПС.",
  });
}

export async function executeQueryFleetVehicles(
  db: SupabaseClient,
  args: Record<string, unknown>,
  limit: number,
): Promise<Record<string, unknown>> {
  const filters: FleetListFilters = {
    status: (args.status as FleetVehicleStatus | "all") ?? "active",
    alertLevel: (args.alertLevel as FleetListFilters["alertLevel"]) ?? "all",
    q: args.q ? String(args.q) : undefined,
    assignedAdminUserId: args.assignedAdmin ? String(args.assignedAdmin) : undefined,
    sortBy: (args.sortBy as FleetListFilters["sortBy"]) ?? "registration",
    sortDir: (args.sortDir as FleetListFilters["sortDir"]) ?? "asc",
  };

  let rows = await listFleetVehicles(db, filters);
  if (rows.length > limit) rows = rows.slice(0, limit);

  const critical = rows.filter((r) => r.overall_level === "expired" || r.overall_level === "critical").length;
  const warning = rows.filter((r) => r.overall_level === "warning").length;

  const vehicles = rows.map((r) => ({
    registration: r.registration_number,
    make: r.make,
    model: r.model,
    status: fleetVehicleStatusLabel(r.status),
    overallStatus: fleetComplianceLevelLabel(r.overall_level),
    odometerKm: r.odometer_km,
    assignedAdmin: r.assigned_admin
      ? Array.isArray(r.assigned_admin)
        ? r.assigned_admin[0]?.name ?? null
        : r.assigned_admin.name
      : null,
    vignette: formatComplianceExpiry(r.compliance_summary.vignette?.expires_on, r.compliance_summary.vignette?.level ?? "missing"),
    civilLiability: formatComplianceExpiry(
      r.compliance_summary.civil_liability?.expires_on,
      r.compliance_summary.civil_liability?.level ?? "missing",
    ),
    technicalInspection: formatComplianceExpiry(
      r.compliance_summary.technical_inspection?.expires_on,
      r.compliance_summary.technical_inspection?.level ?? "missing",
    ),
    kasko: r.compliance_summary.kasko
      ? formatComplianceExpiry(r.compliance_summary.kasko.expires_on, r.compliance_summary.kasko.level)
      : undefined,
    adminLink: "/admin/fleet",
  }));

  return truncateToolResult({
    summary: { count: rows.length, critical, warning },
    vehicles,
    chartSuggestion: {
      chartType: "pie",
      title: "МПС по alert ниво",
      labels: ["Критично", "Скоро", "OK", "Други"],
      values: [
        critical,
        warning,
        rows.filter((r) => r.overall_level === "ok").length,
        rows.length - critical - warning - rows.filter((r) => r.overall_level === "ok").length,
      ],
    },
    adminLink: "/admin/fleet",
  });
}

export async function executeGetFleetVehicleDetail(
  db: SupabaseClient,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = args.id ? String(args.id) : null;
  const reg = args.registrationNumber ? String(args.registrationNumber) : null;

  let vehicle = id ? await getFleetVehicleById(db, id) : null;
  if (!vehicle && reg) vehicle = await getFleetVehicleByRegistration(db, reg);
  if (!vehicle) return { error: "МПС не е намерено. Провери id или registrationNumber." };

  const year = Number(args.year) || new Date().getFullYear();
  const [complianceHistory, maintenanceHistory, miscExpenses, yearCosts] = await Promise.all([
    fetchFleetComplianceHistory(db, vehicle.id),
    fetchFleetMaintenanceHistory(db, vehicle.id),
    fetchFleetMiscExpenses(db, vehicle.id, year),
    computeFleetYearCosts(db, vehicle.id, year),
  ]);

  const compliance = complianceHistory.map((r) => ({
    kind: complianceKindLabel(r.kind),
    validFrom: formatDateBg(r.valid_from),
    expiresOn: formatDateBg(r.expires_on),
    provider: r.provider ?? "—",
    reference: r.reference_number ?? "—",
    cost: formatEur(r.cost_eur),
  }));

  const maintenance = maintenanceHistory.slice(0, 30).map((m) => ({
    kind: fleetMaintenanceKindLabel(m.kind),
    title: m.title,
    performedOn: formatDateBg(m.performed_on),
    odometerKm: m.odometer_km,
    cost: formatEur(m.cost_eur),
    partsCost: formatEur(m.parts_cost_eur),
    laborCost: formatEur(m.labor_cost_eur),
    vendor: m.vendor ?? "—",
  }));

  const complianceSummary = Object.entries(vehicle.compliance_summary)
    .filter(([, v]) => v != null)
    .map(([kind, item]) => ({
      kind: complianceKindLabel(kind),
      expiresOn: formatDateBg(item!.expires_on),
      status: fleetComplianceLevelLabel(item!.level),
      daysLeft: item!.days_left,
      provider: item!.provider ?? "—",
    }));

  return truncateToolResult({
    vehicle: {
      registration: vehicle.registration_number,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vin: vehicle.vin ?? "—",
      fuel: fleetFuelTypeLabel(vehicle.fuel_type),
      odometerKm: vehicle.odometer_km,
      status: fleetVehicleStatusLabel(vehicle.status),
      overallStatus: fleetComplianceLevelLabel(vehicle.overall_level),
      notes: vehicle.notes ?? null,
      adminLink: "/admin/fleet",
    },
    complianceSummary,
    complianceHistory: compliance,
    maintenanceHistory: maintenance,
    miscExpenses: miscExpenses.slice(0, 20).map((e) => ({
      category: fleetMiscExpenseCategoryLabel(e.category),
      title: e.title,
      date: formatDateBg(e.expense_date),
      cost: formatEur(e.cost_eur),
    })),
    yearCosts: {
      year: yearCosts.year,
      compliance: formatEur(yearCosts.compliance_eur),
      maintenance: formatEur(yearCosts.maintenance_eur),
      repair: formatEur(yearCosts.repair_eur),
      misc: formatEur(yearCosts.misc_eur),
      total: formatEur(yearCosts.total_eur),
    },
  });
}

export async function executeQueryFleetComplianceAlerts(
  db: SupabaseClient,
  args: Record<string, unknown>,
  limit: number,
): Promise<Record<string, unknown>> {
  const kind = args.kind ? String(args.kind) : "all";
  const daysAhead = Math.min(Number(args.daysAhead ?? 30) || 30, 365);
  const level = (args.level ?? args.alertLevel) as "all" | "alert" | "critical" | undefined;

  let alerts = await listFleetComplianceAlerts(db, {
    kind: kind === "all" ? "all" : (kind as FleetComplianceKind),
    daysAhead,
    level: level ?? "alert",
  });
  if (alerts.length > limit) alerts = alerts.slice(0, limit);

  const byKind = new Map<string, number>();
  for (const a of alerts) {
    const label = complianceKindLabel(a.kind);
    byKind.set(label, (byKind.get(label) ?? 0) + 1);
  }

  return truncateToolResult({
    summary: {
      count: alerts.length,
      daysAhead,
      critical: alerts.filter((a) => a.level === "expired" || a.level === "critical").length,
      warning: alerts.filter((a) => a.level === "warning").length,
    },
    alerts: alerts.map((a) => ({
      registration: a.registration_number,
      kind: complianceKindLabel(a.kind),
      expiresOn: formatDateBg(a.expires_on),
      status: fleetComplianceLevelLabel(a.level as Parameters<typeof fleetComplianceLevelLabel>[0]),
      daysLeft: a.days_left,
      provider: a.provider ?? "—",
      adminLink: "/admin/fleet",
    })),
    chartSuggestion: {
      chartType: "bar",
      title: "Аларми по вид срок",
      labels: [...byKind.keys()],
      values: [...byKind.values()],
    },
    adminLink: "/admin/fleet",
    note: "Подновяване: /admin/fleet → избери МПС → Подновяване на срок.",
  });
}

export async function executeAggregateFleetCosts(
  db: SupabaseClient,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const year = Number(args.year) || new Date().getFullYear();
  const vehicleId = args.vehicleId ? String(args.vehicleId) : undefined;
  const agg = await aggregateFleetCosts(db, year, vehicleId);

  const byMonthFormatted = agg.byMonth.map((m) => ({
    month: m.month,
    compliance: formatEur(m.compliance_eur),
    maintenance: formatEur(m.maintenance_eur),
    repair: formatEur(m.repair_eur),
    misc: formatEur(m.misc_eur),
    total: formatEur(m.total_eur),
  }));

  const byKindFormatted = agg.byKind.map((k) => ({
    kind: k.label,
    total: formatEur(k.total_eur),
  }));

  return truncateToolResult({
    year,
    totals: {
      compliance: formatEur(agg.totals.compliance_eur),
      maintenance: formatEur(agg.totals.maintenance_eur),
      repair: formatEur(agg.totals.repair_eur),
      misc: formatEur(agg.totals.misc_eur),
      total: formatEur(agg.totals.total_eur),
    },
    byMonth: byMonthFormatted,
    byKind: byKindFormatted,
    topVehicles: agg.byVehicle.slice(0, 15).map((v) => ({
      registration: v.registration,
      compliance: formatEur(v.compliance_eur),
      maintenance: formatEur(v.maintenance_eur),
      repair: formatEur(v.repair_eur),
      misc: formatEur(v.misc_eur),
      total: formatEur(v.total_eur),
      adminLink: "/admin/fleet",
    })),
    chartSuggestion: {
      chartType: "bar",
      title: `Разходи автопарк ${year} по месец`,
      labels: agg.byMonth.map((m) => {
        const [, mo] = m.month.split("-");
        const names = ["", "Ян", "Фев", "Мар", "Апр", "Май", "Юни", "Юли", "Авг", "Сеп", "Окт", "Ное", "Дек"];
        return names[Number(mo)] ?? m.month;
      }),
      values: agg.byMonth.map((m) => m.total_eur),
    },
    adminLink: "/admin/fleet",
  });
}

export async function executeQueryContainers(
  db: SupabaseClient,
  args: Record<string, unknown>,
  limit: number,
): Promise<Record<string, unknown>> {
  const year = args.year ? Number(args.year) : undefined;
  const { data, total } = await listContainers(db, {
    year: year && !Number.isNaN(year) ? year : undefined,
    q: args.q ? String(args.q) : undefined,
    sortBy: (args.sortBy as "name" | "year" | "arrival_date" | "created_at") ?? "year",
    sortDir: (args.sortDir as "asc" | "desc") ?? "desc",
    perPage: limit,
  });

  const totalProducts = data.reduce((s, c) => s + c.product_count, 0);
  const totalCost = data.reduce((s, c) => s + (c.total_cost_eur ?? 0), 0);

  return truncateToolResult({
    summary: {
      count: data.length,
      totalInDb: total,
      totalProducts,
      totalCostEur: formatEur(totalCost),
      year: year ?? null,
    },
    containers: data.map((c) => ({
      id: c.id,
      name: c.name,
      year: c.year,
      arrivalDate: formatDateBg(c.arrival_date),
      supplier: c.supplier_name ?? "—",
      productCount: c.product_count,
      totalCost: formatEur(c.total_cost_eur),
      avgCostPerUnit:
        c.product_count > 0 && c.total_cost_eur != null ? formatEur(c.total_cost_eur / c.product_count) : null,
      adminLink: `/admin/containers`,
    })),
    chartSuggestion: data.length
      ? {
          chartType: "bar",
          title: "Климатици по контейнер",
          labels: data.slice(0, 10).map((c) => c.name),
          values: data.slice(0, 10).map((c) => c.product_count),
        }
      : undefined,
    adminLink: "/admin/containers",
  });
}

export async function executeGetContainerDetail(
  db: SupabaseClient,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const id = args.id ? String(args.id) : null;
  const name = args.name ? String(args.name).trim() : null;

  let container = id ? await getContainerWithProducts(db, id) : null;
  if (!container && name) {
    const match = await getContainerByExactName(db, name);
    if (match) container = await getContainerWithProducts(db, match.id);
  }
  if (!container) return { error: "Контейнерът не е намерен." };

  return truncateToolResult({
    container: {
      id: container.id,
      name: container.name,
      year: container.year,
      arrivalDate: formatDateBg(container.arrival_date),
      departureDate: formatDateBg(container.departure_date ?? null),
      supplier: container.supplier_name ?? "—",
      productCount: container.product_count,
      costs: {
        japanPrice: formatEur(container.japan_price),
        customsDuty: formatEur(container.customs_duty),
        vat: formatEur(container.vat_amount),
        transportToBulgaria: formatEur(container.transport_to_bulgaria),
        transportToSmolyan: formatEur(container.transport_to_smolyan),
        total: formatEur(container.total_cost_eur),
        avgPerUnit:
          container.product_count > 0 && container.total_cost_eur != null
            ? formatEur(container.total_cost_eur / container.product_count)
            : null,
      },
      notes: container.notes ?? null,
      adminLink: "/admin/containers",
    },
    products: container.products.map((p) => ({
      name: p.name,
      indoorSerial: p.indoor_unit_serial ?? "—",
      outdoorSerial: p.outdoor_unit_serial ?? "—",
      stockStatus: stockStatusLabel(p.stock_status),
      adminLink: `/admin/products/${p.id}`,
    })),
  });
}

export async function executeAggregateContainerCosts(
  db: SupabaseClient,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const year = args.year ? Number(args.year) : undefined;
  const agg = await aggregateContainerCosts(db, year && !Number.isNaN(year) ? year : undefined);

  return truncateToolResult({
    year: agg.year,
    summary: {
      containerCount: agg.containerCount,
      totalProducts: agg.totalProducts,
      totalCostEur: formatEur(agg.totalCostEur),
      avgCostPerUnit: formatEur(agg.avgCostPerUnit),
    },
    byContainer: agg.byContainer.slice(0, 20).map((c) => ({
      name: c.name,
      year: c.year,
      productCount: c.product_count,
      totalCost: formatEur(c.total_cost_eur),
      avgCostPerUnit: formatEur(c.avg_cost_per_unit),
      adminLink: "/admin/containers",
    })),
    chartSuggestion: agg.byContainer.length
      ? {
          chartType: "bar",
          title: agg.year ? `Разходи по контейнери ${agg.year}` : "Разходи по контейнери",
          labels: agg.byContainer.slice(0, 8).map((c) => c.name),
          values: agg.byContainer.slice(0, 8).map((c) => c.total_cost_eur ?? 0),
        }
      : undefined,
    adminLink: "/admin/containers",
  });
}

export const MODULE_AGENT_FUNCTION_DECLARATIONS = [
  {
    name: "get_fleet_summary",
    description: "Fleet KPI: total vehicles, critical/warning/ok counts, breakdown by compliance kind",
    parameters: { type: "OBJECT", properties: {} },
  },
  {
    name: "query_fleet_vehicles",
    description: "List fleet vehicles with filters: q, status, alertLevel, assignedAdmin, sort",
    parameters: {
      type: "OBJECT",
      properties: {
        q: { type: "STRING" },
        status: { type: "STRING" },
        alertLevel: { type: "STRING" },
        assignedAdmin: { type: "STRING" },
        sortBy: { type: "STRING" },
        sortDir: { type: "STRING" },
        limit: { type: "INTEGER" },
      },
    },
  },
  {
    name: "get_fleet_vehicle_detail",
    description: "Vehicle detail by id or registrationNumber: compliance history, maintenance, year costs",
    parameters: {
      type: "OBJECT",
      properties: {
        id: { type: "STRING" },
        registrationNumber: { type: "STRING" },
        year: { type: "INTEGER" },
      },
    },
  },
  {
    name: "query_fleet_compliance_alerts",
    description: "Cross-fleet expiring/expired compliance by kind and daysAhead",
    parameters: {
      type: "OBJECT",
      properties: {
        kind: { type: "STRING" },
        daysAhead: { type: "INTEGER" },
        alertLevel: { type: "STRING" },
        limit: { type: "INTEGER" },
      },
    },
  },
  {
    name: "aggregate_fleet_costs",
    description: "Fleet costs by year/month/kind/vehicle; compliance vs maintenance vs repair vs misc",
    parameters: {
      type: "OBJECT",
      properties: {
        year: { type: "INTEGER" },
        vehicleId: { type: "STRING" },
      },
    },
  },
  {
    name: "query_containers",
    description: "List containers with product_count, total cost; filters year, q",
    parameters: {
      type: "OBJECT",
      properties: {
        year: { type: "INTEGER" },
        q: { type: "STRING" },
        sortBy: { type: "STRING" },
        sortDir: { type: "STRING" },
        limit: { type: "INTEGER" },
      },
    },
  },
  {
    name: "get_container_detail",
    description: "Container detail with products (name, serial, stock_status)",
    parameters: {
      type: "OBJECT",
      properties: {
        id: { type: "STRING" },
        name: { type: "STRING" },
      },
    },
  },
  {
    name: "aggregate_container_costs",
    description: "Container cost summary by year, avg cost per unit",
    parameters: {
      type: "OBJECT",
      properties: {
        year: { type: "INTEGER" },
      },
    },
  },
];

export async function executeModuleAgentTool(
  name: string,
  args: Record<string, unknown>,
  db: SupabaseClient,
  limit: number,
): Promise<Record<string, unknown> | null> {
  try {
    switch (name) {
      case "get_fleet_summary":
        return executeGetFleetSummary(db);
      case "query_fleet_vehicles":
        return executeQueryFleetVehicles(db, args, limit);
      case "get_fleet_vehicle_detail":
        return executeGetFleetVehicleDetail(db, args);
      case "query_fleet_compliance_alerts":
        return executeQueryFleetComplianceAlerts(db, args, limit);
      case "aggregate_fleet_costs":
        return executeAggregateFleetCosts(db, args);
      case "query_containers":
        return executeQueryContainers(db, args, limit);
      case "get_container_detail":
        return executeGetContainerDetail(db, args);
      case "aggregate_container_costs":
        return executeAggregateContainerCosts(db, args);
      default:
        return null;
    }
  } catch (e: unknown) {
    return { error: String(e instanceof Error ? e.message : e) };
  }
}
