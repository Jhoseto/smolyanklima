import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { applyPublicCatalogFilter } from "@/lib/catalog/publicProductVisibility";

const QuerySchema = z.object({
  q: z.string().optional(),
  view: z.enum(["summary", "detail"]).optional().default("summary"),
  product_id: z.string().uuid().optional(),
  stars: z.coerce.number().int().min(1).max(5).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(200).optional().default(50),
  sort: z
    .enum([
      "reviews-desc",
      "reviews-asc",
      "rating-desc",
      "rating-asc",
      "name-asc",
      "name-desc",
      "slug-asc",
      "slug-desc",
    ])
    .optional()
    .default("reviews-desc"),
  reviews: z.enum(["all", "with", "without"]).optional().default("all"),
  minRating: z.coerce.number().min(0).max(5).optional(),
  maxRating: z.coerce.number().min(0).max(5).optional(),
  minReviews: z.coerce.number().int().min(0).optional(),
  maxReviews: z.coerce.number().int().min(0).optional(),
  brandId: z.string().uuid().optional(),
  condition: z.enum(["all", "new", "used"]).optional().default("all"),
  featured: z.enum(["all", "yes", "no"]).optional().default("all"),
  stockStatus: z.enum(["all", "in_stock", "on_order"]).optional().default("all"),
  hasStar: z.coerce.number().int().min(1).max(5).optional(),
});

const PatchSchema = z.object({
  adjustments: z.record(z.enum(["1", "2", "3", "4", "5"]), z.number().int()).optional(),
});

function intersectIds(current: string[] | null, next: string[]): string[] | null {
  if (next.length === 0) return [];
  if (current === null) return next;
  const set = new Set(next);
  return current.filter((id) => set.has(id));
}

function applySummarySort<T extends { order: (col: string, opts: { ascending: boolean; nullsFirst?: boolean }) => T }>(
  query: T,
  sort: z.infer<typeof QuerySchema>["sort"],
): T {
  switch (sort) {
    case "reviews-asc":
      return query.order("reviews_count", { ascending: true, nullsFirst: true }).order("name", { ascending: true });
    case "rating-desc":
      return query.order("rating", { ascending: false, nullsFirst: true }).order("name", { ascending: true });
    case "rating-asc":
      return query.order("rating", { ascending: true, nullsFirst: true }).order("name", { ascending: true });
    case "name-asc":
      return query.order("name", { ascending: true });
    case "name-desc":
      return query.order("name", { ascending: false });
    case "slug-asc":
      return query.order("slug", { ascending: true });
    case "slug-desc":
      return query.order("slug", { ascending: false });
    case "reviews-desc":
    default:
      return query.order("reviews_count", { ascending: false, nullsFirst: true }).order("name", { ascending: true });
  }
}

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
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате достъп." }, { status: 403 }));
  }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const {
    q,
    view,
    product_id,
    stars,
    page,
    perPage,
    sort,
    reviews,
    minRating,
    maxRating,
    minReviews,
    maxReviews,
    brandId,
    condition,
    featured,
    stockStatus,
    hasStar,
  } = parsed.data;
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

  // ── SUMMARY: one row per public-catalog product with distribution ───────
  let productIds: string[] | null = null;

  if (q?.trim()) {
    const term = q.trim().replace(/,/g, " ");
    const { data: pRows, error: pErr } = await applyPublicCatalogFilter(
      supabase
        .from("products")
        .select("id")
        .or(`name.ilike.%${term}%,model_code.ilike.%${term}%,slug.ilike.%${term}%`),
    ).limit(1000);
    if (pErr) return withCors(req, NextResponse.json({ error: pErr.message }, { status: 500 }));
    productIds = intersectIds(productIds, (pRows ?? []).map((p: { id: string }) => p.id));
    if (productIds !== null && productIds.length === 0) {
      return withCors(req, NextResponse.json({ data: [], meta: { page, perPage, total: 0 } }));
    }
  }

  if (hasStar) {
    const { data: starRows, error: starErr } = await supabase
      .from("product_ratings")
      .select("product_id")
      .eq("stars", hasStar);
    if (starErr) return withCors(req, NextResponse.json({ error: starErr.message }, { status: 500 }));
    const starIds = [...new Set((starRows ?? []).map((r: { product_id: string }) => r.product_id))];
    productIds = intersectIds(productIds, starIds);
    if (productIds !== null && productIds.length === 0) {
      return withCors(req, NextResponse.json({ data: [], meta: { page, perPage, total: 0 } }));
    }
  }

  let prodQuery = applyPublicCatalogFilter(
    supabase.from("products").select("id,slug,name,rating,reviews_count", { count: "exact" }),
  );

  if (productIds) prodQuery = prodQuery.in("id", productIds);
  if (brandId) prodQuery = prodQuery.eq("brand_id", brandId);
  if (condition === "new") prodQuery = prodQuery.eq("product_condition", "new");
  if (condition === "used") prodQuery = prodQuery.eq("product_condition", "used");
  if (featured === "yes") prodQuery = prodQuery.eq("is_featured", true);
  if (featured === "no") prodQuery = prodQuery.eq("is_featured", false);
  if (stockStatus === "in_stock") prodQuery = prodQuery.eq("stock_status", "in_stock");
  if (stockStatus === "on_order") prodQuery = prodQuery.eq("stock_status", "on_order");
  if (reviews === "with") prodQuery = prodQuery.gt("reviews_count", 0);
  if (reviews === "without") prodQuery = prodQuery.or("reviews_count.eq.0,reviews_count.is.null");
  if (typeof minRating === "number") prodQuery = prodQuery.gte("rating", minRating);
  if (typeof maxRating === "number") prodQuery = prodQuery.lte("rating", maxRating);
  if (typeof minReviews === "number") prodQuery = prodQuery.gte("reviews_count", minReviews);
  if (typeof maxReviews === "number") prodQuery = prodQuery.lte("reviews_count", maxReviews);

  const from = (page - 1) * perPage;
  const { data: products, error: prodErr, count: prodCount } = await applySummarySort(prodQuery, sort)
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
    rating: Number(p.rating ?? 0),
    reviews_count: Number(p.reviews_count ?? 0),
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
