import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { mapProductDbError } from "@/lib/admin/productDbErrors";
import { replaceAccessoryImages, type ImageInput } from "@/lib/admin/syncProductChildren";
import { slugifyBg } from "@/lib/import/slugify";

const ImageSchema = z.object({
  url: z.string().min(4).max(8192),
  sort_order: z.number().int().optional().default(0),
  is_main: z.boolean().optional().default(false),
});

/** Празен string → null (аксесоарът може да няма марка). */
const optionalBrandId = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().uuid().nullable().optional(),
);

const CreateSchema = z.object({
  slug: z.string().min(2).max(120).optional(),
  name: z.string().min(2).max(240),
  brandId: optionalBrandId,
  kind: z.enum(["accessory", "spare_part", "consumable"]).default("accessory"),
  description: z.string().max(10000).optional(),
  price: z.number().nonnegative(),
  oldPrice: z.number().nonnegative().nullable().optional(),
  stockStatus: z.enum(["in_stock", "out_of_stock", "on_order"]).default("in_stock"),
  stockQuantity: z.number().int().nonnegative().default(0),
  isActive: z.boolean().default(true),
  images: z.array(ImageSchema).max(4).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
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
    return withCors(req, NextResponse.json({ error: "Нямате право да създавате аксесоари." }, { status: 403 }));
  }

  const supabase = session.db;
  const slug =
    parsed.data.slug?.trim() ||
    slugifyBg(parsed.data.name) ||
    `aks-${Date.now().toString(36)}`;

  const insertRow = {
    slug,
    name: parsed.data.name.trim(),
    brand_id: parsed.data.brandId ?? null,
    kind: parsed.data.kind,
    description: parsed.data.description?.trim() || null,
    price: parsed.data.price,
    old_price: parsed.data.oldPrice ?? null,
    is_active: parsed.data.isActive,
    stock_status: parsed.data.stockStatus,
    stock_quantity: parsed.data.stockQuantity,
  };

  const { data, error } = await supabase.from("accessories").insert(insertRow).select("id,slug").single();

  if (error) {
    const mapped = mapProductDbError(String(error.message ?? ""));
    if (mapped) return withCors(req, NextResponse.json({ error: mapped.error }, { status: mapped.status }));
    return withCors(req, NextResponse.json({ error: error.message || "Грешка" }, { status: 500 }));
  }
  if (!data) return withCors(req, NextResponse.json({ error: "Неуспешно създаване" }, { status: 500 }));

  const accessoryId = data.id as string;

  if (parsed.data.images?.length) {
    const imgs: ImageInput[] = parsed.data.images.map((im) => ({
      url: im.url,
      sort_order: im.sort_order,
      is_main: im.is_main,
    }));
    const { error: iErr } = await replaceAccessoryImages(supabase, accessoryId, imgs);
    if (iErr) {
      const mapped = mapProductDbError(iErr.message);
      if (mapped) return withCors(req, NextResponse.json({ error: mapped.error }, { status: mapped.status }));
      return withCors(req, NextResponse.json({ error: iErr.message }, { status: 500 }));
    }
  }

  await logAdminActivity({
    action: "accessory.create",
    entityType: "accessory",
    entityId: accessoryId,
    details: { slug, name: parsed.data.name, price: parsed.data.price, kind: parsed.data.kind },
  });

  return withCors(req, NextResponse.json({ data: { id: accessoryId, slug: data.slug } }));
}
