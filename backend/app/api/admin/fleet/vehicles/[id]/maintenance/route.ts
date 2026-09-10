import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { requireFleetAccess } from "@/lib/admin/fleetAuth";
import { logAdminActivity } from "@/lib/admin/audit";
import { fetchFleetMaintenanceHistory } from "@/lib/admin/fleetQueries";
import { buildFleetMaintenanceInsertPayload } from "@/lib/admin/fleetMaintenancePayload";
import { FleetRepairCreateSchema, FleetServiceCreateSchema } from "@/lib/admin/fleetMaintenanceSchemas";
import { fleetMaintenanceKindLabel } from "@/lib/admin/fleetTypes";

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
    if (msg === "FORBIDDEN") {
      return withCors(req, NextResponse.json({ error: "Нямате достъп до автопарка." }, { status: 403 }));
    }
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }

  try {
    const data = await fetchFleetMaintenanceHistory(session.db, id);
    return withCors(req, NextResponse.json({ data }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Грешка при зареждане";
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: vehicleId } = await params;
  const json = await req.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));
  }

  const isRepair = (json as { kind?: string }).kind === "repair";
  const repairParsed = isRepair ? FleetRepairCreateSchema.safeParse(json) : null;
  const serviceParsed = !isRepair ? FleetServiceCreateSchema.safeParse(json) : null;

  if (isRepair) {
    if (!repairParsed?.success) {
      const detail = repairParsed?.error.issues[0]?.message ?? "Невалидни данни";
      return withCors(req, NextResponse.json({ error: detail }, { status: 400 }));
    }
  } else if (!serviceParsed?.success) {
    const detail = serviceParsed?.error.issues[0]?.message ?? "Невалидни данни";
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
    return withCors(req, NextResponse.json({ error: "Нямате право да добавяте записи." }, { status: 403 }));
  }

  const { data: vehicle } = await session.db.from("fleet_vehicles").select("id, odometer_km").eq("id", vehicleId).maybeSingle();
  if (!vehicle) {
    return withCors(req, NextResponse.json({ error: "МПС не е намерено" }, { status: 404 }));
  }

  let payload;
  let updateVehicleOdometer = true;

  if (isRepair && repairParsed?.success) {
    const d = repairParsed.data;
    updateVehicleOdometer = d.updateVehicleOdometer ?? true;
    payload = buildFleetMaintenanceInsertPayload({
      vehicleId,
      kind: "repair",
      title: d.title,
      performedOn: d.performedOn,
      odometerKm: d.odometerKm,
      partsDescription: d.partsDescription,
      partsCostEur: d.partsCostEur,
      laborCostEur: d.laborCostEur,
      costEur: d.costEur,
      vendor: d.vendor,
      notes: d.notes,
    });
  } else if (serviceParsed?.success) {
    const d = serviceParsed.data;
    const kind = d.kind ?? "scheduled_service";
    updateVehicleOdometer = d.updateVehicleOdometer ?? true;
    payload = buildFleetMaintenanceInsertPayload({
      vehicleId,
      kind,
      title: d.title?.trim() || fleetMaintenanceKindLabel(kind),
      performedOn: d.performedOn,
      odometerKm: d.odometerKm,
      costEur: d.costEur,
      vendor: d.vendor,
      nextDueDate: d.nextDueDate,
      nextDueKm: d.nextDueKm,
      notes: d.notes,
    });
  } else {
    return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));
  }

  const { data, error } = await session.db.from("fleet_maintenance_events").insert(payload).select("id").single();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  if (updateVehicleOdometer && payload.odometer_km != null && payload.odometer_km > (vehicle.odometer_km ?? 0)) {
    await session.db.from("fleet_vehicles").update({ odometer_km: payload.odometer_km }).eq("id", vehicleId);
  }

  await logAdminActivity({
    action: isRepair ? "fleet_repair.create" : "fleet_maintenance.create",
    entityType: "fleet_maintenance",
    entityId: data.id,
    details: { vehicle_id: vehicleId, kind: payload.kind, title: payload.title },
  });

  return withCors(req, NextResponse.json({ data: { id: data.id } }, { status: 201 }));
}
