import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { normalizeSupplierOrderRow, SUPPLIER_ORDER_SELECT } from "@/lib/admin/supplierOrderRow";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/**
 * GET /api/admin/supplier-orders
 * Returns all non-done supplier_order work items with full product info.
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

  const supabase = session.db;
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

  const today = new Date().toISOString().slice(0, 10);
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
