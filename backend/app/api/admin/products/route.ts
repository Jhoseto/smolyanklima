import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { mapProductDbError } from "@/lib/admin/productDbErrors";
import { replaceProductImages, upsertProductSpecs, type ImageInput, type SpecsInput } from "@/lib/admin/syncProductChildren";

const SpecsSchema = z.object({
  coverage_m2: z.number().nonnegative().nullable().optional(),
  noise_db: z.number().nonnegative().nullable().optional(),
  cooling_power_kw: z.number().nonnegative().nullable().optional(),
  heating_power_kw: z.number().nonnegative().nullable().optional(),
  refrigerant: z.string().max(80).nullable().optional(),
  wifi: z.boolean().nullable().optional(),
  energy_class_cool: z.string().max(20).nullable().optional(),
  energy_class_heat: z.string().max(20).nullable().optional(),
  seer: z.number().nonnegative().nullable().optional(),
  scop: z.number().nonnegative().nullable().optional(),
  warranty_months: z.number().int().nonnegative().nullable().optional(),
});

const ImageSchema = z.object({
  url: z.string().min(4).max(8192),
  sort_order: z.number().int().optional().default(0),
  is_main: z.boolean().optional().default(false),
});
const MAX_IMAGES = 4;

const CreateSchema = z
  .object({
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
    stockStatus: z.enum(["in_stock", "out_of_stock", "on_order"]).optional().default("in_stock"),
    stockQuantity: z.number().int().nonnegative().optional().default(0),
    specs: SpecsSchema.optional(),
    images: z.array(ImageSchema).max(MAX_IMAGES).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.oldPrice != null && data.oldPrice < data.price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Старата цена трябва да е ≥ текущата цена или да е празна.",
        path: ["oldPrice"],
      });
    }
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
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const detail = first ? `${first.path.join(".") || "body"}: ${first.message}` : "Невалидни данни";
    return withCors(req, NextResponse.json({ error: detail }, { status: 400 }));
  }

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
      stock_status: parsed.data.stockStatus,
      stock_quantity: parsed.data.stockQuantity,
    })
    .select("id,slug")
    .single();

  if (error) {
    const mapped = mapProductDbError(error.message);
    if (mapped) return withCors(req, NextResponse.json({ error: mapped.error }, { status: mapped.status }));
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }
  const productId = data.id as string;

  if (parsed.data.specs) {
    const { error: sErr } = await upsertProductSpecs(supabase, productId, parsed.data.specs as SpecsInput);
    if (sErr) {
      const mapped = mapProductDbError(sErr.message);
      if (mapped) return withCors(req, NextResponse.json({ error: mapped.error }, { status: mapped.status }));
      return withCors(req, NextResponse.json({ error: sErr.message }, { status: 500 }));
    }
  }

  if (parsed.data.images?.length) {
    const imgs: ImageInput[] = parsed.data.images.map((im) => ({
      url: im.url,
      sort_order: im.sort_order,
      is_main: im.is_main,
    }));
    const { error: iErr } = await replaceProductImages(supabase, productId, imgs);
    if (iErr) {
      const mapped = mapProductDbError(iErr.message);
      if (mapped) return withCors(req, NextResponse.json({ error: mapped.error }, { status: mapped.status }));
      return withCors(req, NextResponse.json({ error: iErr.message }, { status: 500 }));
    }
  }

  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}
