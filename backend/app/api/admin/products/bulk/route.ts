import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
import { logAdminActivity } from "@/lib/admin/audit";
import { insertProductCatalogStockCalendarEvent } from "@/lib/admin/productCatalogWorkItems";
import { detachProductsBeforeDelete } from "@/lib/admin/detachProductReferences";
import { mapProductDbError } from "@/lib/admin/productDbErrors";

const IdsSchema = z.array(z.string().uuid()).min(1).max(200);

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    ids: IdsSchema,
    action: z.literal("delete"),
  }),
  z.object({
    ids: IdsSchema,
    action: z.literal("set_public_catalog"),
    visible: z.boolean(),
  }),
]);

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const session = await adminSession();
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право за масови операции." }, { status: 403 }));
  }
  const supabase = session.db;
  const { ids, action } = parsed.data;

  if (action === "delete") {
    const { data: rows, error: selErr } = await supabase.from("products").select("id,name").in("id", ids);
    if (selErr) return withCors(req, NextResponse.json({ error: selErr.message }, { status: 500 }));

    for (const r of rows ?? []) {
      const row = r as { id: string; name?: string | null };
      await insertProductCatalogStockCalendarEvent(supabase, {
        kind: "removed",
        productId: row.id,
        productName: String(row.name ?? ""),
        createdBy: session.userId,
      });
    }

    const { error: detachErr } = await detachProductsBeforeDelete(supabase, ids);
    if (detachErr) {
      const mapped = mapProductDbError(detachErr.message);
      return withCors(
        req,
        NextResponse.json({ error: mapped?.error ?? detachErr.message }, { status: mapped?.status ?? 500 }),
      );
    }

    const { error } = await supabase.from("products").delete().in("id", ids);
    if (error) {
      const mapped = mapProductDbError(error.message);
      return withCors(
        req,
        NextResponse.json({ error: mapped?.error ?? error.message }, { status: mapped?.status ?? 500 }),
      );
    }

    await logAdminActivity({
      action: "product.bulk.delete",
      entityType: "product",
      details: { ids, affected: ids.length },
    });
    return withCors(req, NextResponse.json({ ok: true, affected: ids.length }));
  }

  const visible = parsed.data.visible;
  const { error } = await supabase.from("products").update({ show_in_public_catalog: visible }).in("id", ids);
  if (error) {
    if (isPostgrestMissingColumn(error, "show_in_public_catalog")) {
      return withCors(
        req,
        NextResponse.json(
          {
            error:
              "Липсва колона show_in_public_catalog. Пуснете миграция 0051_products_public_catalog_bulclima_sync.sql.",
          },
          { status: 500 },
        ),
      );
    }
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  await logAdminActivity({
    action: visible ? "product.bulk.show_public" : "product.bulk.hide_public",
    entityType: "product",
    details: { ids, visible, affected: ids.length },
  });

  return withCors(req, NextResponse.json({ ok: true, affected: ids.length, visible }));
}
