import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

const UpdateSchema = z.object({
  kind: z.enum(["scheduled_service", "oil", "filters", "tires_change", "tires_purchase", "consumables", "repair"]).optional(),
  title: z.string().min(1).max(255).optional(),
  performedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  odometerKm: z.coerce.number().int().min(0).optional().nullable(),
  costEur: z.coerce.number().min(0).optional().nullable(),
  partsDescription: z.string().max(4000).optional().nullable(),
  partsCostEur: z.coerce.number().min(0).optional().nullable(),
  laborCostEur: z.coerce.number().min(0).optional().nullable(),
  vendor: z.string().max(255).optional().nullable(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  nextDueKm: z.coerce.number().int().min(0).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));
  }

  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право да редактирате поддръжки." }, { status: 403 }));
  }

  const payload: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.kind !== undefined) payload.kind = d.kind;
  if (d.title !== undefined) payload.title = d.title.trim();
  if (d.performedOn !== undefined) payload.performed_on = d.performedOn;
  if (d.odometerKm !== undefined) payload.odometer_km = d.odometerKm;
  if (d.costEur !== undefined) payload.cost_eur = d.costEur;
  if (d.partsDescription !== undefined) payload.parts_description = d.partsDescription?.trim() || null;
  if (d.partsCostEur !== undefined) payload.parts_cost_eur = d.partsCostEur;
  if (d.laborCostEur !== undefined) payload.labor_cost_eur = d.laborCostEur;
  if (d.vendor !== undefined) payload.vendor = d.vendor?.trim() || null;
  if (d.nextDueDate !== undefined) payload.next_due_date = d.nextDueDate;
  if (d.nextDueKm !== undefined) payload.next_due_km = d.nextDueKm;
  if (d.notes !== undefined) payload.notes = d.notes?.trim() || null;

  if (!Object.keys(payload).length) {
    return withCors(req, NextResponse.json({ error: "Няма промени" }, { status: 400 }));
  }

  const { data, error } = await session.db
    .from("fleet_maintenance_events")
    .update(payload)
    .eq("id", eventId)
    .select("id")
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Записът не е намерен" }, { status: 404 }));

  await logAdminActivity({
    action: "fleet_maintenance.update",
    entityType: "fleet_maintenance",
    entityId: eventId,
    details: payload,
  });

  return withCors(req, NextResponse.json({ data: { id: eventId } }));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право да изтривате поддръжки." }, { status: 403 }));
  }

  const { data, error } = await session.db
    .from("fleet_maintenance_events")
    .delete()
    .eq("id", eventId)
    .select("id")
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Записът не е намерен" }, { status: 404 }));

  await logAdminActivity({
    action: "fleet_maintenance.delete",
    entityType: "fleet_maintenance",
    entityId: eventId,
    details: {},
  });

  return withCors(req, NextResponse.json({ data: { id: eventId } }));
}
