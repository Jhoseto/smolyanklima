import { z } from "zod";
import { FLEET_SERVICE_KINDS } from "./fleetTypes";
import { resolveFleetMaintenanceCostEur } from "./fleetMaintenancePayload";

const serviceKindValues = FLEET_SERVICE_KINDS as [typeof FLEET_SERVICE_KINDS[number], ...typeof FLEET_SERVICE_KINDS[number][]];

const numericOptional = () =>
  z
    .union([z.coerce.number(), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v));

export const FleetServiceCreateSchema = z.object({
  kind: z.enum(serviceKindValues).optional().default("scheduled_service"),
  title: z.string().max(255).optional().nullable(),
  performedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  odometerKm: z.coerce.number().int().min(0).optional().nullable(),
  costEur: numericOptional(),
  vendor: z.string().max(255).optional().nullable(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  nextDueKm: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  updateVehicleOdometer: z.boolean().optional().default(true),
});

export const FleetRepairCreateSchema = z
  .object({
    title: z.string().min(3).max(255),
    performedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    odometerKm: z.coerce.number().int().min(0).optional().nullable(),
    partsDescription: z.string().min(3).max(4000),
    partsCostEur: numericOptional(),
    laborCostEur: numericOptional(),
    costEur: numericOptional(),
    vendor: z.string().max(255).optional().nullable(),
    notes: z.string().max(4000).optional().nullable(),
    updateVehicleOdometer: z.boolean().optional().default(true),
  })
  .superRefine((data, ctx) => {
    const total = resolveFleetMaintenanceCostEur({
      kind: "repair",
      costEur: data.costEur,
      partsCostEur: data.partsCostEur,
      laborCostEur: data.laborCostEur,
    });
    if (total == null || total <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Въведете обща сума или цена за части/труд.",
        path: ["costEur"],
      });
    }
  });

export const FleetMaintenanceCreateSchema = z.union([FleetServiceCreateSchema, FleetRepairCreateSchema]);
