import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { optimizeArticlePayloadForWeb } from "@/lib/services/cloudinaryService";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("articles")
    .select("id,slug,title,excerpt,content,category_slug,tags,author_slug,featured_image,images,seo,schema,published_at,modified_at,reading_time,view_count,is_featured")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

  return withCors(req, NextResponse.json({ data: optimizeArticlePayloadForWeb(data as Record<string, unknown>) }));
}

