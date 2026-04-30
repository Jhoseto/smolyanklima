import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { optimizeArticlePayloadForWeb } from "@/lib/services/cloudinaryService";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(50).optional(),
  q: z.string().optional(),
  category: z.string().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid query" }, { status: 400 }));
  }

  const { page = 1, perPage = 12, q, category } = parsed.data;
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("articles")
    .select(
      "id,slug,title,excerpt,category_slug,tags,author_slug,featured_image,images,seo,schema,published_at,modified_at,reading_time,view_count,is_featured",
      { count: "exact" },
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (category) query = query.eq("category_slug", category);
  if (q && q.trim()) {
    const term = q.trim();
    query = query.or(`title.ilike.%${term}%,excerpt.ilike.%${term}%,content.ilike.%${term}%`);
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query.range(from, to);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  const rows = (data ?? []).map((row) => optimizeArticlePayloadForWeb(row as Record<string, unknown>));
  return withCors(req, NextResponse.json({ data: rows, meta: { page, perPage, total: count ?? 0 } }));
}

