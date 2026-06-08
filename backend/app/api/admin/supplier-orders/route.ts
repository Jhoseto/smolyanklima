import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { adminLocalDateKey } from "@/lib/admin/localDateKey";
import { logAdminActivity } from "@/lib/admin/audit";
import {
  attachDeliveredProductsToOrders,
  normalizeSupplierOrderRow,
  supplierOrderSelect,
} from "@/lib/admin/supplierOrderRow";
import { buildAdminSearchOrFilter } from "@/lib/admin/phoneSearchPattern";
import { parseOrderPhaseCsv } from "@/lib/admin/supplierOrdersQueryFilters";
import { normalizeSupplierKey, supplierNameMatchesKey } from "@/lib/admin/supplierNameNormalize";
import { recordManualDelivery, recordSupplierOrderFromProduct } from "@/lib/admin/recordManualDelivery";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const ListQuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["planned", "in_progress", "done", "cancelled"]).optional(),
  /** CSV: ordered, delivered, cancelled */
  orderPhase: z.string().optional(),
  /** @deprecated използвайте orderPhase */
  phase: z.enum(["ordered", "delivered", "cancelled", "active", "all"]).optional(),
  productCondition: z.enum(["new", "used"]).optional(),
  productRegion: z.enum(["europe", "japan"]).optional(),
  brandId: z.string().uuid().optional(),
  supplierKey: z.string().max(160).optional(),
  hasSupplierInvoice: z.enum(["yes", "no"]).optional(),
  hasPurchasePrice: z.enum(["yes", "no"]).optional(),
  amountMin: z.coerce.number().nonnegative().optional(),
  amountMax: z.coerce.number().nonnegative().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
  sortBy: z
    .enum([
      "product",
      "status",
      "customer_name",
      "customer_phone",
      "customer_address",
      "purchase_price",
      "total_amount",
      "order_date",
      "created_at",
    ])
    .optional(),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
});

async function supplierContactIdsForKey(supabase: SupabaseClient, key: string): Promise<string[]> {
  const { data } = await supabase.from("contacts").select("id, full_name").eq("kind", "supplier");
  return (data ?? [])
    .filter((c) => supplierNameMatchesKey(String((c as { full_name?: string }).full_name ?? ""), key))
    .map((c) => String((c as { id: string }).id));
}

async function deliveredOrderIdsWithInvoice(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("products")
    .select("supplier_order_work_item_id")
    .not("supplier_order_work_item_id", "is", null)
    .not("supplier_invoice_number", "is", null)
    .neq("supplier_invoice_number", "")
    .limit(5000);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const id = (row as { supplier_order_work_item_id?: string | null }).supplier_order_work_item_id;
    if (id) ids.add(id);
  }
  return [...ids];
}

async function deliveredOrderIdsWithPurchase(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase
    .from("products")
    .select("supplier_order_work_item_id")
    .not("supplier_order_work_item_id", "is", null)
    .not("purchase_price", "is", null)
    .limit(5000);
  const ids = new Set<string>();
  for (const row of data ?? []) {
    const id = (row as { supplier_order_work_item_id?: string | null }).supplier_order_work_item_id;
    if (id) ids.add(id);
  }
  return [...ids];
}

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
  const historyMode = parsed.data.page != null || req.nextUrl.searchParams.has("phase") || req.nextUrl.searchParams.has("orderPhase");

  if (!historyMode) {
    const { data, error } = await supabase
      .from("work_items")
      .select(supplierOrderSelect(false))
      .eq("event_code", "supplier_order")
      .neq("status", "done")
      .neq("status", "cancelled")
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

    const rows = (data ?? []).map((row) => normalizeSupplierOrderRow(row as unknown as Record<string, unknown>));
    return withCors(req, NextResponse.json({ data: rows }));
  }

  const {
    q,
    status,
    orderPhase,
    phase,
    productCondition,
    productRegion,
    brandId,
    supplierKey,
    hasSupplierInvoice,
    hasPurchasePrice,
    amountMin,
    amountMax,
    from,
    to,
    page = 1,
    perPage = 30,
    sortBy,
    sortDir,
  } = parsed.data;

  const orderPhases = parseOrderPhaseCsv(orderPhase);
  const ascending = sortDir === "asc";
  const needsProductInner = Boolean(brandId || productRegion || supplierKey || hasPurchasePrice);
  const selectFields = supplierOrderSelect(needsProductInner);

  let supplierIds: string[] | null = null;
  if (supplierKey?.trim()) {
    supplierIds = await supplierContactIdsForKey(supabase, normalizeSupplierKey(supplierKey));
    if (supplierIds.length === 0) {
      return withCors(req, NextResponse.json({ data: [], meta: { page, perPage, total: 0 } }));
    }
  }

  let query = supabase
    .from("work_items")
    .select(selectFields, { count: "exact" })
    .eq("event_code", "supplier_order");

  if (sortBy) {
    switch (sortBy) {
      case "product":
        query = query.order("name", { ascending, foreignTable: "products", nullsFirst: ascending });
        break;
      case "status":
        query = query.order("status", { ascending, nullsFirst: ascending });
        break;
      case "customer_name":
        query = query.order("customer_name", { ascending, nullsFirst: ascending });
        break;
      case "customer_phone":
        query = query.order("customer_phone", { ascending, nullsFirst: ascending });
        break;
      case "customer_address":
        query = query.order("customer_address", { ascending, nullsFirst: ascending });
        break;
      case "purchase_price":
        query = query.order("purchase_price", { ascending, foreignTable: "products", nullsFirst: ascending });
        break;
      case "total_amount":
        query = query.order("unit_price", { ascending, nullsFirst: ascending });
        break;
      case "order_date":
        query = query
          .order("due_date", { ascending, nullsFirst: ascending })
          .order("completed_at", { ascending, nullsFirst: ascending });
        break;
      case "created_at":
        query = query.order("created_at", { ascending, nullsFirst: ascending });
        break;
    }
  } else {
    query = query
      .order("due_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });
  }

  if (q?.trim()) {
    const orFilter = buildAdminSearchOrFilter(q, {
      textFields: ["title", "notes", "customer_name", "customer_phone", "customer_address"],
      phoneFields: ["customer_phone"],
    });
    if (orFilter) query = query.or(orFilter);
  }

  if (status) query = query.eq("status", status);
  else if (orderPhases.length > 0) {
    const orParts: string[] = [];
    if (orderPhases.includes("ordered")) orParts.push("status.in.(planned,in_progress)");
    if (orderPhases.includes("delivered")) orParts.push("status.eq.done");
    if (orderPhases.includes("cancelled")) orParts.push("status.eq.cancelled");
    if (orParts.length > 0) query = query.or(orParts.join(","));
  } else if (phase === "ordered" || phase === "active") {
    query = query.in("status", ["planned", "in_progress"]);
  } else if (phase === "delivered") {
    query = query.eq("status", "done");
  } else if (phase === "cancelled") {
    query = query.eq("status", "cancelled");
  }

  if (productCondition) query = query.eq("order_product_condition", productCondition);
  if (brandId) query = query.eq("products.brand_id", brandId);
  if (productRegion) query = query.eq("products.product_region", productRegion);

  if (supplierIds && supplierIds.length > 0) {
    query = query.in("products.supplier_id", supplierIds);
  }

  if (hasSupplierInvoice === "yes" || hasSupplierInvoice === "no") {
    const withInvoice = await deliveredOrderIdsWithInvoice(supabase);
    if (hasSupplierInvoice === "yes") {
      if (withInvoice.length === 0) {
        return withCors(req, NextResponse.json({ data: [], meta: { page, perPage, total: 0 } }));
      }
      query = query.in("id", withInvoice);
    } else if (withInvoice.length > 0) {
      query = query.not("id", "in", `(${withInvoice.join(",")})`);
    }
  }

  if (hasPurchasePrice === "yes") {
    const deliveredWithPurchase = await deliveredOrderIdsWithPurchase(supabase);
    if (deliveredWithPurchase.length > 0) {
      query = query.or(`products.purchase_price.not.is.null,id.in.(${deliveredWithPurchase.join(",")})`);
    } else {
      query = query.not("products.purchase_price", "is", null);
    }
  } else if (hasPurchasePrice === "no") {
    const deliveredWithPurchase = await deliveredOrderIdsWithPurchase(supabase);
    query = query.or("products.purchase_price.is.null,products.purchase_price.eq.");
    if (deliveredWithPurchase.length > 0) {
      query = query.not("id", "in", `(${deliveredWithPurchase.join(",")})`);
    }
  }

  if (amountMin != null) query = query.gte("unit_price", amountMin);
  if (amountMax != null) query = query.lte("unit_price", amountMax);
  if (from) query = query.gte("due_date", from);
  if (to) query = query.lte("due_date", to);

  const offset = (page - 1) * perPage;
  const { data, error, count } = await query.range(offset, offset + perPage - 1);

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  let rows = (data ?? []).map((row) => normalizeSupplierOrderRow(row as unknown as Record<string, unknown>));

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
    manualHistoryDelivery,
  } = json as Record<string, unknown>;

  const supabase = session.db;

  if (manualHistoryDelivery === true) {
    const productCondition =
      json.productCondition === "used" || json.productCondition === "new" ? json.productCondition : "new";
    const productRegion =
      json.productRegion === "japan" || json.productRegion === "europe" ? json.productRegion : null;
    const purchasePrice =
      typeof json.purchasePrice === "number" && Number.isFinite(json.purchasePrice) ? json.purchasePrice : null;
    const agreed =
      typeof agreedPrice === "number" && Number.isFinite(agreedPrice)
        ? agreedPrice
        : typeof json.agreedPrice === "number" && Number.isFinite(json.agreedPrice)
          ? json.agreedPrice
          : null;
    const quantity =
      typeof json.quantity === "number" && Number.isFinite(json.quantity) ? json.quantity : null;

    try {
      const result = await recordManualDelivery(supabase, {
        productId: typeof productId === "string" ? productId : null,
        productName: typeof json.productName === "string" ? json.productName : "",
        brandId: typeof json.brandId === "string" ? json.brandId : null,
        modelCode: typeof json.modelCode === "string" ? json.modelCode : null,
        productCondition,
        productRegion,
        supplierName: typeof json.supplierName === "string" ? json.supplierName : null,
        purchasePrice,
        agreedPrice: agreed,
        orderDate:
          typeof json.orderDate === "string" && json.orderDate.trim()
            ? json.orderDate.trim()
            : adminLocalDateKey(),
        quantity,
        contactId: contactId && typeof contactId === "string" ? contactId : null,
        customerName: customerName && typeof customerName === "string" ? customerName : null,
        customerPhone: customerPhone && typeof customerPhone === "string" ? customerPhone : null,
        customerAddress: customerAddress && typeof customerAddress === "string" ? customerAddress : null,
        notes: notes && typeof notes === "string" ? notes : null,
        createdBy: session.userId,
      });

      const { data: createdRow } = await supabase.from("work_items").select("*").eq("id", result.orderId).single();

      await logAdminActivity({
        action: "supplier_order.create",
        entityType: "supplier_order",
        entityId: result.orderId,
        details: {
          manual_history_delivery: true,
          customer_name: customerName && typeof customerName === "string" ? String(customerName).trim() : null,
        },
      });

      return withCors(req, NextResponse.json({ data: createdRow }, { status: 201 }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      return withCors(req, NextResponse.json({ error: message }, { status: 400 }));
    }
  }

  if (!productId || typeof productId !== "string") {
    return withCors(req, NextResponse.json({ error: "Липсва productId" }, { status: 400 }));
  }

  const customerNameTrim =
    customerName && typeof customerName === "string" ? String(customerName).trim() : "";
  const purchasePrice =
    typeof json.purchasePrice === "number" && Number.isFinite(json.purchasePrice) ? json.purchasePrice : null;
  const unitPrice =
    typeof agreedPrice === "number" && Number.isFinite(agreedPrice) && agreedPrice >= 0 ? agreedPrice : null;
  const quantity =
    typeof json.quantity === "number" && Number.isFinite(json.quantity) ? json.quantity : null;
  const orderDate =
    typeof json.orderDate === "string" && json.orderDate.trim() ? json.orderDate.trim() : adminLocalDateKey();

  try {
    const result = await recordSupplierOrderFromProduct(supabase, {
      productId,
      orderDate,
      quantity,
      purchasePrice,
      agreedPrice: unitPrice,
      supplierName: typeof json.supplierName === "string" ? json.supplierName : null,
      contactId: contactId && typeof contactId === "string" ? contactId : null,
      customerName: customerNameTrim || null,
      customerPhone: customerPhone && typeof customerPhone === "string" ? customerPhone : null,
      customerAddress: customerAddress && typeof customerAddress === "string" ? customerAddress : null,
      notes: notes && typeof notes === "string" ? notes : null,
      createdBy: session.userId,
    });

    const { data: workItem } = await supabase.from("work_items").select("*").eq("id", result.orderId).single();

    await logAdminActivity({
      action: "supplier_order.create",
      entityType: "supplier_order",
      entityId: result.orderId,
      details: {
        productId,
        customer_name: customerNameTrim || null,
        unit_price: unitPrice,
        quantity,
      },
    });

    if (customerEmail && typeof customerEmail === "string" && customerEmail.trim() && contactId && typeof contactId === "string") {
      // Optionally store email on contact — best-effort, no fatal error
    }

    return withCors(req, NextResponse.json({ data: workItem }, { status: 201 }));
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes("не е намерен") ? 404 : message.includes("По поръчка") ? 400 : 400;
    return withCors(req, NextResponse.json({ error: message }, { status }));
  }
}
