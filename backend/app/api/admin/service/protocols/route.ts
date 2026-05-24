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

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(["prepared", "in_progress", "signed"]).optional(),
  q: z.string().optional(),
  sort: z
    .enum(["created-desc", "created-asc", "date-desc", "date-asc", "client-asc", "client-desc"])
    .optional()
    .default("created-desc"),
});

const MaterialSchema = z.object({
  id:   z.string(),
  name: z.string(),
  unit: z.string(),
  qty:  z.number().nonnegative(),
});

const CreateSchema = z.object({
  work_item_id:     z.string().uuid().optional().nullable(),
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
  mount_types:      z.array(z.string()).optional().default([]),
  materials:        z.array(MaterialSchema).optional().default([]),
  cable_channels_m: z.number().nonnegative().optional().default(0),
  accessories:      z.record(z.string(), z.number().nonnegative()).optional().default({}),
  notes:            z.string().max(2000).optional().nullable(),
  signature_team:   z.string().optional().nullable(),
  signature_client: z.string().optional().nullable(),
  status:           z.enum(["prepared", "in_progress", "signed"]).optional().default("prepared"),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin", "office_staff", "service_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const { page, perPage, status, q, sort } = parsed.data;
  const offset = (page - 1) * perPage;

  let query = session.db
    .from("service_protocols")
    .select(
      "id,protocol_number,date,client_name,client_phone,ac_model,address,paid_amount,status,created_at,created_by",
      { count: "exact" },
    );

  switch (sort) {
    case "created-asc":
      query = query.order("created_at", { ascending: true }).order("date", { ascending: true });
      break;
    case "date-desc":
      query = query.order("date", { ascending: false }).order("created_at", { ascending: false });
      break;
    case "date-asc":
      query = query.order("date", { ascending: true }).order("created_at", { ascending: true });
      break;
    case "client-asc":
      query = query.order("client_name", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false });
      break;
    case "client-desc":
      query = query.order("client_name", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });
      break;
    case "created-desc":
    default:
      query = query.order("created_at", { ascending: false }).order("date", { ascending: false });
      break;
  }

  query = query.range(offset, offset + perPage - 1);

  // service_staff вижда своите + автоматично създадени от продажби (с work_item_id)
  if (session.role === "service_staff") {
    query = query.or(`created_by.eq.${session.userId},work_item_id.not.is.null`);
  }
  if (status) query = query.eq("status", status);
  if (q?.trim()) {
    const term = q.trim();
    query = query.or(
      `client_name.ilike.%${term}%,protocol_number.ilike.%${term}%,ac_model.ilike.%${term}%,address.ilike.%${term}%,client_phone.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await query;
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [], meta: { page, perPage, total: count ?? 0 } }));
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin", "office_staff", "service_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const json = await req.json().catch(() => null);
  if (!json) return withCors(req, NextResponse.json({ error: "Невалидно тяло" }, { status: 400 }));

  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[POST /api/admin/service/protocols] validation error:", JSON.stringify(parsed.error.issues));
    return withCors(req, NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Невалидни данни", details: parsed.error.issues }, { status: 400 }));
  }

  // Генериране на номер на протокол (SK-YYYYNNN)
  const year = new Date().getFullYear();
  const { count, error: cntErr } = await session.db
    .from("service_protocols")
    .select("*", { count: "exact", head: true });
  if (cntErr) return withCors(req, NextResponse.json({ error: cntErr.message }, { status: 500 }));

  const seq = (count ?? 0) + 1;
  const protocolNumber = `SK-${year}${String(seq).padStart(3, "0")}`;

  const d = parsed.data;

  // Автоматичен начален статус (ако клиентът не подава явно):
  //   - prepared    : по подразбиране (офисът подготвя клиентски данни)
  //   - in_progress : ако още при създаване има техническо съдържание (екип попълва на терен)
  //   - signed      : ако още при създаване има и двата подписа
  const inputHadStatus = Object.prototype.hasOwnProperty.call(json ?? {}, "status");
  let computedStatus: "prepared" | "in_progress" | "signed" = d.status;
  if (!inputHadStatus) {
    const hasTechnicalContent =
      (d.mount_types?.length ?? 0) > 0 ||
      (d.materials?.some((m) => Number(m?.qty ?? 0) > 0) ?? false) ||
      Number(d.cable_channels_m ?? 0) > 0 ||
      Object.values(d.accessories ?? {}).some((v) => Number(v ?? 0) > 0) ||
      Boolean(d.signature_team) ||
      Boolean(d.signature_client);
    const bothSigned = Boolean(d.signature_team) && Boolean(d.signature_client);
    if (bothSigned) computedStatus = "signed";
    else if (hasTechnicalContent) computedStatus = "in_progress";
    else computedStatus = "prepared";
  }

  const payload = {
    protocol_number:  protocolNumber,
    date:             d.date || new Date().toISOString().slice(0, 10),
    work_item_id:     d.work_item_id ?? null,
    client_name:      d.client_name ?? null,
    ac_model:         d.ac_model ?? null,
    serial_number:       d.serial_number ?? combineUnitSerials(d.indoor_unit_serial, d.outdoor_unit_serial),
    indoor_unit_serial:  d.indoor_unit_serial ?? null,
    outdoor_unit_serial: d.outdoor_unit_serial ?? null,
    address:          d.address ?? null,
    paid_amount:      d.paid_amount ?? null,
    client_email:     d.client_email || null,
    client_phone:     d.client_phone ?? null,
    mount_types:      d.mount_types,
    materials:        d.materials,
    cable_channels_m: d.cable_channels_m,
    accessories:      d.accessories,
    notes:            d.notes ?? null,
    signature_team:   d.signature_team ?? null,
    signature_client: d.signature_client ?? null,
    status:           computedStatus,
    created_by:       session.userId,
  };

  const { data, error } = await session.db
    .from("service_protocols")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("[POST /api/admin/service/protocols] insert error:", error);
    return withCors(req, NextResponse.json({ error: error.message, code: error.code }, { status: 500 }));
  }

  await logAdminActivity({
    action: "service_protocol.create",
    entityType: "service_protocol",
    entityId: (data as { id: string }).id,
    details: {
      protocol_number: protocolNumber,
      client_name: d.client_name ?? null,
      status: computedStatus,
    },
  });

  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}
