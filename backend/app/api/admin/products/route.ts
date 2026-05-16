import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb, adminSession, requireRole } from "@/lib/admin/db";
import { canEditProductStockLocation, normalizeProductStockLocation } from "@/lib/admin/productStockLocation";
import { normalizeProductRegion } from "@/lib/admin/productRegion";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
import { logAdminActivity } from "@/lib/admin/audit";
import { mapProductDbError } from "@/lib/admin/productDbErrors";
import { insertProductCatalogStockCalendarEvent } from "@/lib/admin/productCatalogWorkItems";
import { replaceProductImages, upsertProductSpecs, type ImageInput, type SpecsInput } from "@/lib/admin/syncProductChildren";
import * as catalogBtu from "@/lib/catalog/productBtu";

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
  weight_indoor_kg: z.number().nonnegative().nullable().optional(),
  weight_outdoor_kg: z.number().nonnegative().nullable().optional(),
  dim_indoor_length_mm: z.number().int().nonnegative().nullable().optional(),
  dim_indoor_width_mm: z.number().int().nonnegative().nullable().optional(),
  dim_indoor_height_mm: z.number().int().nonnegative().nullable().optional(),
  dim_outdoor_length_mm: z.number().int().nonnegative().nullable().optional(),
  dim_outdoor_width_mm: z.number().int().nonnegative().nullable().optional(),
  dim_outdoor_height_mm: z.number().int().nonnegative().nullable().optional(),
});

const ImageSchema = z.object({
  url: z.string().min(4).max(8192),
  sort_order: z.number().int().optional().default(0),
  is_main: z.boolean().optional().default(false),
});
const MAX_IMAGES = 4;

/** Списък: марка/тип + доставка; `stock_location` (0031), `product_region` (0032),
 *  `featured_position`+`featured_badge` (0035) — fallback при липсваща колона. */
const FEATURED_COLS = ",featured_position,featured_badge";
const ADMIN_PRODUCT_LIST_SELECT_MIN =
  "id,slug,name,price,purchase_price,product_condition,is_featured,is_active,show_in_public_catalog,stock_status,stock_quantity,sold_quantity,created_at,purchased_at,supplier_id,indoor_unit_serial,outdoor_unit_serial,supplier_invoice_number,model_code,brand_id,brands:brand_id(name),product_types:type_id(name)";
const ADMIN_PRODUCT_LIST_SELECT_WITH_REGION =
  "id,slug,name,price,purchase_price,product_condition,is_featured,is_active,show_in_public_catalog,stock_status,stock_quantity,sold_quantity,created_at,purchased_at,supplier_id,indoor_unit_serial,outdoor_unit_serial,supplier_invoice_number,product_region,model_code,brand_id,brands:brand_id(name),product_types:type_id(name)";
const ADMIN_PRODUCT_LIST_SELECT_WITH_LOCATION =
  "id,slug,name,price,purchase_price,product_condition,is_featured,is_active,show_in_public_catalog,stock_status,stock_location,stock_quantity,sold_quantity,created_at,purchased_at,supplier_id,indoor_unit_serial,outdoor_unit_serial,supplier_invoice_number,model_code,brand_id,brands:brand_id(name),product_types:type_id(name)";
const ADMIN_PRODUCT_LIST_SELECT_FULL =
  "id,slug,name,price,purchase_price,product_condition,is_featured,is_active,show_in_public_catalog,stock_status,stock_location,stock_quantity,sold_quantity,created_at,purchased_at,supplier_id,indoor_unit_serial,outdoor_unit_serial,supplier_invoice_number,product_region,model_code,brand_id,brands:brand_id(name),product_types:type_id(name)";
/** Подмножество без `model_code` — fallback за DB без миграция 0038. */
const ADMIN_PRODUCT_LIST_SELECT_NO_MODEL_CODE_MIN = ADMIN_PRODUCT_LIST_SELECT_MIN.replace(",model_code", "");
const ADMIN_PRODUCT_LIST_SELECT_NO_MODEL_CODE_REGION = ADMIN_PRODUCT_LIST_SELECT_WITH_REGION.replace(",model_code", "");
const ADMIN_PRODUCT_LIST_SELECT_NO_MODEL_CODE_LOCATION = ADMIN_PRODUCT_LIST_SELECT_WITH_LOCATION.replace(",model_code", "");
const ADMIN_PRODUCT_LIST_SELECT_NO_MODEL_CODE_FULL = ADMIN_PRODUCT_LIST_SELECT_FULL.replace(",model_code", "");
const stripPublicCatalogCol = (sel: string) => sel.replace(",show_in_public_catalog", "");
const QuerySchema = z.object({
  q: z.string().optional(),
  condition: z.enum(["new", "used"]).optional(),
  featured: z.enum(["featured", "regular"]).optional(),
  stockStatus: z.enum(["in_stock", "out_of_stock", "on_order"]).optional(),
  stockLocation: z.enum(["showroom", "warehouse"]).optional(),
  productRegion: z.enum(["europe", "japan"]).optional(),
  brandId: z.string().uuid().optional(),
  typeId: z.string().uuid().optional(),
  // Доставчик (контакт от тип supplier) — за бърз филтър по доставчик.
  supplierId: z.string().uuid().optional(),
  priceMin: z.coerce.number().nonnegative().optional(),
  priceMax: z.coerce.number().nonnegative().optional(),
  // Всеки климатик е уникален артикул (със собствени серийни номера), затова
  // не филтрираме „по бройки“. Оставяме само бизнес-критериите: със/без
  // сериен №, със/без попълнена закупна цена.
  hasSerial: z.enum(["with", "without"]).optional(),
  hasPurchasePrice: z.enum(["with", "without"]).optional(),
  // Филтриране по период на ЗАКУПУВАНЕ (`purchased_at`), а не по дата на
  // добавяне в БД (`created_at`). Така справките са по бизнес-логиката:
  // „всичко закупено между X и Y“ — отчетност към счетоводител/доставчик.
  purchasedFrom: z.string().optional(),
  purchasedTo: z.string().optional(),
  /** Номинал BTU (хиляди): 7, 9, 12, 14, 18, 24… */
  btu: z.coerce.number().int().positive().optional(),
  // Сортиране по дата (created_at) и филтриране по период по нея
  // съзнателно НЕ се поддържат — всеки климатик е уникален артикул,
  // а не „склад на бройки“, така че подреждане по добавяне не носи смисъл.
  // Поддържаните полета са онези, които стоят като колони в админ таблицата
  // и могат да се сортират директно (без join към друга таблица).
  sortBy: z
    .enum(["name", "price", "purchase_price", "product_condition", "purchased_at"])
    .optional()
    .default("name"),
  sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
});

const emptyToUndef = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);

const CreateSchema = z.object({
  slug: z.preprocess(emptyToUndef, z.string().min(2).max(120).optional()),
  name: z.string().min(2).max(200),
  /** Кратък/технически модел (напр. „FTXA50AW“). Различен от `name`,
   *  което е публичното име в каталога. */
  modelCode: z.preprocess(emptyToUndef, z.string().max(120).optional().nullable()),
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
  showInPublicCatalog: z.boolean().optional().default(false),
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
    supplierId,
    priceMin,
    priceMax,
    hasSerial,
    hasPurchasePrice,
    purchasedFrom,
    purchasedTo,
    btu: btuRaw,
    sortBy,
    sortDir,
    page,
    perPage,
  } = parsed.data;
  const btuFilter = catalogBtu.parseBtuQueryParam(btuRaw !== undefined ? String(btuRaw) : undefined);
  const supabase = await adminDb();

  let btuProductIds: string[] | null = null;
  if (btuFilter != null) {
    btuProductIds = await catalogBtu.resolveProductIdsForBtu(supabase, btuFilter);
    if (btuProductIds.length === 0) {
      return withCors(
        req,
        NextResponse.json({
          data: [],
          meta: { page, perPage, total: 0 },
        }),
      );
    }
  }

  const runList = (selectCols: string, applyStockLocationFilter: boolean, applyRegionFilter: boolean) => {
    let query = supabase.from("products").select(selectCols, { count: "exact" });
    if (btuProductIds) query = query.in("id", btuProductIds);
    if (q?.trim()) {
      // Универсално търсене: име, slug, серийни номера (вътрешен/външен
      // блок) и номер на фактура от доставчик. Запетайките в `q` се
      // премахват, защото PostgREST ползва запетая като разделител в
      // `or` израза и невалиден синтаксис би върнал 400.
      const t = q.trim().replace(/,/g, " ");
      query = query.or(
        [
          `name.ilike.%${t}%`,
          `slug.ilike.%${t}%`,
          `indoor_unit_serial.ilike.%${t}%`,
          `outdoor_unit_serial.ilike.%${t}%`,
          `supplier_invoice_number.ilike.%${t}%`,
        ].join(","),
      );
    }
    if (condition) query = query.eq("product_condition", condition);
    if (featured === "featured") query = query.eq("is_featured", true);
    if (featured === "regular") query = query.eq("is_featured", false);
    if (stockStatus) query = query.eq("stock_status", stockStatus);
    if (applyStockLocationFilter && stockLocation) query = query.eq("stock_location", stockLocation);
    if (applyRegionFilter && regionFilter) query = query.eq("product_region", regionFilter);
    if (brandId) query = query.eq("brand_id", brandId);
    if (typeId) query = query.eq("type_id", typeId);
    if (supplierId) query = query.eq("supplier_id", supplierId);
    if (priceMin !== undefined) query = query.gte("price", priceMin);
    if (priceMax !== undefined) query = query.lte("price", priceMax);
    if (hasSerial === "with") {
      // Има поне един сериен номер (вътрешен или външен блок).
      query = query.or("indoor_unit_serial.not.is.null,outdoor_unit_serial.not.is.null");
    }
    if (hasSerial === "without") {
      query = query.is("indoor_unit_serial", null).is("outdoor_unit_serial", null);
    }
    if (hasPurchasePrice === "with") query = query.not("purchase_price", "is", null);
    if (hasPurchasePrice === "without") query = query.is("purchase_price", null);
    // Период на закупуване: колоната е тип `date` (без час) → сравняваме
    // директно с ISO дата (YYYY-MM-DD), което Postgres приема нативно.
    if (purchasedFrom) query = query.gte("purchased_at", purchasedFrom);
    if (purchasedTo) query = query.lte("purchased_at", purchasedTo);
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    // Допълнителното подреждане по `name` гарантира стабилен ред при
    // равни стойности (напр. еднакви цени → азбучен ред по име).
    return query
      .order(sortBy, { ascending: sortDir === "asc" })
      .order("name", { ascending: true })
      .range(from, to);
  };

  // Опитваме първо с `featured_position`+`featured_badge` (миграция 0035),
  // и при липсващи колони падаме до старите варианти. Това запазва обратна
  // съвместимост за DB-та, върху които миграцията още не е приложена.
  const listAttempts: Array<[string, boolean, boolean]> = [
    [ADMIN_PRODUCT_LIST_SELECT_FULL + FEATURED_COLS, true, Boolean(regionFilter)],
    [ADMIN_PRODUCT_LIST_SELECT_WITH_REGION + FEATURED_COLS, false, Boolean(regionFilter)],
    [ADMIN_PRODUCT_LIST_SELECT_WITH_LOCATION + FEATURED_COLS, true, false],
    [ADMIN_PRODUCT_LIST_SELECT_MIN + FEATURED_COLS, false, false],
    [ADMIN_PRODUCT_LIST_SELECT_FULL, true, Boolean(regionFilter)],
    [ADMIN_PRODUCT_LIST_SELECT_WITH_REGION, false, Boolean(regionFilter)],
    [ADMIN_PRODUCT_LIST_SELECT_WITH_LOCATION, true, false],
    [ADMIN_PRODUCT_LIST_SELECT_MIN, false, false],
    // Fallback без `model_code` — DB без миграция 0038.
    [ADMIN_PRODUCT_LIST_SELECT_NO_MODEL_CODE_FULL + FEATURED_COLS, true, Boolean(regionFilter)],
    [ADMIN_PRODUCT_LIST_SELECT_NO_MODEL_CODE_REGION + FEATURED_COLS, false, Boolean(regionFilter)],
    [ADMIN_PRODUCT_LIST_SELECT_NO_MODEL_CODE_LOCATION + FEATURED_COLS, true, false],
    [ADMIN_PRODUCT_LIST_SELECT_NO_MODEL_CODE_MIN + FEATURED_COLS, false, false],
    [ADMIN_PRODUCT_LIST_SELECT_NO_MODEL_CODE_FULL, true, Boolean(regionFilter)],
    [ADMIN_PRODUCT_LIST_SELECT_NO_MODEL_CODE_REGION, false, Boolean(regionFilter)],
    [ADMIN_PRODUCT_LIST_SELECT_NO_MODEL_CODE_LOCATION, true, false],
    [ADMIN_PRODUCT_LIST_SELECT_NO_MODEL_CODE_MIN, false, false],
    // Fallback без `show_in_public_catalog` — DB без миграция 0051.
    [stripPublicCatalogCol(ADMIN_PRODUCT_LIST_SELECT_FULL + FEATURED_COLS), true, Boolean(regionFilter)],
    [stripPublicCatalogCol(ADMIN_PRODUCT_LIST_SELECT_MIN + FEATURED_COLS), false, false],
    [stripPublicCatalogCol(ADMIN_PRODUCT_LIST_SELECT_FULL), true, Boolean(regionFilter)],
    [stripPublicCatalogCol(ADMIN_PRODUCT_LIST_SELECT_MIN), false, false],
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

  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff", "service_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право да създавате продукти." }, { status: 403 }));
  }

  const supabase = session.db;
  const loc =
    canEditProductStockLocation(session.role) ? normalizeProductStockLocation(parsed.data.stockLocation) : "warehouse";
  const reg = normalizeProductRegion(parsed.data.productRegion);

  const insertBase = {
    slug: parsed.data.slug ?? null,
    name: parsed.data.name,
    brand_id: parsed.data.brandId,
    type_id: parsed.data.typeId,
    model_code: parsed.data.modelCode?.trim() || null,
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
    show_in_public_catalog: parsed.data.showInPublicCatalog,
    stock_status: parsed.data.stockStatus,
    stock_quantity: parsed.data.stockQuantity,
    sold_quantity: parsed.data.soldQuantity,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { model_code: _mc, ...insertBaseNoModelCode } = insertBase;
  const insertVariants: Record<string, unknown>[] = [
    { ...insertBase, stock_location: loc, product_region: reg },
    { ...insertBase, product_region: reg },
    { ...insertBase, stock_location: loc },
    insertBase,
    // Fallback за DB без миграция 0038 (`model_code` колоната липсва).
    { ...insertBaseNoModelCode, stock_location: loc, product_region: reg },
    { ...insertBaseNoModelCode, product_region: reg },
    { ...insertBaseNoModelCode, stock_location: loc },
    insertBaseNoModelCode,
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
    const missingMc = isPostgrestMissingColumn(error, "model_code");
    if (!missingLoc && !missingReg && !missingMc) break;
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

  await insertProductCatalogStockCalendarEvent(session.db, {
    kind: "added",
    productId,
    productName: parsed.data.name.trim(),
    createdBy: session.userId,
  });

  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}
