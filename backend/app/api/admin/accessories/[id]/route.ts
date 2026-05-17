import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb, adminSession, requireRole } from "@/lib/admin/db";
import { getEnv } from "@/lib/env";
import { logAdminActivity } from "@/lib/admin/audit";
import { mapProductDbError } from "@/lib/admin/productDbErrors";
import { replaceAccessoryImages, type ImageInput } from "@/lib/admin/syncProductChildren";
import { stripImportSourceFromDescription } from "@/lib/import/stripImportSourceFromDescription";
import { withCloudinaryWebOptimization } from "@/lib/services/cloudinaryService";

const ImageSchema = z.object({
  url: z.string().min(4).max(8192),
  sort_order: z.number().int().optional().default(0),
  is_main: z.boolean().optional().default(false),
});

const optionalBrandId = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().uuid().nullable().optional(),
);

const UpdateSchema = z.object({
  slug: z.string().min(2).max(120).nullable().optional(),
  name: z.string().min(2).max(240).optional(),
  brandId: optionalBrandId,
  kind: z.enum(["accessory", "spare_part", "consumable"]).optional(),
  description: z.string().max(10000).nullable().optional(),
  price: z.number().nonnegative().optional(),
  oldPrice: z.number().nonnegative().nullable().optional(),
  stockStatus: z.enum(["in_stock", "out_of_stock", "on_order"]).optional(),
  stockQuantity: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  images: z.array(ImageSchema).max(4).optional(),
});

function resolveAdminImageUrl(url: string, frontendOrigin: string) {
  if (!url) return url;
  if (url.startsWith("/")) return `${frontendOrigin.replace(/\/$/, "")}${url}`;
  return withCloudinaryWebOptimization(url);
}

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await adminDb();
  const { data: row, error } = await supabase
    .from("accessories")
    .select(
      "id,slug,name,description,price,old_price,kind,is_active,stock_status,stock_quantity,meta_title,meta_description,brand_id,brands:brand_id(id,name)",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!row) return withCors(req, NextResponse.json({ error: "Not found" }, { status: 404 }));

  const { data: images, error: imagesError } = await supabase
    .from("accessory_images")
    .select("id,url,sort_order,is_main")
    .eq("accessory_id", id)
    .order("sort_order", { ascending: true });

  if (imagesError) return withCors(req, NextResponse.json({ error: imagesError.message }, { status: 500 }));

  const env = getEnv();
  return withCors(
    req,
    NextResponse.json({
      data: {
        ...row,
        description: stripImportSourceFromDescription((row as { description?: string | null }).description),
        accessory_images: (images ?? []).map((image) => ({
          ...image,
          url: resolveAdminImageUrl(image.url as string, env.FRONTEND_ORIGIN),
        })),
      },
    }),
  );
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

  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff", "service_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право да редактирате аксесоари." }, { status: 403 }));
  }

  const supabase = session.db;
  const patch: Record<string, unknown> = {};
  if (parsed.data.slug !== undefined) patch.slug = parsed.data.slug;
  if (parsed.data.name !== undefined) patch.name = parsed.data.name.trim();
  if (parsed.data.brandId !== undefined) patch.brand_id = parsed.data.brandId;
  if (parsed.data.kind !== undefined) patch.kind = parsed.data.kind;
  if (parsed.data.description !== undefined) patch.description = parsed.data.description?.trim() || null;
  if (parsed.data.price !== undefined) patch.price = parsed.data.price;
  if (parsed.data.oldPrice !== undefined) patch.old_price = parsed.data.oldPrice;
  if (parsed.data.stockStatus !== undefined) patch.stock_status = parsed.data.stockStatus;
  if (parsed.data.stockQuantity !== undefined) patch.stock_quantity = parsed.data.stockQuantity;
  if (parsed.data.isActive !== undefined) patch.is_active = parsed.data.isActive;

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from("accessories").update(patch).eq("id", id);
    if (error) {
      const mapped = mapProductDbError(String(error.message ?? ""));
      if (mapped) return withCors(req, NextResponse.json({ error: mapped.error }, { status: mapped.status }));
      return withCors(req, NextResponse.json({ error: error.message || "Грешка" }, { status: 500 }));
    }
  }

  if (parsed.data.images) {
    const imgs: ImageInput[] = parsed.data.images.map((im) => ({
      url: im.url,
      sort_order: im.sort_order,
      is_main: im.is_main,
    }));
    const { error: iErr } = await replaceAccessoryImages(supabase, id, imgs);
    if (iErr) {
      const mapped = mapProductDbError(iErr.message);
      if (mapped) return withCors(req, NextResponse.json({ error: mapped.error }, { status: mapped.status }));
      return withCors(req, NextResponse.json({ error: iErr.message }, { status: 500 }));
    }
  }

  await logAdminActivity({
    action: "accessory.update",
    entityType: "accessory",
    entityId: id,
    details: { fields: Object.keys(parsed.data) },
  });

  return withCors(req, NextResponse.json({ data: { id } }));
}
