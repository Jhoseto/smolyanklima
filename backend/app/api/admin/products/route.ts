import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
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
const QuerySchema = z.object({
  q: z.string().optional(),
  condition: z.enum(["new", "used"]).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  featured: z.enum(["featured", "regular"]).optional(),
  stockStatus: z.enum(["in_stock", "out_of_stock", "on_order"]).optional(),
  brandId: z.string().uuid().optional(),
  typeId: z.string().uuid().optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  stockMin: z.coerce.number().int().nonnegative().optional(),
  stockMax: z.coerce.number().int().nonnegative().optional(),
  soldMin: z.coerce.number().int().nonnegative().optional(),
  soldMax: z.coerce.number().int().nonnegative().optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  sortBy: z
    .enum(["created_at", "name", "price", "stock_quantity", "sold_quantity", "is_active", "is_featured"])
    .optional()
    .default("created_at"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const CreateSchema = z
  .object({
    slug: z.string().min(2).max(120),
    name: z.string().min(2).max(200),
    brandId: z.string().uuid(),
    typeId: z.string().uuid(),
    productCondition: z.enum(["new", "used"]).optional().default("new"),
    description: z.string().max(5000).optional(),
    price: z.number().nonnegative(),
    priceWithMount: z.number().nonnegative().optional(),
    oldPrice: z.number().nonnegative().optional(),
    isActive: z.boolean().optional().default(true),
    isFeatured: z.boolean().optional().default(false),
    stockStatus: z.enum(["in_stock", "out_of_stock", "on_order"]).optional().default("in_stock"),
    stockQuantity: z.number().int().nonnegative().optional().default(0),
    soldQuantity: z.number().int().nonnegative().optional().default(0),
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
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const {
    q,
    condition,
    status,
    featured,
    stockStatus,
    brandId,
    typeId,
    priceMin,
    priceMax,
    stockMin,
    stockMax,
    soldMin,
    soldMax,
    createdFrom,
    createdTo,
    sortBy,
    sortDir,
    page,
    perPage,
  } = parsed.data;
  const supabase = await adminDb();
  let query = supabase
    .from("products")
    .select("id,slug,name,price,product_condition,is_active,is_featured,stock_status,stock_quantity,sold_quantity,created_at,brands:brand_id(name),product_types:type_id(name)", {
      count: "exact",
    });
  if (q?.trim()) query = query.or(`name.ilike.%${q.trim()}%,slug.ilike.%${q.trim()}%`);
  if (condition) query = query.eq("product_condition", condition);
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);
  if (featured === "featured") query = query.eq("is_featured", true);
  if (featured === "regular") query = query.eq("is_featured", false);
  if (stockStatus) query = query.eq("stock_status", stockStatus);
  if (brandId) query = query.eq("brand_id", brandId);
  if (typeId) query = query.eq("type_id", typeId);
  if (priceMin !== undefined) query = query.gte("price", priceMin);
  if (priceMax !== undefined) query = query.lte("price", priceMax);
  if (stockMin !== undefined) query = query.gte("stock_quantity", stockMin);
  if (stockMax !== undefined) query = query.lte("stock_quantity", stockMax);
  if (soldMin !== undefined) query = query.gte("sold_quantity", soldMin);
  if (soldMax !== undefined) query = query.lte("sold_quantity", soldMax);
  if (createdFrom) query = query.gte("created_at", `${createdFrom}T00:00:00.000Z`);
  if (createdTo) query = query.lte("created_at", `${createdTo}T23:59:59.999Z`);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const { data, error, count } = await query
    .order(sortBy, { ascending: sortDir === "asc" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(
    req,
    NextResponse.json({
      data: data ?? [],
      meta: { page, perPage, total: count ?? 0 },
    }),
  );
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
      product_condition: parsed.data.productCondition,
      description: parsed.data.description,
      price: parsed.data.price,
      price_with_mount: parsed.data.priceWithMount,
      old_price: parsed.data.oldPrice,
      is_active: parsed.data.isActive,
      is_featured: parsed.data.isFeatured,
      stock_status: parsed.data.stockStatus,
      stock_quantity: parsed.data.stockQuantity,
      sold_quantity: parsed.data.soldQuantity,
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

  try {
    await supabase.from("work_items").insert({
      type: "stock_in",
      event_code: "item_added",
      status: "done",
      priority: "medium",
      title: `Добавен артикул: ${parsed.data.name}`,
      product_id: data.id,
      due_date: new Date().toISOString().slice(0, 10),
      quantity: Math.max(1, Number(parsed.data.stockQuantity ?? 1)),
      unit_price: Number(parsed.data.price),
      total_amount: Number(parsed.data.price) * Math.max(1, Number(parsed.data.stockQuantity ?? 1)),
    });
  } catch {
    // Non-blocking if work_items schema is not migrated yet.
  }

  await logAdminActivity({
    action: "product.create",
    entityType: "product",
    entityId: data.id as string,
    details: {
      slug: parsed.data.slug,
      name: parsed.data.name,
      price: parsed.data.price,
      condition: parsed.data.productCondition,
      isActive: parsed.data.isActive,
    },
  });

  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}
