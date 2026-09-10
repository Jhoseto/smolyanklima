export type FleetVehicleStatus = "active" | "inactive" | "sold";
export type FleetFuelType = "petrol" | "diesel" | "lpg" | "electric" | "hybrid";
export type FleetComplianceKind = "vignette" | "civil_liability" | "technical_inspection" | "kasko";
export type FleetServiceKind =
  | "scheduled_service"
  | "oil"
  | "filters"
  | "tires_change"
  | "tires_purchase"
  | "consumables";

export type FleetMaintenanceKind = FleetServiceKind | "repair";

export const FLEET_SERVICE_KINDS: FleetServiceKind[] = [
  "scheduled_service",
  "oil",
  "filters",
  "tires_change",
  "tires_purchase",
  "consumables",
];

export function isFleetRepairKind(kind: FleetMaintenanceKind): boolean {
  return kind === "repair";
}
export type FleetComplianceLevel = "expired" | "critical" | "warning" | "ok" | "missing";

export const FLEET_CORE_COMPLIANCE_KINDS: FleetComplianceKind[] = [
  "vignette",
  "civil_liability",
  "technical_inspection",
];

export const FLEET_ALL_COMPLIANCE_KINDS: FleetComplianceKind[] = [
  ...FLEET_CORE_COMPLIANCE_KINDS,
  "kasko",
];

export type FleetComplianceRecordRow = {
  id: string;
  vehicle_id: string;
  kind: FleetComplianceKind;
  valid_from: string | null;
  expires_on: string;
  provider: string | null;
  reference_number: string | null;
  cost_eur: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FleetMaintenanceEventRow = {
  id: string;
  vehicle_id: string;
  kind: FleetMaintenanceKind;
  title: string;
  performed_on: string;
  odometer_km: number | null;
  cost_eur: number | null;
  parts_description: string | null;
  parts_cost_eur: number | null;
  labor_cost_eur: number | null;
  vendor: string | null;
  next_due_date: string | null;
  next_due_km: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type FleetVehicleRow = {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  year: number | null;
  vin: string | null;
  fuel_type: FleetFuelType;
  odometer_km: number;
  status: FleetVehicleStatus;
  assigned_admin_user_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  assigned_admin?: { id: string; name: string } | { id: string; name: string }[] | null;
};

export type FleetComplianceSummaryItem = {
  kind: FleetComplianceKind;
  expires_on: string | null;
  provider: string | null;
  reference_number: string | null;
  level: FleetComplianceLevel;
  days_left: number | null;
  record_id: string | null;
};

export type FleetVehicleListRow = FleetVehicleRow & {
  compliance_summary: Record<FleetComplianceKind, FleetComplianceSummaryItem | null>;
  overall_level: FleetComplianceLevel;
};

export function fleetAssignedAdminName(
  admin: FleetVehicleRow["assigned_admin"],
): string | null {
  if (!admin) return null;
  if (Array.isArray(admin)) return admin[0]?.name ?? null;
  return admin.name ?? null;
}

export function normalizeFleetRegistration(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "");
}

export function fleetComplianceKindLabel(kind: FleetComplianceKind): string {
  switch (kind) {
    case "vignette":
      return "Винетка";
    case "civil_liability":
      return "Гражданска отговорност";
    case "technical_inspection":
      return "Преглед";
    case "kasko":
      return "Каско";
    default:
      return kind;
  }
}

export function fleetMaintenanceKindLabel(kind: FleetMaintenanceKind): string {
  switch (kind) {
    case "scheduled_service":
      return "Периодичен сервиз";
    case "oil":
      return "Смяна на масло";
    case "filters":
      return "Филтри";
    case "tires_change":
      return "Смяна на гуми";
    case "tires_purchase":
      return "Нови гуми";
    case "consumables":
      return "Консумативи";
    case "repair":
      return "Ремонт";
    default:
      return kind;
  }
}

export function fleetVehicleStatusLabel(status: FleetVehicleStatus): string {
  switch (status) {
    case "active":
      return "Активно";
    case "inactive":
      return "Неактивно";
    case "sold":
      return "Продадено";
    default:
      return status;
  }
}

export type FleetMiscExpenseCategory = "fine" | "toll" | "parking" | "other";

export const FLEET_MISC_EXPENSE_CATEGORIES: FleetMiscExpenseCategory[] = [
  "fine",
  "toll",
  "parking",
  "other",
];

export type FleetMiscExpenseRow = {
  id: string;
  vehicle_id: string;
  category: FleetMiscExpenseCategory;
  title: string;
  expense_date: string;
  cost_eur: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function fleetMiscExpenseCategoryLabel(category: FleetMiscExpenseCategory): string {
  switch (category) {
    case "fine":
      return "Глоба";
    case "toll":
      return "Пътна такса";
    case "parking":
      return "Паркинг";
    case "other":
      return "Друго";
    default:
      return category;
  }
}

export function fleetFuelTypeLabel(fuel: FleetFuelType): string {
  switch (fuel) {
    case "petrol":
      return "Бензин";
    case "diesel":
      return "Дизел";
    case "lpg":
      return "Газ";
    case "electric":
      return "Електро";
    case "hybrid":
      return "Хибрид";
    default:
      return fuel;
  }
}
