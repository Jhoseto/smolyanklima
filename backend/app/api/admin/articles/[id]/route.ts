import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

const UpdateSchema = z.object({
  slug: z.string().min(2).max(160).optional(),
  title: z.string().min(2).max(240).optional(),
  excerpt: z.string().max(800).optional().nullable(),
  content: z.string().min(1).optional(),
  categorySlug: z.string().min(1).max(120).optional(),
  tags: z.array(z.string().min(1).max(60)).optional(),
  authorSlug: z.string().min(1).max(120).optional(),
  featuredImage: z.string().min(1).max(2048).optional(),
  images: z.array(z.string().min(1).max(2048)).optional(),
  seo: z
    .object({
      title: z.string().min(1).max(240),
      description: z.string().min(1).max(400),
      keywords: z.array(z.string().min(1).max(60)).default([]),
      ogImage: z.string().min(1).max(2048),
    })
    .optional(),
  isPublished: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("articles")
    .select("id,slug,title,excerpt,content,category_slug,tags,author_slug,featured_image,is_published,is_featured,published_at,seo,schema,updated_at,created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Не е намерено" }, { status: 404 }));
  return withCors(req, NextResponse.json({ data }));
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const supabase = await adminDb();
  const patch: Record<string, unknown> = {};

  if (parsed.data.slug !== undefined) patch.slug = parsed.data.slug;
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.excerpt !== undefined) patch.excerpt = parsed.data.excerpt;
  if (parsed.data.content !== undefined) patch.content = parsed.data.content;
  if (parsed.data.categorySlug !== undefined) patch.category_slug = parsed.data.categorySlug;
  if (parsed.data.tags !== undefined) patch.tags = parsed.data.tags;
  if (parsed.data.authorSlug !== undefined) patch.author_slug = parsed.data.authorSlug;
  if (parsed.data.featuredImage !== undefined) patch.featured_image = parsed.data.featuredImage;
  if (parsed.data.images !== undefined) patch.images = parsed.data.images;
  if (parsed.data.seo !== undefined) patch.seo = parsed.data.seo;
  if (parsed.data.isFeatured !== undefined) patch.is_featured = parsed.data.isFeatured;

  if (parsed.data.isPublished !== undefined) {
    patch.is_published = parsed.data.isPublished;
    patch.published_at = parsed.data.isPublished ? new Date().toISOString() : null;
  }

  patch.modified_at = new Date().toISOString();

  const { data, error } = await supabase.from("articles").update(patch).eq("id", id).select("id,slug").maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Не е намерено" }, { status: 404 }));
  return withCors(req, NextResponse.json({ data }));
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await adminDb();
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ ok: true }));
}

