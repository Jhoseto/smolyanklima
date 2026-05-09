import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

const QuerySchema = z.object({
  status: z.string().optional(),
  source: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(200).default(50),
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
    .select(
      "id,source,customer_name,customer_phone,customer_email,message,product_id,service_type,status,priority,assigned_to,admin_notes,created_at,updated_at",
      { count: "exact" },
    );

  if (parsed.data.status) query = query.eq("status", parsed.data.status);
  if (parsed.data.source) query = query.eq("source", parsed.data.source);

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

  const { page, perPage } = parsed.data;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<typeof data>();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(
    req,
    NextResponse.json({
      data: data ?? [],
      meta: { page, perPage, total: count ?? 0 },
    }),
  );
}

