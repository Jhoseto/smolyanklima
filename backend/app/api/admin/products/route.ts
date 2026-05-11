import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb, adminSession } from "@/lib/admin/db";
import { canEditProductStockLocation, normalizeProductStockLocation } from "@/lib/admin/productStockLocation";
import { normalizeProductRegion } from "@/lib/admin/productRegion";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
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

/** Списък: марка/тип + доставка; `stock_location` (0031), `product_region` (0032) — fallback при липсваща колона. */
const ADMIN_PRODUCT_LIST_SELECT_MIN =
  "id,slug,name,price,purchase_price,product_condition,is_featured,stock_status,stock_quantity,sold_quantity,created_at,supplier_id,indoor_unit_serial,outdoor_unit_serial,supplier_invoice_number,brands:brand_id(name),product_types:type_id(name)";
const ADMIN_PRODUCT_LIST_SELECT_WITH_REGION =
  "id,slug,name,price,purchase_price,product_condition,is_featured,stock_status,stock_quantity,sold_quantity,created_at,supplier_id,indoor_unit_serial,outdoor_unit_serial,supplier_invoice_number,product_region,brands:brand_id(name),product_types:type_id(name)";
const ADMIN_PRODUCT_LIST_SELECT_WITH_LOCATION =
  "id,slug,name,price,purchase_price,product_condition,is_featured,stock_status,stock_location,stock_quantity,sold_quantity,created_at,supplier_id,indoor_unit_serial,outdoor_unit_serial,supplier_invoice_number,brands:brand_id(name),product_types:type_id(name)";
const ADMIN_PRODUCT_LIST_SELECT_FULL =
  "id,slug,name,price,purchase_price,product_condition,is_featured,stock_status,stock_location,stock_quantity,sold_quantity,created_at,supplier_id,indoor_unit_serial,outdoor_unit_serial,supplier_invoice_number,product_region,brands:brand_id(name),product_types:type_id(name)";
const QuerySchema = z.object({
  q: z.string().optional(),
  condition: z.enum(["new", "used"]).optional(),
  featured: z.enum(["featured", "regular"]).optional(),
  stockStatus: z.enum(["in_stock", "out_of_stock", "on_order"]).optional(),
  stockLocation: z.enum(["showroom", "warehouse"]).optional(),
  productRegion: z.enum(["europe", "japan"]).optional(),
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
    .enum(["created_at", "name", "price", "stock_quantity", "sold_quantity", "stock_status", "is_featured"])
    .optional()
    .default("created_at"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const CreateSchema = z.object({
  slug: z.preprocess(emptyToUndef, z.string().min(2).max(120).optional()),
  name: z.string().min(2).max(200),
  brandId: z.string().uuid(),
  typeId: z.string().uuid(),
  productCondition: z.enum(["new", "used"]).optional().default("new"),
  description: z.string().max(5000).optional(),
  price: z.number().nonnegative(),
  priceWithMount: z.number().nonnegative().optional(),
  indoorUnitSerial: z.string().max(200).optional().nullable(),
  outdoorUnitSerial: z.string().max(200).optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  purchasedAt: z.string().max(32).optional().nullable(),
  supplierInvoiceNumber: z.string().max(120).optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  isFeatured: z.boolean().optional().default(false),
  stockStatus: z.enum(["in_stock", "out_of_stock", "on_order"]).optional().default("in_stock"),
  stockQuantity: z.number().int().nonnegative().optional().default(0),
  soldQuantity: z.number().int().nonnegative().optional().default(0),
  stockLocation: z.enum(["showroom", "warehouse"]).optional().default("warehouse"),
  productRegion: z.enum(["europe", "japan"]).optional().default("europe"),
  specs: SpecsSchema.optional(),
  images: z.array(ImageSchema).max(MAX_IMAGES).optional(),
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
    featured,
    stockStatus,
    stockLocation,
    productRegion: regionFilter,
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

  const runList = (selectCols: string, applyStockLocationFilter: boolean, applyRegionFilter: boolean) => {
    let query = supabase.from("products").select(selectCols, { count: "exact" });
    if (q?.trim()) {
      const t = q.trim();
      query = query.or(`name.ilike.%${t}%,slug.ilike.%${t}%`);
    }
    if (condition) query = query.eq("product_condition", condition);
    if (featured === "featured") query = query.eq("is_featured", true);
    if (featured === "regular") query = query.eq("is_featured", false);
    if (stockStatus) query = query.eq("stock_status", stockStatus);
    if (applyStockLocationFilter && stockLocation) query = query.eq("stock_location", stockLocation);
    if (applyRegionFilter && regionFilter) query = query.eq("product_region", regionFilter);
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
    return query
      .order(sortBy, { ascending: sortDir === "asc" })
      .order("created_at", { ascending: false })
      .range(from, to);
  };

  const listAttempts: Array<[string, boolean, boolean]> = [
    [ADMIN_PRODUCT_LIST_SELECT_FULL, true, Boolean(regionFilter)],
    [ADMIN_PRODUCT_LIST_SELECT_WITH_REGION, false, Boolean(regionFilter)],
    [ADMIN_PRODUCT_LIST_SELECT_WITH_LOCATION, true, false],
    [ADMIN_PRODUCT_LIST_SELECT_MIN, false, false],
  ];

  let data: unknown[] | null = null;
  let error: { message?: string; code?: string } | null = null;
  let count: number | null = null;
  for (const [sel, locF, regF] of listAttempts) {
    const res = await runList(sel, locF, regF);
    data = res.data as unknown[] | null;
    error = res.error as { message?: string; code?: string } | null;
    count = res.count;
    if (!error) break;
  }
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  const list = (data ?? []) as unknown as Record<string, unknown>[];
  const rows = list.map((r) => ({
    ...r,
    stock_location: normalizeProductStockLocation((r as { stock_location?: unknown }).stock_location),
    product_region: normalizeProductRegion((r as { product_region?: unknown }).product_region),
  }));

  return withCors(
    req,
    NextResponse.json({
      data: rows,
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

  const session = await adminSession();
  const supabase = session.db;
  const loc =
    canEditProductStockLocation(session.role) ? normalizeProductStockLocation(parsed.data.stockLocation) : "warehouse";
  const reg = normalizeProductRegion(parsed.data.productRegion);

  const insertBase = {
    slug: parsed.data.slug ?? null,
    name: parsed.data.name,
    brand_id: parsed.data.brandId,
    type_id: parsed.data.typeId,
    product_condition: parsed.data.productCondition,
    description: parsed.data.description,
    price: parsed.data.price,
    price_with_mount: parsed.data.priceWithMount,
    indoor_unit_serial: parsed.data.indoorUnitSerial?.trim() || null,
    outdoor_unit_serial: parsed.data.outdoorUnitSerial?.trim() || null,
    supplier_id: parsed.data.supplierId ?? null,
    purchased_at: parsed.data.purchasedAt?.trim() || null,
    supplier_invoice_number: parsed.data.supplierInvoiceNumber?.trim() || null,
    purchase_price: parsed.data.purchasePrice ?? null,
    is_active: true,
    is_featured: parsed.data.isFeatured,
    stock_status: parsed.data.stockStatus,
    stock_quantity: parsed.data.stockQuantity,
    sold_quantity: parsed.data.soldQuantity,
  };

  const insertVariants: Record<string, unknown>[] = [
    { ...insertBase, stock_location: loc, product_region: reg },
    { ...insertBase, product_region: reg },
    { ...insertBase, stock_location: loc },
    insertBase,
  ];

  let data: { id: string; slug?: string } | null = null;
  let error: { message?: string; code?: string } | null = null;
  for (const row of insertVariants) {
    const ins = await supabase.from("products").insert(row).select("id,slug").single();
    data = ins.data as { id: string; slug?: string } | null;
    error = ins.error as { message?: string; code?: string } | null;
    if (!error) break;
    const missingLoc = isPostgrestMissingColumn(error, "stock_location");
    const missingReg = isPostgrestMissingColumn(error, "product_region");
    if (!missingLoc && !missingReg) break;
  }

  if (error) {
    const errMsg = String(error.message ?? "");
    const mapped = mapProductDbError(errMsg);
    if (mapped) return withCors(req, NextResponse.json({ error: mapped.error }, { status: mapped.status }));
    return withCors(req, NextResponse.json({ error: errMsg || "Грешка" }, { status: 500 }));
  }
  if (!data) return withCors(req, NextResponse.json({ error: "Неуспешно създаване" }, { status: 500 }));
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

  await logAdminActivity({
    action: "product.create",
    entityType: "product",
    entityId: productId,
    details: {
      slug: parsed.data.slug ?? null,
      name: parsed.data.name,
      price: parsed.data.price,
      condition: parsed.data.productCondition,
    },
  });

  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}
