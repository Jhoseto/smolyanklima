import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";

const QuerySchema = z.object({
  page:    z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
  status:  z.enum(["draft", "signed", "sent"]).optional(),
  q:       z.string().optional(),
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
  serial_number:    z.string().max(100).optional().nullable(),
  address:          z.string().max(500).optional().nullable(),
  paid_amount:      z.number().nonnegative().optional().nullable(),
  client_email:     z.string().max(200).optional().nullable().transform(v => v?.trim() || null),
  client_phone:     z.string().max(30).optional().nullable(),
  mount_types:      z.array(z.string()).optional().default([]),
  materials:        z.array(MaterialSchema).optional().default([]),
  cable_channels_m: z.number().nonnegative().optional().default(0),
  accessories:      z.record(z.string(), z.number().nonnegative()).optional().default({}),
  notes:            z.string().max(2000).optional().nullable(),
  signature_team:   z.string().optional().nullable(),
  signature_client: z.string().optional().nullable(),
  status:           z.enum(["draft", "signed", "sent"]).optional().default("draft"),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin", "service_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const { page, perPage, status, q } = parsed.data;
  const offset = (page - 1) * perPage;

  let query = session.db
    .from("service_protocols")
    .select("id,protocol_number,date,client_name,ac_model,address,status,created_at,created_by", { count: "exact" })
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  // service_staff вижда само своите
  if (session.role === "service_staff") {
    query = query.eq("created_by", session.userId);
  }
  if (status) query = query.eq("status", status);
  if (q?.trim()) {
    query = query.or(
      `client_name.ilike.%${q.trim()}%,protocol_number.ilike.%${q.trim()}%,ac_model.ilike.%${q.trim()}%`
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

  try { requireRole(session, "master_admin", "service_staff"); }
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
  const payload = {
    protocol_number:  protocolNumber,
    date:             d.date || new Date().toISOString().slice(0, 10),
    work_item_id:     d.work_item_id ?? null,
    client_name:      d.client_name ?? null,
    ac_model:         d.ac_model ?? null,
    serial_number:    d.serial_number ?? null,
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
    status:           d.status,
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
  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}
