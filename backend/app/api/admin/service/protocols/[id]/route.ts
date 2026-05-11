import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";

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
  serial_number:    z.string().max(100).optional().nullable(),
  address:          z.string().max(500).optional().nullable(),
  paid_amount:      z.number().nonnegative().optional().nullable(),
  client_email:     z.string().max(200).optional().nullable().transform(v => v?.trim() || null),
  client_phone:     z.string().max(30).optional().nullable(),
  mount_types:      z.array(z.string()).optional(),
  materials:        z.array(MaterialSchema).optional(),
  cable_channels_m: z.number().nonnegative().optional(),
  accessories:      z.record(z.string(), z.number().nonnegative()).optional(),
  notes:            z.string().max(2000).optional().nullable(),
  signature_team:   z.string().optional().nullable(),
  signature_client: z.string().optional().nullable(),
  status:           z.enum(["draft", "signed", "sent"]).optional(),
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
  let query = session.db
    .from("service_protocols")
    .select("*")
    .eq("id", id);

  if (session.role === "service_staff") {
    query = query.eq("created_by", session.userId);
  }

  const { data, error } = await query.maybeSingle();
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

  // Сервизни служители записват само протоколи, създадени от тях (магьосникът ползва PUT при автозапазване).
  // Редакция „от списъка“ за чужди протоколи им е недостъпна от UI (няма бутон „Редактирай“ в прегледа).
  if (session.role === "service_staff") {
    const { data: existing } = await session.db
      .from("service_protocols")
      .select("created_by")
      .eq("id", id)
      .maybeSingle();
    if (!existing || existing.created_by !== session.userId) {
      return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 }));
    }
  }

  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Невалидни данни" }, { status: 400 }));
  }

  const { data, error } = await session.db
    .from("service_protocols")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
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
  const { error } = await session.db
    .from("service_protocols")
    .delete()
    .eq("id", id);

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, new NextResponse(null, { status: 204 }));
}
