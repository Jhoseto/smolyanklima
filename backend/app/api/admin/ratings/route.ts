import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

const QuerySchema = z.object({
  q: z.string().optional(),
  stars: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(25),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const { q, stars, page, perPage } = parsed.data;
  const supabase = await adminDb();
  let productIds: string[] | null = null;
  if (q?.trim()) {
    const { data: pRows, error: pErr } = await supabase
      .from("products")
      .select("id")
      .ilike("name", `%${q.trim()}%`)
      .limit(500);
    if (pErr) return withCors(req, NextResponse.json({ error: pErr.message }, { status: 500 }));
    productIds = (pRows ?? []).map((p: { id: string }) => p.id);
    if (productIds.length === 0) {
      return withCors(req, NextResponse.json({ data: [], meta: { page, perPage, total: 0 } }));
    }
  }
  let query = supabase
    .from("product_ratings")
    .select("id,product_id,stars,rater_key,ip_hash,user_agent,created_at,products:product_id(id,slug,name)", { count: "exact" });
  if (stars) query = query.eq("stars", stars);
  if (productIds) query = query.in("product_id", productIds);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [], meta: { page, perPage, total: count ?? 0 } }));
}
