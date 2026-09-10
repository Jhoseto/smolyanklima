import { z } from "zod";
import { FLEET_MISC_EXPENSE_CATEGORIES } from "./fleetTypes";

const categoryValues = FLEET_MISC_EXPENSE_CATEGORIES as [
  (typeof FLEET_MISC_EXPENSE_CATEGORIES)[number],
  ...(typeof FLEET_MISC_EXPENSE_CATEGORIES)[number][],
];

export const FleetMiscExpenseCreateSchema = z.object({
  category: z.enum(categoryValues).optional().default("other"),
  title: z.string().min(1).max(255),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  costEur: z.coerce.number().min(0),
  notes: z.string().max(4000).optional().nullable(),
});

export const FleetMiscExpenseUpdateSchema = z.object({
  category: z.enum(categoryValues).optional(),
  title: z.string().min(1).max(255).optional(),
  expenseDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  costEur: z.coerce.number().min(0).optional(),
  notes: z.string().max(4000).optional().nullable(),
});
