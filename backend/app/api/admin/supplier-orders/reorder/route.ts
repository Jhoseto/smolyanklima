import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const BodySchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(500),
});

/**
 * PATCH /api/admin/supplier-orders/reorder
 * Задава ръчен ред на активни поръчки (planned / in_progress). Само master_admin.
 */
export async function PATCH(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin");
  } catch {
    return withCors(
      req,
      NextResponse.json({ error: "Само главният администратор може да променя реда на поръчките." }, { status: 403 }),
    );
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));
  }

  const { orderedIds } = parsed.data;
  const uniqueIds = new Set(orderedIds);
  if (uniqueIds.size !== orderedIds.length) {
    return withCors(req, NextResponse.json({ error: "Дублирани идентификатори в списъка." }, { status: 400 }));
  }

  const supabase = session.db;

  const { data: activeRows, error: activeErr } = await supabase
    .from("work_items")
    .select("id")
    .eq("event_code", "supplier_order")
    .in("status", ["planned", "in_progress"]);

  if (activeErr) return withCors(req, NextResponse.json({ error: activeErr.message }, { status: 500 }));

  const activeIds = new Set((activeRows ?? []).map((r) => String((r as { id: string }).id)));
  for (const id of orderedIds) {
    if (!activeIds.has(id)) {
      return withCors(req, NextResponse.json({ error: "Невалидна или неактивна поръчка в списъка." }, { status: 400 }));
    }
  }

  const missing = [...activeIds].filter((id) => !uniqueIds.has(id)).sort();
  const fullOrder = [...orderedIds, ...missing];

  for (let i = 0; i < fullOrder.length; i += 1) {
    const id = fullOrder[i];
    const { error } = await supabase
      .from("work_items")
      .update({ supplier_order_sort_order: i + 1 })
      .eq("id", id)
      .eq("event_code", "supplier_order");
    if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  await logAdminActivity({
    action: "supplier_order.reorder",
    entityType: "supplier_order",
    entityId: orderedIds[0] ?? null,
    details: { count: fullOrder.length, moved: orderedIds.length },
  });

  return withCors(req, NextResponse.json({ ok: true }));
}
