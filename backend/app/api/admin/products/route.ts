import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

const CreateSchema = z.object({
  slug: z.string().min(2).max(120),
  name: z.string().min(2).max(200),
  brandId: z.string().uuid(),
  typeId: z.string().uuid(),
  description: z.string().max(5000).optional(),
  price: z.number().nonnegative(),
  priceWithMount: z.number().nonnegative().optional(),
  oldPrice: z.number().nonnegative().optional(),
  isActive: z.boolean().optional().default(true),
  isFeatured: z.boolean().optional().default(false),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("products")
    .select("id,slug,name,price,is_active,is_featured,created_at,brands:brand_id(name),product_types:type_id(name)")
    .order("created_at", { ascending: false });
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [] }));
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Invalid body" }, { status: 400 }));

  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("products")
    .insert({
      slug: parsed.data.slug,
      name: parsed.data.name,
      brand_id: parsed.data.brandId,
      type_id: parsed.data.typeId,
      description: parsed.data.description,
      price: parsed.data.price,
      price_with_mount: parsed.data.priceWithMount,
      old_price: parsed.data.oldPrice,
      is_active: parsed.data.isActive,
      is_featured: parsed.data.isFeatured,
    })
    .select("id,slug")
    .single();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}

