import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { requireFleetAccess } from "@/lib/admin/fleetAuth";
import { logAdminActivity } from "@/lib/admin/audit";
import {
  computeFleetYearCosts,
  fetchFleetComplianceHistory,
  fetchFleetMaintenanceHistory,
  fetchFleetMiscExpenses,
  getFleetVehicleById,
} from "@/lib/admin/fleetQueries";
import { normalizeFleetRegistration } from "@/lib/admin/fleetTypes";

const UpdateSchema = z.object({
  registrationNumber: z.string().min(2).max(32).optional(),
  make: z.string().min(1).max(128).optional(),
  model: z.string().min(1).max(128).optional(),
  year: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  vin: z.string().max(32).optional().nullable(),
  fuelType: z.enum(["petrol", "diesel", "lpg", "electric", "hybrid"]).optional(),
  odometerKm: z.coerce.number().int().min(0).optional(),
  status: z.enum(["active", "inactive", "sold"]).optional(),
  assignedAdminUserId: z.string().uuid().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let session;
  try {
    session = await adminSession();
    requireFleetAccess(session);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "FORBIDDEN" || msg === "NOT_ADMIN") {
      return withCors(req, NextResponse.json({ error: "Нямате достъп до автопарка." }, { status: 403 }));
    }
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }

  try {
    const vehicle = await getFleetVehicleById(session.db, id);
    if (!vehicle) {
      return withCors(req, NextResponse.json({ error: "МПС не е намерено" }, { status: 404 }));
    }

    const year = new Date().getFullYear();
    const [compliance, maintenance, miscExpenses, yearCosts] = await Promise.all([
      fetchFleetComplianceHistory(session.db, id),
      fetchFleetMaintenanceHistory(session.db, id),
      fetchFleetMiscExpenses(session.db, id, year),
      computeFleetYearCosts(session.db, id, year),
    ]);

    return withCors(
      req,
      NextResponse.json({
        data: { vehicle, compliance, maintenance, misc_expenses: miscExpenses, year_costs: yearCosts },
      }),
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Грешка при зареждане";
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
    return withCors(req, NextResponse.json({ error: "Нямате право да редактирате МПС." }, { status: 403 }));
  }

  const payload: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.registrationNumber !== undefined) payload.registration_number = normalizeFleetRegistration(d.registrationNumber);
  if (d.make !== undefined) payload.make = d.make.trim();
  if (d.model !== undefined) payload.model = d.model.trim();
  if (d.year !== undefined) payload.year = d.year;
  if (d.vin !== undefined) payload.vin = d.vin?.trim() || null;
  if (d.fuelType !== undefined) payload.fuel_type = d.fuelType;
  if (d.odometerKm !== undefined) payload.odometer_km = d.odometerKm;
  if (d.status !== undefined) payload.status = d.status;
  if (d.assignedAdminUserId !== undefined) payload.assigned_admin_user_id = d.assignedAdminUserId;
  if (d.notes !== undefined) payload.notes = d.notes?.trim() || null;

  if (!Object.keys(payload).length) {
    return withCors(req, NextResponse.json({ error: "Няма промени" }, { status: 400 }));
  }

  const { data, error } = await session.db.from("fleet_vehicles").update(payload).eq("id", id).select("id").maybeSingle();
  if (error) {
    if (error.code === "23505") {
      return withCors(req, NextResponse.json({ error: "Вече съществува МПС с този рег. номер." }, { status: 409 }));
    }
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }
  if (!data) {
    return withCors(req, NextResponse.json({ error: "МПС не е намерено" }, { status: 404 }));
  }

  await logAdminActivity({
    action: "fleet_vehicle.update",
    entityType: "fleet_vehicle",
    entityId: id,
    details: payload,
  });

  return withCors(req, NextResponse.json({ data: { id } }));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin");
  } catch {
    return withCors(req, NextResponse.json({ error: "Само master admin може да изтрива МПС." }, { status: 403 }));
  }

  const { data: existing } = await session.db
    .from("fleet_vehicles")
    .select("id, registration_number")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return withCors(req, NextResponse.json({ error: "МПС не е намерено" }, { status: 404 }));
  }

  const { data, error } = await session.db.from("fleet_vehicles").delete().eq("id", id).select("id").maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "МПС не е намерено" }, { status: 404 }));

  await logAdminActivity({
    action: "fleet_vehicle.delete",
    entityType: "fleet_vehicle",
    entityId: id,
    details: { registration_number: existing.registration_number },
  });

  return withCors(req, NextResponse.json({ data: { id } }));
}
