import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { requireFleetAccess } from "@/lib/admin/fleetAuth";
import { logAdminActivity } from "@/lib/admin/audit";
import { listFleetVehicles } from "@/lib/admin/fleetQueries";
import { normalizeFleetRegistration } from "@/lib/admin/fleetTypes";

const QuerySchema = z.object({
  status: z.enum(["active", "inactive", "sold", "all"]).optional().default("all"),
  alertLevel: z.enum(["all", "alert", "critical"]).optional().default("all"),
  q: z.string().optional(),
  assignedAdminUserId: z.string().uuid().optional(),
  sortBy: z.enum(["registration", "alert", "odometer"]).optional().default("registration"),
  sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
});

const CreateSchema = z.object({
  registrationNumber: z.string().min(2).max(32),
  make: z.string().min(1).max(128),
  model: z.string().min(1).max(128),
  year: z.coerce.number().int().min(1950).max(2100).optional().nullable(),
  vin: z.string().max(32).optional().nullable(),
  fuelType: z.enum(["petrol", "diesel", "lpg", "electric", "hybrid"]).optional().default("diesel"),
  odometerKm: z.coerce.number().int().min(0).optional().default(0),
  status: z.enum(["active", "inactive", "sold"]).optional().default("active"),
  assignedAdminUserId: z.string().uuid().optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));
  }

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
    const data = await listFleetVehicles(session.db, parsed.data);
    return withCors(req, NextResponse.json({ data }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Грешка при зареждане";
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const detail = first ? `${first.path.join(".") || "body"}: ${first.message}` : "Невалидни данни";
    return withCors(req, NextResponse.json({ error: detail }, { status: 400 }));
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
    return withCors(req, NextResponse.json({ error: "Нямате право да добавяте МПС." }, { status: 403 }));
  }

  const {
    registrationNumber,
    make,
    model,
    year,
    vin,
    fuelType,
    odometerKm,
    status,
    assignedAdminUserId,
    notes,
  } = parsed.data;

  const registration_number = normalizeFleetRegistration(registrationNumber);
  const payload = {
    registration_number,
    make: make.trim(),
    model: model.trim(),
    year: year ?? null,
    vin: vin?.trim() || null,
    fuel_type: fuelType,
    odometer_km: odometerKm,
    status,
    assigned_admin_user_id: assignedAdminUserId ?? null,
    notes: notes?.trim() || null,
  };

  const { data, error } = await session.db.from("fleet_vehicles").insert(payload).select("id").single();
  if (error) {
    if (error.code === "23505") {
      return withCors(req, NextResponse.json({ error: "Вече съществува МПС с този рег. номер." }, { status: 409 }));
    }
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  await logAdminActivity({
    action: "fleet_vehicle.create",
    entityType: "fleet_vehicle",
    entityId: data.id,
    details: { registration_number },
  });

  return withCors(req, NextResponse.json({ data: { id: data.id } }, { status: 201 }));
}
