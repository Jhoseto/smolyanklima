import type { FleetMaintenanceKind } from "./fleetTypes";
import { isFleetRepairKind } from "./fleetTypes";

export type FleetMaintenanceInsertPayload = {
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
};

export function resolveFleetMaintenanceCostEur(input: {
  kind: FleetMaintenanceKind;
  costEur?: number | null;
  partsCostEur?: number | null;
  laborCostEur?: number | null;
}): number | null {
  const parts = input.partsCostEur ?? null;
  const labor = input.laborCostEur ?? null;
  if (parts != null || labor != null) {
    return (parts ?? 0) + (labor ?? 0);
  }
  return input.costEur ?? null;
}

export function buildFleetMaintenanceInsertPayload(input: {
  vehicleId: string;
  kind: FleetMaintenanceKind;
  title: string;
  performedOn: string;
  odometerKm?: number | null;
  costEur?: number | null;
  partsDescription?: string | null;
  partsCostEur?: number | null;
  laborCostEur?: number | null;
  vendor?: string | null;
  nextDueDate?: string | null;
  nextDueKm?: number | null;
  notes?: string | null;
}): FleetMaintenanceInsertPayload {
  const repair = isFleetRepairKind(input.kind);
  return {
    vehicle_id: input.vehicleId,
    kind: input.kind,
    title: input.title.trim(),
    performed_on: input.performedOn,
    odometer_km: input.odometerKm ?? null,
    cost_eur: resolveFleetMaintenanceCostEur({
      kind: input.kind,
      costEur: input.costEur,
      partsCostEur: input.partsCostEur,
      laborCostEur: input.laborCostEur,
    }),
    parts_description: repair ? input.partsDescription?.trim() || null : null,
    parts_cost_eur: repair ? input.partsCostEur ?? null : null,
    labor_cost_eur: repair ? input.laborCostEur ?? null : null,
    vendor: input.vendor?.trim() || null,
    next_due_date: repair ? null : input.nextDueDate ?? null,
    next_due_km: repair ? null : input.nextDueKm ?? null,
    notes: input.notes?.trim() || null,
  };
}
