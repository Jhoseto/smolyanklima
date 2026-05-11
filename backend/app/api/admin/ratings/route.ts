import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

const QuerySchema = z.object({
  q: z.string().optional(),
  // view=summary → grouped per product (default)
  // view=detail  → individual rows for one product
  view: z.enum(["summary", "detail"]).optional().default("summary"),
  product_id: z.string().uuid().optional(),
  stars: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(200).optional().default(50),
});

const PatchSchema = z.object({
  // Adjust star counts by delta (positive = add, negative = remove)
  adjustments: z.record(z.enum(["1", "2", "3", "4", "5"]), z.number().int()).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате достъп." }, { status: 403 }));
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const { q, view, product_id, stars, page, perPage } = parsed.data;
  const supabase = session.db;

  // ── DETAIL: individual rows for one product ─────────────────────────────
  if (view === "detail" && product_id) {
    let query = supabase
      .from("product_ratings")
      .select("id,stars,rater_key,created_at", { count: "exact" })
      .eq("product_id", product_id);
    if (stars) query = query.eq("stars", stars);
    const from = (page - 1) * perPage;
    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(from, from + perPage - 1);
    if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
    return withCors(req, NextResponse.json({ data: data ?? [], meta: { page, perPage, total: count ?? 0 } }));
  }

  // ── SUMMARY: one row per product with distribution ─────────────────────
  // First resolve product IDs if search query given
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

  // Get products that have at least one rating
  let prodQuery = supabase
    .from("products")
    .select("id,slug,name,rating,reviews_count", { count: "exact" })
    .gt("reviews_count", 0);
  if (productIds) prodQuery = prodQuery.in("id", productIds);
  const from = (page - 1) * perPage;
  const { data: products, error: prodErr, count: prodCount } = await prodQuery
    .order("reviews_count", { ascending: false })
    .range(from, from + perPage - 1);

  if (prodErr) return withCors(req, NextResponse.json({ error: prodErr.message }, { status: 500 }));
  if (!products?.length) {
    return withCors(req, NextResponse.json({ data: [], meta: { page, perPage, total: 0 } }));
  }

  const ids = products.map((p: { id: string }) => p.id);

  // Fetch star distribution for all these products in one query
  const { data: ratingRows, error: rErr } = await supabase
    .from("product_ratings")
    .select("product_id,stars")
    .in("product_id", ids);
  if (rErr) return withCors(req, NextResponse.json({ error: rErr.message }, { status: 500 }));

  // Build distribution map  { product_id: { 1: n, 2: n, ... } }
  const distMap = new Map<string, Record<number, number>>();
  for (const row of ratingRows ?? []) {
    const pid = row.product_id as string;
    if (!distMap.has(pid)) distMap.set(pid, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    distMap.get(pid)![row.stars as number] = (distMap.get(pid)![row.stars as number] || 0) + 1;
  }

  const data = products.map((p: any) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    rating: p.rating,
    reviews_count: p.reviews_count,
    distribution: distMap.get(p.id) ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  }));

  return withCors(req, NextResponse.json({
    data,
    meta: { page, perPage, total: prodCount ?? products.length },
  }));
}

// PATCH /api/admin/ratings?product_id=xxx  — manual adjustments
export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате достъп." }, { status: 403 }));
  }

  const product_id = req.nextUrl.searchParams.get("product_id");
  if (!product_id) return withCors(req, NextResponse.json({ error: "product_id required" }, { status: 400 }));

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const { adjustments } = parsed.data;
  const supabase = session.db;

  if (adjustments) {
    for (const [starStr, delta] of Object.entries(adjustments)) {
      const star = Number(starStr) as 1 | 2 | 3 | 4 | 5;
      if (delta === 0) continue;

      if (delta > 0) {
        // Add rows
        const rows = Array.from({ length: delta }, (_, i) => ({
          product_id,
          stars: star,
          rater_key: `manual-${Date.now()}-${i}`,
          ip_hash: null,
          user_agent: "manual-admin",
        }));
        const { error } = await supabase.from("product_ratings").insert(rows);
        if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
      } else {
        // Remove |delta| rows with this star value
        const { data: toDelete, error: selErr } = await supabase
          .from("product_ratings")
          .select("id")
          .eq("product_id", product_id)
          .eq("stars", star)
          .limit(Math.abs(delta));
        if (selErr) return withCors(req, NextResponse.json({ error: selErr.message }, { status: 500 }));
        const ids = (toDelete ?? []).map((r: { id: string }) => r.id);
        if (ids.length > 0) {
          const { error: delErr } = await supabase.from("product_ratings").delete().in("id", ids);
          if (delErr) return withCors(req, NextResponse.json({ error: delErr.message }, { status: 500 }));
        }
      }
    }
  }

  // Recalculate product rating
  await supabase.rpc("refresh_product_rating", { p_product_id: product_id });

  await logAdminActivity({
    action: "rating.adjust",
    entityType: "product",
    entityId: product_id,
    details: { adjustments },
  });

  return withCors(req, NextResponse.json({ ok: true }));
}
