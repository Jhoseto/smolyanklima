import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

const QuerySchema = z.object({
  status: z.string().optional(), // new|in_progress|done|spam|...
  q: z.string().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const supabase = await adminDb();
  let query = supabase
    .from("inquiries")
    .select("id,source,customer_name,customer_phone,customer_email,message,service_type,status,priority,assigned_to,created_at,updated_at");

  if (parsed.data.status) query = query.eq("status", parsed.data.status);

  if (parsed.data.q) {
    // Best-effort search (works without extra indexes)
    const q = parsed.data.q.trim();
    if (q) {
      query = query.or(
        [
          `customer_name.ilike.%${q}%`,
          `customer_phone.ilike.%${q}%`,
          `customer_email.ilike.%${q}%`,
          `message.ilike.%${q}%`,
        ].join(","),
      );
    }
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [] }));
}

