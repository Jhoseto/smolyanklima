import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

const CreateSchema = z.object({
  slug: z.string().min(2).max(160),
  title: z.string().min(2).max(240),
  excerpt: z.string().max(800).optional().nullable(),
  content: z.string().min(1),
  categorySlug: z.string().min(1).max(120),
  tags: z.array(z.string().min(1).max(60)).optional().default([]),
  authorSlug: z.string().min(1).max(120),
  featuredImage: z.string().min(1).max(2048),
  images: z.array(z.string().min(1).max(2048)).optional().default([]),
  seo: z
    .object({
      title: z.string().min(1).max(240),
      description: z.string().min(1).max(400),
      keywords: z.array(z.string().min(1).max(60)).default([]),
      ogImage: z.string().min(1).max(2048),
    })
    .optional(),
  isPublished: z.boolean().optional().default(false),
  isFeatured: z.boolean().optional().default(false),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("articles")
    .select("id,slug,title,category_slug,author_slug,is_published,is_featured,published_at,updated_at,created_at")
    .order("created_at", { ascending: false });
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [] }));
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const nowIso = new Date().toISOString();
  const seo =
    parsed.data.seo ??
    ({
      title: parsed.data.title,
      description: (parsed.data.excerpt ?? "").slice(0, 400),
      keywords: parsed.data.tags,
      ogImage: parsed.data.featuredImage,
    } as const);
  const schema = {
    headline: parsed.data.title,
    description: seo.description,
    image: [parsed.data.featuredImage, ...(parsed.data.images ?? [])].filter(Boolean),
    datePublished: nowIso,
    dateModified: nowIso,
    author: { name: parsed.data.authorSlug, url: "" },
  };

  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("articles")
    .insert({
      slug: parsed.data.slug,
      title: parsed.data.title,
      excerpt: parsed.data.excerpt ?? null,
      content: parsed.data.content,
      category_slug: parsed.data.categorySlug,
      tags: parsed.data.tags,
      author_slug: parsed.data.authorSlug,
      featured_image: parsed.data.featuredImage,
      images: parsed.data.images,
      seo,
      schema,
      is_published: parsed.data.isPublished,
      published_at: parsed.data.isPublished ? nowIso : null,
      is_featured: parsed.data.isFeatured,
      modified_at: null,
      reading_time: null,
    })
    .select("id,slug")
    .single();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}

