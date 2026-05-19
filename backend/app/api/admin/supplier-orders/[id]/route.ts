import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { normalizeSupplierOrderRow, SUPPLIER_ORDER_SELECT } from "@/lib/admin/supplierOrderRow";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/** GET /api/admin/supplier-orders/[id] — пълни данни за една поръчка */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff", "service_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате достъп." }, { status: 403 }));
  }

  const { id } = await ctx.params;
  const supabase = session.db;

  const { data, error } = await supabase
    .from("work_items")
    .select(SUPPLIER_ORDER_SELECT)
    .eq("id", id)
    .eq("event_code", "supplier_order")
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Поръчката не е намерена" }, { status: 404 }));

  return withCors(
    req,
    NextResponse.json({ data: normalizeSupplierOrderRow(data as Record<string, unknown>) }),
  );
}
