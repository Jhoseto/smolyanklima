import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { insertProductCatalogStockCalendarEvent } from "@/lib/admin/productCatalogWorkItems";

// Единственото масово действие е изтриване. Всички останали характеристики
// (статус, тип, наличност, нови/втора употреба) се настройват индивидуално
// от картата на конкретния продукт — всеки климатик е уникален артикул
// със собствени серийни номера и не се мисли „на бройки“.
const BodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.literal("delete"),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const { ids } = parsed.data;
  const session = await adminSession();
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право за масово изтриване." }, { status: 403 }));
  }
  const supabase = session.db;

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

  const { error } = await supabase.from("products").delete().in("id", ids);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  await logAdminActivity({
    action: "product.bulk.delete",
    entityType: "product",
    details: { ids, affected: ids.length },
  });
  return withCors(req, NextResponse.json({ ok: true, affected: ids.length }));
}
