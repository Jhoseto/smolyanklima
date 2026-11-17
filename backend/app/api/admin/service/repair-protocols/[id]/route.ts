/**
 * /api/admin/service/repair-protocols/[id]
 *
 * GET    → пълни данни на един сервизен протокол.
 * PUT    → обновяване (със auto-progress на статуса).
 * DELETE → изтриване (само master_admin).
 */

import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { assertRepairProtocolVisible } from "@/lib/admin/repairProtocolAccess";
import { applyRecycleSerialsToProduct } from "@/lib/admin/recycleProtocolProductLink";
import { RepairWriteSchema, repairProtocolWrite, type StoredRepair } from "@/lib/admin/repairProtocolWorkflow";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin", "office_staff", "service_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const { id } = await params;
  const { data, error } = await session.db
    .from("service_repair_protocols")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  const access = assertRepairProtocolVisible(session, data);
  if (!access.ok) {
    return withCors(req, NextResponse.json({ error: access.error }, { status: access.status }));
  }

  return withCors(req, NextResponse.json({ data }));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin", "office_staff", "service_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = RepairWriteSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Невалидни данни" }, { status: 400 }));

  const { data: current, error: readError } = await session.db.from("service_repair_protocols")
    .select("*").eq("id", id).maybeSingle<StoredRepair>();
  if (readError) return withCors(req, NextResponse.json({ error: readError.message }, { status: 500 }));
  if (!current) return withCors(req, NextResponse.json({ error: "Не е намерен" }, { status: 404 }));
  const access = assertRepairProtocolVisible(session, current);
  if (!access.ok) return withCors(req, NextResponse.json({ error: access.error }, { status: access.status }));

  const write = repairProtocolWrite(current, parsed.data, session.role);
  if (!write.ok) return withCors(req, NextResponse.json({ error: write.error }, { status: write.status }));

  // The revision guards the entire phase transition, including its signature and snapshot.
  const { data, error } = await session.db.from("service_repair_protocols")
    .update(write.patch).eq("id", id).eq("updated_at", current.updated_at).select("*").maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({
    error: "Протоколът е променен междувременно. Отворете го отново, за да видите последния запис.",
  }, { status: 409 }));

  await logAdminActivity({
    action: "service_repair_protocol.update", entityType: "service_repair_protocol", entityId: id,
    details: { changedFields: Object.keys(write.patch), phase: parsed.data.phase, workflow_stage: data.workflow_stage, protocol_number: data.protocol_number },
  });
  let productLinkWarning: string | undefined;
  if (write.syncProduct && data.product_id) {
    const result = await applyRecycleSerialsToProduct(session.db, data.product_id, data.indoor_unit_serial, data.outdoor_unit_serial);
    if (!result.ok) productLinkWarning = result.error;
  }
  return withCors(req, NextResponse.json({ data, productLinkWarning }));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const { id } = await params;
  const { data: existing } = await session.db
    .from("service_repair_protocols")
    .select("protocol_number, client_name")
    .eq("id", id)
    .maybeSingle();

  const { error } = await session.db
    .from("service_repair_protocols")
    .delete()
    .eq("id", id);

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  await logAdminActivity({
    action: "service_repair_protocol.delete",
    entityType: "service_repair_protocol",
    entityId: id,
    details: {
      protocol_number: (existing as { protocol_number?: string } | null)?.protocol_number ?? null,
      client_name: (existing as { client_name?: string } | null)?.client_name ?? null,
    },
  });

  return withCors(req, new NextResponse(null, { status: 204 }));
}
