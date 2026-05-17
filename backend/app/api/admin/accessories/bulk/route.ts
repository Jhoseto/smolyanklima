import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

const IdsSchema = z.array(z.string().uuid()).min(1).max(200);

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    ids: IdsSchema,
    action: z.literal("delete"),
  }),
  z.object({
    ids: IdsSchema,
    action: z.literal("set_active"),
    active: z.boolean(),
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
    const { error } = await supabase.from("accessories").delete().in("id", ids);
    if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

    await logAdminActivity({
      action: "accessory.bulk.delete",
      entityType: "accessory",
      details: { ids, affected: ids.length },
    });
    return withCors(req, NextResponse.json({ ok: true, affected: ids.length }));
  }

  const active = parsed.data.active;
  const { error } = await supabase.from("accessories").update({ is_active: active }).in("id", ids);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  await logAdminActivity({
    action: active ? "accessory.bulk.activate" : "accessory.bulk.deactivate",
    entityType: "accessory",
    details: { ids, active, affected: ids.length },
  });

  return withCors(req, NextResponse.json({ ok: true, affected: ids.length, active }));
}
