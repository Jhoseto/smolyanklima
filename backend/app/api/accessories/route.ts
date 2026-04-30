import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const QuerySchema = z.object({
  q: z.string().optional(),
  b: z.string().optional(), // comma-separated brand names
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

function splitCsv(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Invalid query" }, { status: 400 }));

  const { q, b, page = 1, perPage = 24 } = parsed.data;
  const brands = splitCsv(b);

  // Use service role for public reads (server-side only).
  const supabase = createSupabaseServiceRoleClient();
  let query = supabase
    .from("accessories")
    .select("id,slug,name,description,price,old_price,kind,brands:brand_id(id,slug,name),accessory_images(url,sort_order,is_main)", { count: "exact" })
    .eq("is_active", true);

  if (brands.length > 0) query = query.in("brands.name", brands);
  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
  }

  query = query.order("created_at", { ascending: false });
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  return withCors(req, NextResponse.json({ data: data ?? [], meta: { page, perPage, total: count ?? 0 } }));
}

