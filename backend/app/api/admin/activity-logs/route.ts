import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

const QuerySchema = z.object({
  q: z.string().optional(),
  entityType: z.string().optional(),
  userId: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(30),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const { q, entityType, userId, from, to, page, perPage } = parsed.data;
  const supabase = await adminDb();
  let query = supabase
    .from("activity_logs")
    .select("id,user_id,action,entity_type,entity_id,details,created_at,admin_users:user_id(email,name)", { count: "exact" });
  if (q?.trim()) query = query.ilike("action", `%${q.trim()}%`);
  if (entityType?.trim()) query = query.eq("entity_type", entityType.trim());
  if (userId) query = query.eq("user_id", userId);
  if (from) query = query.gte("created_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lte("created_at", `${to}T23:59:59.999Z`);
  const offset = (page - 1) * perPage;
  const toRow = offset + perPage - 1;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(offset, toRow);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [], meta: { page, perPage, total: count ?? 0 } }));
}
