import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import {
  combineUnitSerials,
  optionalProtocolEmail,
  optionalProtocolPhone,
  optionalUnitSerial,
} from "@/lib/protocol-contact-fields";

const MaterialSchema = z.object({
  id:   z.string(),
  name: z.string(),
  unit: z.string(),
  qty:  z.number().nonnegative(),
});

const UpdateSchema = z.object({
  date:             z.string().optional(),
  client_name:      z.string().max(200).optional().nullable(),
  ac_model:         z.string().max(200).optional().nullable(),
  serial_number:       z.string().max(100).optional().nullable(),
  indoor_unit_serial:  optionalUnitSerial,
  outdoor_unit_serial: optionalUnitSerial,
  address:          z.string().max(500).optional().nullable(),
  paid_amount:      z.number().nonnegative().optional().nullable(),
  client_email:     optionalProtocolEmail,
  client_phone:     optionalProtocolPhone,
  mount_types:      z.array(z.string()).optional(),
  materials:        z.array(MaterialSchema).optional(),
  cable_channels_m: z.number().nonnegative().optional(),
  accessories:      z.record(z.string(), z.number().nonnegative()).optional(),
  notes:            z.string().max(2000).optional().nullable(),
  signature_team:   z.string().optional().nullable(),
  signature_client: z.string().optional().nullable(),
  status:           z.enum(["prepared", "in_progress", "signed"]).optional(),
  photo_urls:       z.array(z.string().url()).max(5).optional(),
});

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
    .from("service_protocols")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data)  return withCors(req, NextResponse.json({ error: "Не е намерен" }, { status: 404 }));
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
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Невалидни данни" }, { status: 400 }));
  }

  const update: Record<string, unknown> = { ...parsed.data };

  // Единствен SELECT — взима всички полета нужни за валидация, serial и workflow.
  const { data: current } = await session.db
    .from("service_protocols")
    .select("status, indoor_unit_serial, outdoor_unit_serial, signature_team, signature_client, mount_types, materials, cable_channels_m, accessories")
    .eq("id", id)
    .maybeSingle();
  if (!current) {
    return withCors(req, NextResponse.json({ error: "Протоколът не е намерен" }, { status: 404 }));
  }

  // Забрана за връщане назад от "подписан" без master_admin
  if (
    parsed.data.status !== undefined &&
    current.status === "signed" &&
    parsed.data.status !== "signed" &&
    session.role !== "master_admin"
  ) {
    return withCors(req, NextResponse.json({ error: "Подписан протокол не може да се върне назад" }, { status: 400 }));
  }

  if (
    parsed.data.indoor_unit_serial !== undefined ||
    parsed.data.outdoor_unit_serial !== undefined
  ) {
    const indoor = parsed.data.indoor_unit_serial !== undefined
      ? parsed.data.indoor_unit_serial
      : (current.indoor_unit_serial as string | null);
    const outdoor = parsed.data.outdoor_unit_serial !== undefined
      ? parsed.data.outdoor_unit_serial
      : (current.outdoor_unit_serial as string | null);
    update.serial_number = combineUnitSerials(indoor, outdoor);
    if (parsed.data.indoor_unit_serial !== undefined) update.indoor_unit_serial = indoor;
    if (parsed.data.outdoor_unit_serial !== undefined) update.outdoor_unit_serial = outdoor;
  }

  // Автоматичен workflow на статуси (само ако клиентът не подава явно status):
  if (parsed.data.status === undefined) {
    if (current.status !== "signed") {
      const merged = {
        mount_types:      parsed.data.mount_types      ?? (current.mount_types as string[] | null),
        materials:        parsed.data.materials        ?? (current.materials as Array<{ qty?: number }> | null),
        cable_channels_m: parsed.data.cable_channels_m ?? (current.cable_channels_m as number | null),
        accessories:      parsed.data.accessories      ?? (current.accessories as Record<string, number> | null),
        signature_team:   parsed.data.signature_team   ?? (current.signature_team as string | null),
        signature_client: parsed.data.signature_client ?? (current.signature_client as string | null),
      };

      const hasTechnicalContent =
        (Array.isArray(merged.mount_types) && merged.mount_types.length > 0) ||
        (Array.isArray(merged.materials) && merged.materials.some((m) => Number(m?.qty ?? 0) > 0)) ||
        Number(merged.cable_channels_m ?? 0) > 0 ||
        (merged.accessories && typeof merged.accessories === "object" &&
          Object.values(merged.accessories).some((v) => Number(v ?? 0) > 0)) ||
        Boolean(merged.signature_team) ||
        Boolean(merged.signature_client);

      const bothSigned = Boolean(merged.signature_team) && Boolean(merged.signature_client);

      let newStatus: "prepared" | "in_progress" | "signed" = current.status;
      if (bothSigned) {
        newStatus = "signed";
      } else if (current.status === "prepared" && hasTechnicalContent) {
        newStatus = "in_progress";
      }

      if (newStatus !== current.status) {
        update.status = newStatus;
      }
    } else {
      // Статус е вече "подписан" — проверяваме, че двата подписа остават
      const mergedTeam = parsed.data.signature_team !== undefined
        ? parsed.data.signature_team
        : (current.signature_team as string | null);
      const mergedClient = parsed.data.signature_client !== undefined
        ? parsed.data.signature_client
        : (current.signature_client as string | null);
      const teamOk = Boolean(mergedTeam?.trim());
      const clientOk = Boolean(mergedClient?.trim());
      if (!teamOk || !clientOk) {
        return withCors(req, NextResponse.json(
          { error: "Подписан протокол не може да остане без двата подписа" },
          { status: 400 },
        ));
      }
    }
  } else if (parsed.data.status === "signed") {
    const team = parsed.data.signature_team ?? (current.signature_team as string | null);
    const client = parsed.data.signature_client ?? (current.signature_client as string | null);
    if (!team?.trim() || !client?.trim()) {
      return withCors(req, NextResponse.json(
        { error: "Статус подписан изисква и двата подписа" },
        { status: 400 },
      ));
    }
  }

  const { data, error } = await session.db
    .from("service_protocols")
    .update(update)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) {
    return withCors(req, NextResponse.json({ error: "Протоколът не е намерен" }, { status: 404 }));
  }

  await logAdminActivity({
    action: "service_protocol.update",
    entityType: "service_protocol",
    entityId: id,
    details: {
      changedFields: Object.keys(update),
      status: (data as { status?: string }).status ?? null,
      protocol_number: (data as { protocol_number?: string }).protocol_number ?? null,
    },
  });

  return withCors(req, NextResponse.json({ data }));
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
    .from("service_protocols")
    .select("protocol_number, client_name")
    .eq("id", id)
    .maybeSingle();

  const { error } = await session.db
    .from("service_protocols")
    .delete()
    .eq("id", id);

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  await logAdminActivity({
    action: "service_protocol.delete",
    entityType: "service_protocol",
    entityId: id,
    details: {
      protocol_number: (existing as { protocol_number?: string } | null)?.protocol_number ?? null,
      client_name: (existing as { client_name?: string } | null)?.client_name ?? null,
    },
  });

  return withCors(req, new NextResponse(null, { status: 204 }));
}
