import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { adminLocalDateKey } from "@/lib/admin/localDateKey";
import {
  attachDeliveredProductsToOrders,
  normalizeSupplierOrderRow,
  SUPPLIER_ORDER_SELECT,
} from "@/lib/admin/supplierOrderRow";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const ListQuerySchema = z.object({
  q: z.string().optional(),
  /** planned | in_progress | done | cancelled */
  status: z.enum(["planned", "in_progress", "done", "cancelled"]).optional(),
  /** ordered = чака доставка; delivered = доставена; cancelled; all = без филтър */
  phase: z.enum(["ordered", "delivered", "cancelled", "active", "all"]).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * GET /api/admin/supplier-orders
 * Без page: активни поръчки (табло). С page + филтри: пълна хронология.
 */
export async function GET(req: NextRequest) {
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

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = ListQuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));
  }

  const supabase = session.db;
  const historyMode = parsed.data.page != null || req.nextUrl.searchParams.has("phase");

  if (!historyMode) {
    const { data, error } = await supabase
      .from("work_items")
      .select(SUPPLIER_ORDER_SELECT)
      .eq("event_code", "supplier_order")
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

    const rows = (data ?? []).map((row) => normalizeSupplierOrderRow(row as Record<string, unknown>));
    return withCors(req, NextResponse.json({ data: rows }));
  }

  const { q, status, phase, from, to, page = 1, perPage = 30 } = parsed.data;

  let query = supabase
    .from("work_items")
    .select(SUPPLIER_ORDER_SELECT, { count: "exact" })
    .eq("event_code", "supplier_order")
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (q?.trim()) {
    query = query.or(
      `title.ilike.%${q.trim()}%,customer_name.ilike.%${q.trim()}%,customer_phone.ilike.%${q.trim()}%,customer_address.ilike.%${q.trim()}%`,
    );
  }
  if (status) query = query.eq("status", status);
  else if (phase === "ordered" || phase === "active") {
    query = query.in("status", ["planned", "in_progress"]);
  } else if (phase === "delivered") {
    query = query.eq("status", "done");
  } else if (phase === "cancelled") {
    query = query.eq("status", "cancelled");
  }

  if (from) query = query.gte("due_date", from);
  if (to) query = query.lte("due_date", to);

  const offset = (page - 1) * perPage;
  const { data, error, count } = await query.range(offset, offset + perPage - 1);

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  let rows = (data ?? []).map((row) => normalizeSupplierOrderRow(row as Record<string, unknown>));

  const doneIds = rows.filter((r) => r.status === "done").map((r) => r.id);
  if (doneIds.length > 0) {
    const { data: instances } = await supabase
      .from("products")
      .select(
        "id, name, slug, price, purchase_price, stock_status, sold_quantity, model_code, brand_id, stock_quantity, indoor_unit_serial, outdoor_unit_serial, supplier_invoice_number, purchased_at, supplier_order_work_item_id",
      )
      .in("supplier_order_work_item_id", doneIds);
    rows = attachDeliveredProductsToOrders(rows, (instances ?? []) as Record<string, unknown>[]);
  }

  return withCors(req, NextResponse.json({ data: rows, meta: { page, perPage, total: count ?? 0 } }));
}

/**
 * POST /api/admin/supplier-orders
 * Creates a supplier_order work item for a product with stock_status = 'on_order'.
 */
export async function POST(req: NextRequest) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Само офис и администратор могат да записват поръчки." }, { status: 403 }));
  }

  const json = await req.json().catch(() => null);
  if (!json || typeof json !== "object") {
    return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));
  }

  const {
    productId,
    contactId,
    customerName,
    customerPhone,
    customerAddress,
    customerEmail,
    notes,
    agreedPrice,
  } = json as Record<string, unknown>;

  if (!productId || typeof productId !== "string") {
    return withCors(req, NextResponse.json({ error: "Липсва productId" }, { status: 400 }));
  }

  const customerNameTrim =
    customerName && typeof customerName === "string" ? String(customerName).trim() : "";
  const customerPhoneTrim =
    customerPhone && typeof customerPhone === "string" ? String(customerPhone).trim() : "";

  const supabase = session.db;

  const { data: product, error: prodErr } = await supabase
    .from("products")
    .select("id, name, stock_status, price")
    .eq("id", productId)
    .maybeSingle();

  if (prodErr) return withCors(req, NextResponse.json({ error: prodErr.message }, { status: 500 }));
  if (!product) return withCors(req, NextResponse.json({ error: "Продуктът не е намерен" }, { status: 404 }));
  if (product.stock_status !== "on_order") {
    return withCors(
      req,
      NextResponse.json(
        { error: 'Само продукти с статус "По поръчка" могат да се поръчват от доставчик.' },
        { status: 400 },
      ),
    );
  }

  const today = adminLocalDateKey();
  const unitPrice = typeof agreedPrice === "number" && agreedPrice >= 0 ? agreedPrice : Number(product.price);

  const { data: workItem, error: wiErr } = await supabase
    .from("work_items")
    .insert({
      type: "sale",
      event_code: "supplier_order",
      title: `Поръчка от доставчик: ${product.name}`,
      status: "planned",
      priority: "medium",
      due_date: today,
      product_id: productId,
      contact_id: contactId && typeof contactId === "string" ? contactId : null,
      customer_name: customerNameTrim || null,
      customer_phone: customerPhoneTrim || null,
      customer_address: customerAddress && typeof customerAddress === "string" ? String(customerAddress).trim() : null,
      notes: notes && typeof notes === "string" ? String(notes).trim() : null,
      quantity: 1,
      unit_price: unitPrice,
      total_amount: unitPrice,
    })
    .select("*")
    .single();

  if (wiErr) return withCors(req, NextResponse.json({ error: wiErr.message }, { status: 500 }));

  if (customerEmail && typeof customerEmail === "string" && customerEmail.trim() && contactId && typeof contactId === "string") {
    // Optionally store email on contact — best-effort, no fatal error
  }

  return withCors(req, NextResponse.json({ data: workItem }, { status: 201 }));
}
