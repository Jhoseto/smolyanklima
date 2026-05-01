import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

const BodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(["activate", "deactivate", "set_new", "set_used", "delete"]),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const { ids, action } = parsed.data;
  const supabase = await adminDb();
  if (action === "delete") {
    const { error } = await supabase.from("products").delete().in("id", ids);
    if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
    await logAdminActivity({
      action: "product.bulk.delete",
      entityType: "product",
      details: { ids, affected: ids.length },
    });
    return withCors(req, NextResponse.json({ ok: true, affected: ids.length }));
  }

  const patch: Record<string, unknown> = {};
  if (action === "activate") patch.is_active = true;
  if (action === "deactivate") patch.is_active = false;
  if (action === "set_new") patch.product_condition = "new";
  if (action === "set_used") patch.product_condition = "used";
  const { error } = await supabase.from("products").update(patch).in("id", ids);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  await logAdminActivity({
    action: `product.bulk.${action}`,
    entityType: "product",
    details: { ids, affected: ids.length, patch },
  });
  return withCors(req, NextResponse.json({ ok: true, affected: ids.length }));
}
