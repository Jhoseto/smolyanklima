import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { authErrorResponse, requireOfficeStaffSession } from "@/lib/admin/authGuard";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
import { logAdminActivity } from "@/lib/admin/audit";

// Топ продукти за главната страница. Винаги 6 слота (3 горе, 3 долу),
// всеки с опционален badge. Тук правим атомичните операции по позиционирането.

const FEATURED_BADGES = [
  "bestseller",
  "top_offer",
  "promo",
  "top_searched",
  "premium",
  "best_value",
] as const;

const FEATURED_SELECT =
  "id,name,slug,price,featured_position,featured_badge,is_featured,is_active,stock_status,brands:brand_id(name),product_types:type_id(name),product_images(url,is_main,sort_order)";

const SetBodySchema = z.object({
  productId: z.string().uuid(),
  position: z.number().int().min(1).max(6),
  badge: z.enum(FEATURED_BADGES).nullable().optional(),
});

const RemoveBodySchema = z.object({
  productId: z.string().uuid(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/** GET — връща картата на 6-те слота (с метаданни на продуктите на тях). */
export async function GET(req: NextRequest) {
  const supabase = await adminDb();

  let { data, error } = await supabase
    .from("products")
    .select(FEATURED_SELECT)
    .not("featured_position", "is", null)
    .order("featured_position", { ascending: true });

  // Fallback ако миграция 0035 още не е приложена.
  if (error && (isPostgrestMissingColumn(error, "featured_position") || isPostgrestMissingColumn(error, "featured_badge"))) {
    data = [];
    error = null;
  }
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  return withCors(req, NextResponse.json({ data: data ?? [] }));
}

/** POST — задава продукт на позиция 1..6 (+ опционален badge). */
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireOfficeStaffSession();
  } catch (e) {
    const err = authErrorResponse(e);
    return withCors(req, NextResponse.json({ error: err.message }, { status: err.status }));
  }
  const json = await req.json().catch(() => null);
  const parsed = SetBodySchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const { productId, position, badge } = parsed.data;
  const supabase = session.db;

  // 1) Освободи слота, ако там вече стои друг продукт.
  const { error: clearOldOccupantErr } = await supabase
    .from("products")
    .update({ featured_position: null })
    .eq("featured_position", position)
    .neq("id", productId);
  if (clearOldOccupantErr && !isPostgrestMissingColumn(clearOldOccupantErr, "featured_position")) {
    return withCors(req, NextResponse.json({ error: clearOldOccupantErr.message }, { status: 500 }));
  }

  // 2) Преди да присвоим позицията, прочитаме настоящия stock_status.
  //    Публичният endpoint /api/featured-products скрива продуктите с
  //    stock_status = 'out_of_stock'. Затова ако админът съзнателно слага
  //    продукт на витрината, автоматично го връщаме в наличност — иначе
  //    секцията „Топ продукти“ ще изчезне без видима причина за оператора.
  const { data: current, error: readErr } = await supabase
    .from("products")
    .select("stock_status,is_active")
    .eq("id", productId)
    .single();
  if (readErr) return withCors(req, NextResponse.json({ error: readErr.message }, { status: 500 }));

  const willRestoreStock = current?.stock_status === "out_of_stock";
  const willRestoreActive = current?.is_active === false;

  // 3) Задай новата позиция + badge на избрания продукт. Едновременно
  //    включваме is_featured за обратна съвместимост с филтрите и при нужда
  //    нормализираме видимостта в публичния каталог.
  const patch: Record<string, unknown> = {
    featured_position: position,
    featured_badge: badge ?? null,
    is_featured: true,
  };
  if (willRestoreStock) patch.stock_status = "in_stock";
  if (willRestoreActive) patch.is_active = true;

  const { data, error } = await supabase
    .from("products")
    .update(patch)
    .eq("id", productId)
    .select(FEATURED_SELECT)
    .single();

  if (error) {
    if (isPostgrestMissingColumn(error, "featured_position") || isPostgrestMissingColumn(error, "featured_badge")) {
      return withCors(req, NextResponse.json({
        error: "Базата не е мигрирана. Изпълни миграция 0035_featured_top_products.sql.",
      }, { status: 500 }));
    }
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  await logAdminActivity({
    action: "product.featured.set",
    entityType: "product",
    entityId: productId,
    details: {
      position,
      badge: badge ?? null,
      restoredStock: willRestoreStock,
      restoredActive: willRestoreActive,
    },
  });

  return withCors(
    req,
    NextResponse.json({
      ok: true,
      data,
      restored: { stock: willRestoreStock, active: willRestoreActive },
    }),
  );
}

/** DELETE — премахва продукт от Топ продукти. */
export async function DELETE(req: NextRequest) {
  let session;
  try {
    session = await requireOfficeStaffSession();
  } catch (e) {
    const err = authErrorResponse(e);
    return withCors(req, NextResponse.json({ error: err.message }, { status: err.status }));
  }
  const json = await req.json().catch(() => null);
  const parsed = RemoveBodySchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const { productId } = parsed.data;
  const supabase = session.db;

  const { error } = await supabase
    .from("products")
    .update({ featured_position: null, featured_badge: null, is_featured: false })
    .eq("id", productId);

  if (error) {
    if (isPostgrestMissingColumn(error, "featured_position")) {
      return withCors(req, NextResponse.json({ ok: true }));
    }
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  await logAdminActivity({
    action: "product.featured.remove",
    entityType: "product",
    entityId: productId,
  });

  return withCors(req, NextResponse.json({ ok: true }));
}
