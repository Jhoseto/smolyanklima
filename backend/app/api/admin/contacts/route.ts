import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

const QuerySchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(200).optional().default(30),
});

const BodySchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().min(3).max(80),
  email: z.string().email().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const { q, page, perPage } = parsed.data;
  const supabase = await adminDb();
  let query = supabase.from("contacts").select("id,full_name,phone,email,address,updated_at,created_at", { count: "exact" });
  if (q?.trim()) {
    query = query.or(
      `full_name.ilike.%${q.trim()}%,phone.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%,address.ilike.%${q.trim()}%`,
    );
  }
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query.order("updated_at", { ascending: false }).range(from, to);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [], meta: { page, perPage, total: count ?? 0 } }));
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const supabase = await adminDb();
  const payload = {
    full_name: parsed.data.fullName.trim(),
    phone: parsed.data.phone.trim(),
    email: parsed.data.email?.trim() || null,
    address: parsed.data.address?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
  };

  const { data, error } = await supabase.from("contacts").insert(payload).select("*").single();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  await logAdminActivity({
    action: "contact.create",
    entityType: "contact",
    entityId: data.id as string,
    details: { full_name: payload.full_name, phone: payload.phone },
  });

  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}
