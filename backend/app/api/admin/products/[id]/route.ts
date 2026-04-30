import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

const UpdateSchema = z.object({
  slug: z.string().min(2).max(120).optional(),
  name: z.string().min(2).max(200).optional(),
  brandId: z.string().uuid().optional(),
  typeId: z.string().uuid().optional(),
  description: z.string().max(5000).optional().nullable(),
  price: z.number().nonnegative().optional(),
  priceWithMount: z.number().nonnegative().optional().nullable(),
  oldPrice: z.number().nonnegative().optional().nullable(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("products")
    .select("id,slug,name,brand_id,type_id,description,price,price_with_mount,old_price,is_active,is_featured")
    .eq("id", id)
    .maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));
  return withCors(req, NextResponse.json({ data }));
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Invalid body" }, { status: 400 }));

  const supabase = await adminDb();
  const patch: Record<string, unknown> = {};
  if (parsed.data.slug !== undefined) patch.slug = parsed.data.slug;
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.brandId !== undefined) patch.brand_id = parsed.data.brandId;
  if (parsed.data.typeId !== undefined) patch.type_id = parsed.data.typeId;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.price !== undefined) patch.price = parsed.data.price;
  if (parsed.data.priceWithMount !== undefined) patch.price_with_mount = parsed.data.priceWithMount;
  if (parsed.data.oldPrice !== undefined) patch.old_price = parsed.data.oldPrice;
  if (parsed.data.isActive !== undefined) patch.is_active = parsed.data.isActive;
  if (parsed.data.isFeatured !== undefined) patch.is_featured = parsed.data.isFeatured;

  const { data, error } = await supabase.from("products").update(patch).eq("id", id).select("id,slug").maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));
  return withCors(req, NextResponse.json({ data }));
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await adminDb();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ ok: true }));
}

