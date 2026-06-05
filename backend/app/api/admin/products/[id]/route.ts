import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb, adminSession } from "@/lib/admin/db";
import { canEditProductStockLocation, normalizeProductStockLocation } from "@/lib/admin/productStockLocation";
import { canEditProductRegion, normalizeProductRegion } from "@/lib/admin/productRegion";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
import { getEnv } from "@/lib/env";
import { stripImportSourceFromDescription } from "@/lib/import/stripImportSourceFromDescription";
import { withCloudinaryWebOptimization } from "@/lib/services/cloudinaryService";
import { logAdminActivity } from "@/lib/admin/audit";
import { insertProductCatalogStockCalendarEvent } from "@/lib/admin/productCatalogWorkItems";
import { detachProductsBeforeDelete } from "@/lib/admin/detachProductReferences";
import { formatSupabaseError, mapProductDbError } from "@/lib/admin/productDbErrors";
import {
  findSerialConflicts,
  formatSerialConflictError,
  isDeliveredProductInstance,
  mergeDeliveryFields,
  validateDeliveryFieldsComplete,
} from "@/lib/admin/productDeliveryValidation";
import { isOnOrderCatalogTemplate } from "@/lib/admin/createProductInstanceFromTemplate";
import {
  copyProductChildrenToInstance,
  createInstanceFromOnOrderTemplatePut,
  shouldCreateInstanceFromOnOrderPut,
  stripTemplateOnlyFieldsFromPatch,
  validateOnOrderPartialDelivery,
} from "@/lib/admin/productOnOrderInstancePut";
import { enforceStockStatusAfterSale } from "@/lib/admin/productSaleStock";
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

// Включваме `model_code` (миграция 0038). Колоната е по избор —
// при липсваща се прави fallback към варианти без нея.
const ADMIN_PRODUCT_DETAIL_SELECT_WITH_LOCATION =
  "id,slug,name,model_code,brand_id,type_id,product_condition,description,internal_note,price,price_with_mount,indoor_unit_serial,outdoor_unit_serial,supplier_id,purchased_at,supplier_invoice_number,purchase_price,is_featured,show_in_public_catalog,stock_status,stock_location,stock_quantity,sold_quantity,product_region,supplier_order_work_item_id";
const ADMIN_PRODUCT_DETAIL_SELECT_BASE =
  "id,slug,name,model_code,brand_id,type_id,product_condition,description,internal_note,price,price_with_mount,indoor_unit_serial,outdoor_unit_serial,supplier_id,purchased_at,supplier_invoice_number,purchase_price,is_featured,show_in_public_catalog,stock_status,stock_quantity,sold_quantity,product_region,supplier_order_work_item_id";
const ADMIN_PRODUCT_DETAIL_SELECT_NO_REGION =
  "id,slug,name,model_code,brand_id,type_id,product_condition,description,internal_note,price,price_with_mount,indoor_unit_serial,outdoor_unit_serial,supplier_id,purchased_at,supplier_invoice_number,purchase_price,is_featured,stock_status,stock_location,stock_quantity,sold_quantity";
const ADMIN_PRODUCT_DETAIL_SELECT_NO_REGION_NO_LOC =
  "id,slug,name,model_code,brand_id,type_id,product_condition,description,internal_note,price,price_with_mount,indoor_unit_serial,outdoor_unit_serial,supplier_id,purchased_at,supplier_invoice_number,purchase_price,is_featured,stock_status,stock_quantity,sold_quantity";
const ADMIN_PRODUCT_DETAIL_SELECT_NO_MODEL_CODE =
  "id,slug,name,brand_id,type_id,product_condition,description,internal_note,price,price_with_mount,indoor_unit_serial,outdoor_unit_serial,supplier_id,purchased_at,supplier_invoice_number,purchase_price,is_featured,stock_status,stock_quantity,sold_quantity";
const ADMIN_PRODUCT_DETAIL_SELECT_NO_INTERNAL_NOTE =
  "id,slug,name,model_code,brand_id,type_id,product_condition,description,price,price_with_mount,indoor_unit_serial,outdoor_unit_serial,supplier_id,purchased_at,supplier_invoice_number,purchase_price,is_featured,show_in_public_catalog,stock_status,stock_location,stock_quantity,sold_quantity,product_region,supplier_order_work_item_id";

const UpdateSchema = z
  .object({
  slug: z.string().max(120).nullable().optional(),
  name: z.string().min(2).max(200).optional(),
  /** Кратък/технически модел (напр. „FTXA50AW“). */
  modelCode: z.string().max(120).optional().nullable(),
  brandId: z.string().uuid().optional(),
  typeId: z.string().uuid().optional(),
  productCondition: z.enum(["new", "used"]).optional(),
  description: z.string().max(5000).optional().nullable(),
  internalNote: z.string().max(5000).optional().nullable(),
  price: z.number().nonnegative().optional(),
  priceWithMount: z.number().nonnegative().optional().nullable(),
  indoorUnitSerial: z.string().max(200).optional().nullable(),
  outdoorUnitSerial: z.string().max(200).optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  purchasedAt: z.string().max(32).optional().nullable(),
  supplierInvoiceNumber: z.string().max(120).optional().nullable(),
  purchasePrice: z.number().nonnegative().optional().nullable(),
  isFeatured: z.boolean().optional(),
  showInPublicCatalog: z.boolean().optional(),
  stockStatus: z.enum(["in_stock", "out_of_stock", "on_order"]).optional(),
  stockLocation: z.enum(["showroom", "warehouse"]).optional(),
  productRegion: z.enum(["europe", "japan"]).optional(),
  stockQuantity: z.number().int().nonnegative().optional(),
  soldQuantity: z.number().int().nonnegative().optional(),
  specs: SpecsSchema.optional(),
  images: z.array(ImageSchema).max(MAX_IMAGES).optional(),
  /** Шаблон „по поръчка“: създава нова in_stock инстанция (не променя шаблона със серийни №). */
  createInstanceFromOnOrder: z.boolean().optional(),
})
  .superRefine((data, ctx) => {
    if (data.slug === undefined || data.slug === null) return;
    const t = data.slug.trim();
    if (t === "") return;
    if (t.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Slug: минимум 2 знака или оставете празно.",
        path: ["slug"],
      });
    }
  });

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await adminDb();
  let { data: row, error } = await supabase
    .from("products")
    .select(ADMIN_PRODUCT_DETAIL_SELECT_WITH_LOCATION)
    .eq("id", id)
    .maybeSingle();
  if (error && isPostgrestMissingColumn(error, "stock_location")) {
    ({ data: row, error } = await supabase.from("products").select(ADMIN_PRODUCT_DETAIL_SELECT_BASE).eq("id", id).maybeSingle());
  }
  if (error && isPostgrestMissingColumn(error, "product_region")) {
    ({ data: row, error } = await supabase.from("products").select(ADMIN_PRODUCT_DETAIL_SELECT_NO_REGION).eq("id", id).maybeSingle());
  }
  if (error && isPostgrestMissingColumn(error, "stock_location")) {
    ({ data: row, error } = await supabase.from("products").select(ADMIN_PRODUCT_DETAIL_SELECT_NO_REGION_NO_LOC).eq("id", id).maybeSingle());
  }
  // Fallback ако миграция 0038 (model_code) не е приложена.
  if (error && isPostgrestMissingColumn(error, "model_code")) {
    ({ data: row, error } = await supabase.from("products").select(ADMIN_PRODUCT_DETAIL_SELECT_NO_MODEL_CODE).eq("id", id).maybeSingle());
  }
  if (error && isPostgrestMissingColumn(error, "internal_note")) {
    ({ data: row, error } = await supabase.from("products").select(ADMIN_PRODUCT_DETAIL_SELECT_NO_INTERNAL_NOTE).eq("id", id).maybeSingle());
  }
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!row) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

  const env = getEnv();
  const [specsRes, imagesRes, brandRes, typeRes] = await Promise.all([
    supabase.from("product_specs").select("*").eq("product_id", id).maybeSingle(),
    supabase.from("product_images").select("id,url,sort_order,is_main").eq("product_id", id).order("sort_order", { ascending: true }),
    row.brand_id ? supabase.from("brands").select("id,name").eq("id", row.brand_id).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
    row.type_id ? supabase.from("product_types").select("id,name").eq("id", row.type_id).maybeSingle() : Promise.resolve({ data: null, error: null } as any),
  ]);
  if (specsRes.error) return withCors(req, NextResponse.json({ error: specsRes.error.message }, { status: 500 }));
  if (imagesRes.error) return withCors(req, NextResponse.json({ error: imagesRes.error.message }, { status: 500 }));
  if (brandRes.error) return withCors(req, NextResponse.json({ error: brandRes.error.message }, { status: 500 }));
  if (typeRes.error) return withCors(req, NextResponse.json({ error: typeRes.error.message }, { status: 500 }));

  return withCors(
    req,
    NextResponse.json({
      data: {
        ...row,
        description: stripImportSourceFromDescription((row as { description?: string | null }).description),
        stock_location: normalizeProductStockLocation((row as { stock_location?: unknown }).stock_location),
        product_region: normalizeProductRegion((row as { product_region?: unknown }).product_region),
        brands: brandRes.data ?? null,
        product_types: typeRes.data ?? null,
        product_specs: specsRes.data ?? null,
        product_images: (imagesRes.data ?? []).map((image) => ({
          ...image,
          url: resolveAdminImageUrl(image.url, env.FRONTEND_ORIGIN),
        })),
      },
    }),
  );
}

function resolveAdminImageUrl(url: string, frontendOrigin: string) {
  if (!url) return url;
  if (url.startsWith("/")) return `${frontendOrigin.replace(/\/$/, "")}${url}`;
  return withCloudinaryWebOptimization(url);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const detail = first ? `${first.path.join(".") || "body"}: ${first.message}` : "Невалидни данни";
    return withCors(req, NextResponse.json({ error: detail }, { status: 400 }));
  }

  const session = await adminSession();
  if (session.role === "service_staff") {
    return withCors(
      req,
      NextResponse.json({ error: "Сервизните профили не редактират продукти." }, { status: 403 }),
    );
  }
  const supabase = session.db;
  const patch: Record<string, unknown> = {};
  if (parsed.data.slug !== undefined) {
    const s = parsed.data.slug;
    patch.slug = s === null || String(s).trim() === "" ? null : String(s).trim();
  }
  if (parsed.data.name !== undefined) patch.name = parsed.data.name;
  if (parsed.data.modelCode !== undefined) {
    const mc = parsed.data.modelCode === null ? null : String(parsed.data.modelCode).trim();
    patch.model_code = mc && mc.length > 0 ? mc : null;
  }
  if (parsed.data.brandId !== undefined) patch.brand_id = parsed.data.brandId;
  if (parsed.data.typeId !== undefined) patch.type_id = parsed.data.typeId;
  if (parsed.data.productCondition !== undefined) patch.product_condition = parsed.data.productCondition;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description;
  if (parsed.data.internalNote !== undefined) patch.internal_note = parsed.data.internalNote?.trim() || null;
  const isMaster = session.role === "master_admin";
  if (parsed.data.price !== undefined && isMaster) patch.price = parsed.data.price;
  if (parsed.data.priceWithMount !== undefined && isMaster) patch.price_with_mount = parsed.data.priceWithMount;
  if (parsed.data.indoorUnitSerial !== undefined) patch.indoor_unit_serial = parsed.data.indoorUnitSerial?.trim() || null;
  if (parsed.data.outdoorUnitSerial !== undefined) patch.outdoor_unit_serial = parsed.data.outdoorUnitSerial?.trim() || null;
  if (parsed.data.supplierId !== undefined) patch.supplier_id = parsed.data.supplierId;
  if (parsed.data.purchasedAt !== undefined) patch.purchased_at = parsed.data.purchasedAt?.trim() || null;
  if (parsed.data.supplierInvoiceNumber !== undefined)
    patch.supplier_invoice_number = parsed.data.supplierInvoiceNumber?.trim() || null;
  if (parsed.data.purchasePrice !== undefined && isMaster) patch.purchase_price = parsed.data.purchasePrice;
  if (parsed.data.isFeatured !== undefined) patch.is_featured = parsed.data.isFeatured;
  if (parsed.data.showInPublicCatalog !== undefined) patch.show_in_public_catalog = parsed.data.showInPublicCatalog;
  if (parsed.data.stockStatus !== undefined) {
    const { data: currentRow } = await supabase.from("products").select("stock_status").eq("id", id).maybeSingle();
    patch.stock_status = enforceStockStatusAfterSale(
      (currentRow as { stock_status?: string } | null)?.stock_status,
      parsed.data.stockStatus,
    );
  }
  if (parsed.data.stockLocation !== undefined) {
    if (canEditProductStockLocation(session.role)) {
      patch.stock_location = normalizeProductStockLocation(parsed.data.stockLocation);
    }
  }
  if (parsed.data.productRegion !== undefined) {
    if (canEditProductRegion(session.role)) {
      patch.product_region = normalizeProductRegion(parsed.data.productRegion);
    }
  }
  if (parsed.data.stockQuantity !== undefined) patch.stock_quantity = parsed.data.stockQuantity;
  if (parsed.data.soldQuantity !== undefined) patch.sold_quantity = parsed.data.soldQuantity;

  const touchesDelivery =
    parsed.data.indoorUnitSerial !== undefined ||
    parsed.data.outdoorUnitSerial !== undefined ||
    parsed.data.purchasedAt !== undefined ||
    parsed.data.supplierInvoiceNumber !== undefined ||
    parsed.data.stockStatus !== undefined ||
    parsed.data.showInPublicCatalog !== undefined;

  if (Object.keys(patch).length > 0 || touchesDelivery) {
    const { data: currentRow, error: curErr } = await supabase
      .from("products")
      .select(
        "id,brand_id,model_code,stock_status,indoor_unit_serial,outdoor_unit_serial,supplier_invoice_number,purchased_at,supplier_order_work_item_id,show_in_public_catalog",
      )
      .eq("id", id)
      .maybeSingle();
    if (curErr) return withCors(req, NextResponse.json({ error: curErr.message }, { status: 500 }));
    if (!currentRow) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

    const current = currentRow as {
      brand_id: string | null;
      model_code: string | null;
      stock_status: string | null;
      indoor_unit_serial: string | null;
      outdoor_unit_serial: string | null;
      supplier_invoice_number: string | null;
      purchased_at: string | null;
      supplier_order_work_item_id: string | null;
      show_in_public_catalog: boolean | null;
    };

    if (isDeliveredProductInstance(current) && parsed.data.showInPublicCatalog === true) {
      return withCors(
        req,
        NextResponse.json(
          { error: "Доставените бройки не се публикуват в каталога — остава само шаблонът за поръчка." },
          { status: 400 },
        ),
      );
    }

    const mergedDelivery = mergeDeliveryFields(current, parsed.data);
    const deliveryTouched =
      parsed.data.indoorUnitSerial !== undefined ||
      parsed.data.outdoorUnitSerial !== undefined ||
      parsed.data.purchasedAt !== undefined ||
      parsed.data.supplierInvoiceNumber !== undefined;

    if (isDeliveredProductInstance(current)) {
      const deliveryErr = validateDeliveryFieldsComplete(mergedDelivery);
      if (deliveryErr) {
        return withCors(req, NextResponse.json({ error: deliveryErr }, { status: 400 }));
      }
    }

    const partialDeliveryErr = validateOnOrderPartialDelivery(current, parsed.data);
    if (partialDeliveryErr) {
      return withCors(req, NextResponse.json({ error: partialDeliveryErr }, { status: 400 }));
    }

    if (deliveryTouched) {
      try {
        const conflicts = await findSerialConflicts(supabase, {
          indoor: mergedDelivery.indoorUnitSerial,
          outdoor: mergedDelivery.outdoorUnitSerial,
          excludeId: id,
        });
        if (conflicts.length > 0) {
          return withCors(
            req,
            NextResponse.json({ error: formatSerialConflictError(conflicts) }, { status: 409 }),
          );
        }
      } catch (e) {
        return withCors(req, NextResponse.json({ error: String((e as Error).message) }, { status: 500 }));
      }
    }

    if (parsed.data.createInstanceFromOnOrder === true && isOnOrderCatalogTemplate(current)) {
      const instanceDeliveryErr = validateDeliveryFieldsComplete(mergedDelivery);
      if (instanceDeliveryErr) {
        return withCors(req, NextResponse.json({ error: instanceDeliveryErr }, { status: 400 }));
      }
    }

    if (shouldCreateInstanceFromOnOrderPut(current, parsed.data)) {
      const { data: template, error: tplErr } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
      if (tplErr) return withCors(req, NextResponse.json({ error: tplErr.message }, { status: 500 }));
      if (!template) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

      stripTemplateOnlyFieldsFromPatch(patch);

      try {
        if (Object.keys(patch).length > 0) {
          const { error: updErr } = await supabase.from("products").update(patch).eq("id", id);
          if (updErr) {
            const mapped = mapProductDbError(updErr.message);
            if (mapped) return withCors(req, NextResponse.json({ error: mapped.error }, { status: mapped.status }));
            return withCors(req, NextResponse.json({ error: updErr.message }, { status: 500 }));
          }
        }

        if (parsed.data.specs) {
          const { error: sErr } = await upsertProductSpecs(supabase, id, parsed.data.specs as SpecsInput);
          if (sErr) return withCors(req, NextResponse.json({ error: sErr.message }, { status: 500 }));
        }

        if (parsed.data.images) {
          const imgs: ImageInput[] = parsed.data.images.map((im) => ({
            url: im.url,
            sort_order: im.sort_order,
            is_main: im.is_main,
          }));
          const { error: iErr } = await replaceProductImages(supabase, id, imgs);
          if (iErr) return withCors(req, NextResponse.json({ error: iErr.message }, { status: 500 }));
        }

        const instance = await createInstanceFromOnOrderTemplatePut(
          supabase,
          template as Record<string, unknown>,
          current,
          parsed.data,
        );

        const childErr = await copyProductChildrenToInstance(
          supabase,
          instance.id,
          parsed.data.specs as SpecsInput | undefined,
          parsed.data.images,
        );
        if (childErr) {
          await supabase.from("products").delete().eq("id", instance.id);
          return withCors(req, NextResponse.json({ error: childErr }, { status: 500 }));
        }

        const { data: out } = await supabase.from("products").select("id,slug").eq("id", id).maybeSingle();
        await logAdminActivity({
          action: "product.instance.create",
          entityType: "product",
          entityId: instance.id,
          details: {
            templateProductId: id,
            templateName: String((template as { name?: string }).name ?? ""),
            instanceName: instance.name,
          },
        });

        return withCors(
          req,
          NextResponse.json({
            data: {
              ...out,
              createdInstanceId: instance.id,
            },
          }),
        );
      } catch (e) {
        return withCors(req, NextResponse.json({ error: String((e as Error).message) }, { status: 500 }));
      }
    } else if (isOnOrderCatalogTemplate(current)) {
      stripTemplateOnlyFieldsFromPatch(patch);
    }
  }

  if (Object.keys(patch).length > 0) {
    let { data, error } = await supabase.from("products").update(patch).eq("id", id).select("id,slug").maybeSingle();
    if (error && isPostgrestMissingColumn(error, "stock_location") && "stock_location" in patch) {
      const { stock_location: _omit, ...patchRest } = patch;
      ({ data, error } = await supabase.from("products").update(patchRest).eq("id", id).select("id,slug").maybeSingle());
      delete patch.stock_location;
    }
    if (error && isPostgrestMissingColumn(error, "product_region") && "product_region" in patch) {
      const { product_region: _omitR, ...patchRest2 } = patch;
      ({ data, error } = await supabase.from("products").update(patchRest2).eq("id", id).select("id,slug").maybeSingle());
      delete patch.product_region;
    }
    // Fallback ако миграция 0038 (`model_code`) не е приложена.
    if (error && isPostgrestMissingColumn(error, "model_code") && "model_code" in patch) {
      const { model_code: _omitMc, ...patchRest3 } = patch;
      ({ data, error } = await supabase.from("products").update(patchRest3).eq("id", id).select("id,slug").maybeSingle());
      delete patch.model_code;
    }
    if (error && isPostgrestMissingColumn(error, "show_in_public_catalog") && "show_in_public_catalog" in patch) {
      const { show_in_public_catalog: _omitPub, ...patchRest4 } = patch;
      ({ data, error } = await supabase.from("products").update(patchRest4).eq("id", id).select("id,slug").maybeSingle());
      delete patch.show_in_public_catalog;
    }
    if (error && isPostgrestMissingColumn(error, "internal_note") && "internal_note" in patch) {
      const { internal_note: _omitIn, ...patchRest5 } = patch;
      ({ data, error } = await supabase.from("products").update(patchRest5).eq("id", id).select("id,slug").maybeSingle());
      delete patch.internal_note;
    }
    if (error) {
      console.error("[admin/products][PUT] products.update failed", { id, patch, ...formatSupabaseError(error) });
      const mapped = mapProductDbError(error.message);
      if (mapped) return withCors(req, NextResponse.json({ error: mapped.error }, { status: mapped.status }));
      const f = formatSupabaseError(error);
      return withCors(req, NextResponse.json({ error: f.message, code: f.code, details: f.details }, { status: 500 }));
    }
    if (!data) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));
  } else if (parsed.data.specs !== undefined || parsed.data.images !== undefined) {
    const { data: exists, error: exErr } = await supabase.from("products").select("id").eq("id", id).maybeSingle();
    if (exErr) return withCors(req, NextResponse.json({ error: exErr.message }, { status: 500 }));
    if (!exists) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));
  }

  if (parsed.data.specs) {
    const { error: sErr } = await upsertProductSpecs(supabase, id, parsed.data.specs as SpecsInput);
    if (sErr) {
      console.error("[admin/products][PUT] product_specs.upsert failed", { id, specs: parsed.data.specs, ...formatSupabaseError(sErr) });
      const mapped = mapProductDbError(sErr.message);
      if (mapped) return withCors(req, NextResponse.json({ error: mapped.error }, { status: mapped.status }));
      const f = formatSupabaseError(sErr);
      return withCors(req, NextResponse.json({ error: f.message, code: f.code, details: f.details }, { status: 500 }));
    }
  }

  if (parsed.data.images) {
    const imgs: ImageInput[] = parsed.data.images.map((im) => ({
      url: im.url,
      sort_order: im.sort_order,
      is_main: im.is_main,
    }));
    const { error: iErr } = await replaceProductImages(supabase, id, imgs);
    if (iErr) {
      console.error("[admin/products][PUT] product_images.replace failed", { id, imagesCount: imgs.length, ...formatSupabaseError(iErr) });
      const mapped = mapProductDbError(iErr.message);
      if (mapped) return withCors(req, NextResponse.json({ error: mapped.error }, { status: mapped.status }));
      const f = formatSupabaseError(iErr);
      return withCors(req, NextResponse.json({ error: f.message, code: f.code, details: f.details }, { status: 500 }));
    }
  }

  const { data: out } = await supabase.from("products").select("id,slug").eq("id", id).maybeSingle();
  const changedFields = Object.keys(patch);
  const isPriceOnlyUpdate =
    changedFields.length === 1 &&
    changedFields[0] === "price" &&
    parsed.data.specs === undefined &&
    parsed.data.images === undefined;
  await logAdminActivity({
    action: isPriceOnlyUpdate ? "product.price.update" : "product.update",
    entityType: "product",
    entityId: id,
    details: {
      changedFields,
      price: parsed.data.price ?? null,
      hasSpecsUpdate: Boolean(parsed.data.specs),
      hasImagesUpdate: Boolean(parsed.data.images),
      slug: out?.slug ?? null,
    },
  });
  return withCors(req, NextResponse.json({ data: out }));
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const session = await adminSession();
  if (session.role === "service_staff") {
    return withCors(
      req,
      NextResponse.json({ error: "Сервизните профили не изтриват продукти." }, { status: 403 }),
    );
  }
  const supabase = session.db;

  const { data: prod } = await supabase.from("products").select("id,name").eq("id", id).maybeSingle();
  if (prod) {
    await insertProductCatalogStockCalendarEvent(supabase, {
      kind: "removed",
      productId: id,
      productName: String((prod as { name?: string }).name ?? ""),
      createdBy: session.userId,
    });
  }

  const { error: detachErr } = await detachProductsBeforeDelete(supabase, [id]);
  if (detachErr) {
    const mapped = mapProductDbError(detachErr.message);
    return withCors(
      req,
      NextResponse.json({ error: mapped?.error ?? detachErr.message }, { status: mapped?.status ?? 500 }),
    );
  }

  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) {
    const mapped = mapProductDbError(error.message);
    return withCors(req, NextResponse.json({ error: mapped?.error ?? error.message }, { status: mapped?.status ?? 500 }));
  }
  await logAdminActivity({
    action: "product.delete",
    entityType: "product",
    entityId: id,
  });
  return withCors(req, NextResponse.json({ ok: true }));
}
