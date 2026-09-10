import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

const UpdateSchema = z.object({
  validFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  provider: z.string().max(255).optional().nullable(),
  referenceNumber: z.string().max(128).optional().nullable(),
  costEur: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
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
    return withCors(req, NextResponse.json({ error: "Нямате право да редактирате записи." }, { status: 403 }));
  }

  const payload: Record<string, unknown> = {};
  const d = parsed.data;
  if (d.validFrom !== undefined) payload.valid_from = d.validFrom;
  if (d.expiresOn !== undefined) payload.expires_on = d.expiresOn;
  if (d.provider !== undefined) payload.provider = d.provider?.trim() || null;
  if (d.referenceNumber !== undefined) payload.reference_number = d.referenceNumber?.trim() || null;
  if (d.costEur !== undefined) payload.cost_eur = d.costEur;
  if (d.notes !== undefined) payload.notes = d.notes?.trim() || null;

  if (!Object.keys(payload).length) {
    return withCors(req, NextResponse.json({ error: "Няма промени" }, { status: 400 }));
  }

  const { data, error } = await session.db
    .from("fleet_compliance_records")
    .update(payload)
    .eq("id", recordId)
    .select("id, vehicle_id")
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Записът не е намерен" }, { status: 404 }));

  await logAdminActivity({
    action: "fleet_compliance.update",
    entityType: "fleet_compliance",
    entityId: recordId,
    details: payload,
  });

  return withCors(req, NextResponse.json({ data: { id: recordId } }));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  const { recordId } = await params;
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право да изтривате записи." }, { status: 403 }));
  }

  const { data, error } = await session.db
    .from("fleet_compliance_records")
    .delete()
    .eq("id", recordId)
    .select("id")
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Записът не е намерен" }, { status: 404 }));

  await logAdminActivity({
    action: "fleet_compliance.delete",
    entityType: "fleet_compliance",
    entityId: recordId,
    details: {},
  });

  return withCors(req, NextResponse.json({ data: { id: recordId } }));
}
