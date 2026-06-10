import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { createProductInstanceFromTemplate } from "@/lib/admin/createProductInstanceFromTemplate";
import {
  findIncompleteDeliveredInstanceForModel,
  trimDeliveryFields,
  validateDeliveryFieldsForOrderFulfill,
} from "@/lib/admin/productDeliveryValidation";
import { logAdminActivity } from "@/lib/admin/audit";
import { insertProductCatalogStockCalendarEvent } from "@/lib/admin/productCatalogWorkItems";
import { copyProductChildrenFromTemplate } from "@/lib/admin/syncProductChildren";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const FulfillBodySchema = z.object({
  indoorUnitSerial: z.string().max(200).optional().nullable(),
  outdoorUnitSerial: z.string().max(200).optional().nullable(),
  supplierInvoiceNumber: z.string().max(120).optional().nullable(),
  purchasedAt: z.string().min(1).max(32),
  purchasePrice: z.number().nonnegative(),
});

/**
 * POST /api/admin/supplier-orders/[id]/fulfill
 *
 * Маркира поръчката като доставена и създава складова инстанция при попълнена
 * дата на доставка и доставна цена. Серийните номера и фактурата са по избор.
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
          error: "Попълнете датата на доставка и доставната цена преди да отбележите доставката.",
        },
        { status: 400 },
      ),
    );
  }

  const delivery = trimDeliveryFields(parsedBody.data);
  const deliveryErr = validateDeliveryFieldsForOrderFulfill(delivery);
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
              error: `Има незавършена доставена бройка за този модел („${incomplete.name}“). Попълнете датата и доставната цена преди нова доставка.`,
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
  const templateProductId = orderRow.product_id;

  let newProductId: string;
  let newProductName: string;
  try {
    const created = await createProductInstanceFromTemplate(supabase, tpl, {
      delivery,
      purchasePrice,
      supplierOrderWorkItemId: id,
      priceOverride: agreedFromOrder,
      requireFullDelivery: false,
    });
    newProductId = created.id;
    newProductName = created.name;

    const childErr = await copyProductChildrenFromTemplate(supabase, templateProductId, newProductId);
    if (childErr) {
      await supabase.from("products").delete().eq("id", newProductId);
      return withCors(req, NextResponse.json({ error: childErr }, { status: 500 }));
    }
  } catch (e) {
    const message = String((e as Error).message);
    const status = message.includes("Сериен номер") ? 409 : 400;
    return withCors(req, NextResponse.json({ error: message }, { status }));
  }

  const { error: updateErr } = await supabase
    .from("work_items")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      purchase_price: purchasePrice,
      product_id: newProductId,
    })
    .eq("id", id);

  if (updateErr) {
    await supabase.from("products").delete().eq("id", newProductId);
    return withCors(req, NextResponse.json({ error: updateErr.message }, { status: 500 }));
  }

  await insertProductCatalogStockCalendarEvent(supabase, {
    kind: "added",
    productId: newProductId,
    productName: newProductName,
    createdBy: session.userId,
  });

  await logAdminActivity({
    action: "supplier_order.fulfill",
    entityType: "supplier_order",
    entityId: id,
    details: {
      productInstanceId: newProductId,
      productId: templateProductId,
      client_name: orderRow.customer_name,
    },
  });

  return withCors(
    req,
    NextResponse.json({ data: { productInstanceId: newProductId } }, { status: 201 }),
  );
}
