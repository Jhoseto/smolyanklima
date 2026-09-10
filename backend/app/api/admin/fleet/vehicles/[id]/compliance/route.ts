import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { requireFleetAccess } from "@/lib/admin/fleetAuth";
import { logAdminActivity } from "@/lib/admin/audit";
import { fetchFleetComplianceHistory } from "@/lib/admin/fleetQueries";

const CreateSchema = z.object({
  kind: z.enum(["vignette", "civil_liability", "technical_inspection", "kasko"]),
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  provider: z.string().max(255).optional().nullable(),
  referenceNumber: z.string().max(128).optional().nullable(),
  costEur: z.coerce.number().min(0).optional().nullable(),
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
    if (msg === "FORBIDDEN") {
      return withCors(req, NextResponse.json({ error: "Нямате достъп до автопарка." }, { status: 403 }));
    }
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }

  try {
    const data = await fetchFleetComplianceHistory(session.db, id);
    return withCors(req, NextResponse.json({ data }));
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Грешка при зареждане";
    return withCors(req, NextResponse.json({ error: msg }, { status: 500 }));
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: vehicleId } = await params;
  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
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
    return withCors(req, NextResponse.json({ error: "Нямате право да добавяте записи." }, { status: 403 }));
  }

  const { kind, validFrom, expiresOn, provider, referenceNumber, costEur, notes } = parsed.data;

  const { data: vehicle } = await session.db.from("fleet_vehicles").select("id").eq("id", vehicleId).maybeSingle();
  if (!vehicle) {
    return withCors(req, NextResponse.json({ error: "МПС не е намерено" }, { status: 404 }));
  }

  const payload = {
    vehicle_id: vehicleId,
    kind,
    valid_from: validFrom ?? null,
    expires_on: expiresOn,
    provider: provider?.trim() || null,
    reference_number: referenceNumber?.trim() || null,
    cost_eur: costEur ?? null,
    notes: notes?.trim() || null,
  };

  const { data, error } = await session.db.from("fleet_compliance_records").insert(payload).select("id").single();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  await logAdminActivity({
    action: "fleet_compliance.create",
    entityType: "fleet_compliance",
    entityId: data.id,
    details: { vehicle_id: vehicleId, kind, expires_on: expiresOn },
  });

  return withCors(req, NextResponse.json({ data: { id: data.id } }, { status: 201 }));
}
