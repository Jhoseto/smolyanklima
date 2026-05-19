import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

/**
 * POST /api/admin/supplier-orders/[id]/fulfill
 *
 * Marks the product as delivered:
 * 1. Clones the template product into a new instance (stock_status=in_stock,
 *    show_in_public_catalog=false). Serial numbers, invoice, and delivery date
 *    are left empty — admin fills them in the product edit page.
 * 2. Marks the supplier_order work item as done.
 * Returns { productInstanceId } so the caller can navigate to the edit page.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Само офис и администратор могат да изпълняват поръчки." }, { status: 403 }));
  }

  const { id } = await ctx.params;
  const supabase = session.db;

  // Load the supplier_order work item
  const { data: order, error: orderErr } = await supabase
    .from("work_items")
    .select("id, status, event_code, product_id, contact_id, customer_name, customer_phone, customer_address, unit_price, notes, title")
    .eq("id", id)
    .maybeSingle();

  if (orderErr) return withCors(req, NextResponse.json({ error: orderErr.message }, { status: 500 }));
  if (!order) return withCors(req, NextResponse.json({ error: "Поръчката не е намерена" }, { status: 404 }));

  const orderRow = order as {
    id: string;
    event_code?: string;
    status?: string;
    product_id: string | null;
    contact_id: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    customer_address: string | null;
    unit_price: number | null;
    notes: string | null;
    title: string;
  };

  if (orderRow.event_code !== "supplier_order") {
    return withCors(req, NextResponse.json({ error: "Това не е поръчка от доставчик" }, { status: 400 }));
  }
  if (orderRow.status === "done") {
    return withCors(req, NextResponse.json({ error: "Поръчката вече е изпълнена" }, { status: 409 }));
  }
  if (!orderRow.product_id) {
    return withCors(req, NextResponse.json({ error: "Поръчката няма свързан продукт" }, { status: 400 }));
  }

  // Load the template product to clone
  const { data: template, error: tplErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", orderRow.product_id)
    .maybeSingle();

  if (tplErr) return withCors(req, NextResponse.json({ error: tplErr.message }, { status: 500 }));
  if (!template) return withCors(req, NextResponse.json({ error: "Шаблонният продукт не е намерен" }, { status: 404 }));

  const tpl = template as Record<string, unknown>;

  // Create the delivered product instance (serials/invoice/delivery filled later via edit page)
  const { data: newProduct, error: prodErr } = await supabase
    .from("products")
    .insert({
      name: tpl.name,
      slug: null,
      description: tpl.description ?? null,
      price: typeof orderRow.unit_price === "number" && orderRow.unit_price >= 0 ? orderRow.unit_price : Number(tpl.price ?? 0),
      price_with_mount: tpl.price_with_mount ?? null,
      purchase_price: tpl.purchase_price ?? null,
      brand_id: tpl.brand_id ?? null,
      type_id: tpl.type_id ?? null,
      product_condition: tpl.product_condition ?? "new",
      stock_status: "in_stock",
      stock_quantity: 1,
      sold_quantity: 0,
      show_in_public_catalog: false,
      is_featured: false,
      featured_position: null,
      model_code: tpl.model_code ?? null,
      supplier_id: tpl.supplier_id ?? null,
      source_url: tpl.source_url ?? null,
      product_region: tpl.product_region ?? null,
      indoor_unit_serial: null,
      outdoor_unit_serial: null,
      supplier_invoice_number: null,
      purchased_at: null,
      supplier_order_work_item_id: id,
    })
    .select("id, name")
    .single();

  if (prodErr) return withCors(req, NextResponse.json({ error: prodErr.message }, { status: 500 }));

  const newProductId = (newProduct as { id: string }).id;

  // Mark the supplier_order work item as done
  const { error: updateErr } = await supabase
    .from("work_items")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateErr) {
    // Rollback: remove the newly created product
    await supabase.from("products").delete().eq("id", newProductId);
    return withCors(req, NextResponse.json({ error: updateErr.message }, { status: 500 }));
  }

  return withCors(
    req,
    NextResponse.json({ data: { productInstanceId: newProductId } }, { status: 201 }),
  );
}
