import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import {
  findIncompleteDeliveredInstanceForModel,
  findSerialConflicts,
  formatSerialConflictError,
  trimDeliveryFields,
  validateDeliveryFieldsComplete,
} from "@/lib/admin/productDeliveryValidation";
import { logAdminActivity } from "@/lib/admin/audit";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const FulfillBodySchema = z.object({
  indoorUnitSerial: z.string().min(1).max(200),
  outdoorUnitSerial: z.string().min(1).max(200),
  supplierInvoiceNumber: z.string().min(1).max(120),
  purchasedAt: z.string().min(1).max(32),
  purchasePrice: z.number().nonnegative(),
});

/**
 * POST /api/admin/supplier-orders/[id]/fulfill
 *
 * Маркира поръчката като доставена и създава складова инстанция само ако са
 * попълнени серийни номера, дата на доставка и номер на фактура, и серийните
 * не съществуват при друг продукт.
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

  const json = await req.json().catch(() => null);
  const parsedBody = FulfillBodySchema.safeParse(json);
  if (!parsedBody.success) {
    return withCors(
      req,
      NextResponse.json(
        {
          error:
            "Попълнете серийните номера, датата на доставка, доставната цена и номера на фактурата преди да отбележите доставката.",
        },
        { status: 400 },
      ),
    );
  }

  const delivery = trimDeliveryFields(parsedBody.data);
  const deliveryErr = validateDeliveryFieldsComplete(delivery);
  if (deliveryErr) {
    return withCors(req, NextResponse.json({ error: deliveryErr }, { status: 400 }));
  }

  const { id } = await ctx.params;
  const supabase = session.db;

  const { data: order, error: orderErr } = await supabase
    .from("work_items")
    .select("id, status, event_code, product_id, contact_id, customer_name, customer_phone, customer_address, unit_price, purchase_price, notes, title")
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
    purchase_price: number | null;
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

  const { data: template, error: tplErr } = await supabase
    .from("products")
    .select("*")
    .eq("id", orderRow.product_id)
    .maybeSingle();

  if (tplErr) return withCors(req, NextResponse.json({ error: tplErr.message }, { status: 500 }));
  if (!template) return withCors(req, NextResponse.json({ error: "Шаблонният продукт не е намерен" }, { status: 404 }));

  const tpl = template as Record<string, unknown>;
  const brandId = tpl.brand_id as string | null;
  const modelCode = String(tpl.model_code ?? "").trim();

  try {
    const serialConflicts = await findSerialConflicts(supabase, {
      indoor: delivery.indoorUnitSerial,
      outdoor: delivery.outdoorUnitSerial,
    });
    if (serialConflicts.length > 0) {
      return withCors(
        req,
        NextResponse.json({ error: formatSerialConflictError(serialConflicts) }, { status: 409 }),
      );
    }

    if (brandId && modelCode) {
      const incomplete = await findIncompleteDeliveredInstanceForModel(supabase, {
        brandId,
        modelCode,
      });
      if (incomplete) {
        return withCors(
          req,
          NextResponse.json(
            {
              error: `Има незавършена доставена бройка за този модел („${incomplete.name}“). Попълнете серийните номера, фактурата и датата преди нова доставка.`,
            },
            { status: 409 },
          ),
        );
      }
    }
  } catch (e) {
    return withCors(req, NextResponse.json({ error: String((e as Error).message) }, { status: 500 }));
  }

  const agreedFromOrder =
    typeof orderRow.unit_price === "number" && Number.isFinite(orderRow.unit_price) && orderRow.unit_price >= 0
      ? orderRow.unit_price
      : null;
  const purchasePrice = parsedBody.data.purchasePrice;

  const { data: newProduct, error: prodErr } = await supabase
    .from("products")
    .insert({
      name: tpl.name,
      slug: null,
      description: tpl.description ?? null,
      price: agreedFromOrder != null ? agreedFromOrder : Number(tpl.price ?? 0),
      price_with_mount: tpl.price_with_mount ?? null,
      purchase_price: purchasePrice,
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
      indoor_unit_serial: delivery.indoorUnitSerial,
      outdoor_unit_serial: delivery.outdoorUnitSerial,
      supplier_invoice_number: delivery.supplierInvoiceNumber,
      purchased_at: delivery.purchasedAt,
      supplier_order_work_item_id: id,
    })
    .select("id, name")
    .single();

  if (prodErr) return withCors(req, NextResponse.json({ error: prodErr.message }, { status: 500 }));

  const newProductId = (newProduct as { id: string }).id;

  const { error: updateErr } = await supabase
    .from("work_items")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      purchase_price: purchasePrice,
    })
    .eq("id", id);

  if (updateErr) {
    await supabase.from("products").delete().eq("id", newProductId);
    return withCors(req, NextResponse.json({ error: updateErr.message }, { status: 500 }));
  }

  await logAdminActivity({
    action: "supplier_order.fulfill",
    entityType: "supplier_order",
    entityId: id,
    details: {
      productInstanceId: newProductId,
      productId: orderRow.product_id,
      client_name: orderRow.customer_name,
    },
  });

  return withCors(
    req,
    NextResponse.json({ data: { productInstanceId: newProductId } }, { status: 201 }),
  );
}
