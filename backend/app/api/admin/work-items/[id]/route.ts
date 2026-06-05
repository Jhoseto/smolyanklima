import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import {
  findAcceptanceProtocolByWorkItem,
  ensureAcceptanceProtocolForInstallation,
  deleteAcceptanceProtocolForInstallation,
  syncAcceptanceProtocolFromInstallation,
} from "@/lib/admin/acceptanceProtocolFromInstall";
import {
  canRestoreStockForPendingSale,
  restoreProductStockAfterPendingSaleCancel,
} from "@/lib/admin/restoreProductStockAfterSaleCancel";
import { syncConsultationContactFollowUp } from "@/lib/work-items/consultation-contact";
import { isSaleCancelReason } from "@/lib/admin/saleCancelReason";
import { cascadeDeleteBeforeSaleWorkItem } from "@/lib/admin/deleteSaleWorkItemCascade";

const WORK_ITEM_EVENT_CODES = [
  "item_added",
  "item_removed",
  "sale",
  "service_installation",
  "service_maintenance",
  "service_on_site",
  "service_in_shop",
  "consultation",
  "supplier_order",
] as const;

const UpdateSchema = z.object({
  type: z.enum(["sale", "service", "stock_in", "stock_out", "task"]).optional(),
  eventCode: z.enum(WORK_ITEM_EVENT_CODES).nullable().optional(),
  title: z.string().min(2).max(240).optional(),
  notes: z.string().max(8000).optional().nullable(),
  status: z.enum(["planned", "in_progress", "done", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  dueDate: z.string().optional().nullable(),
  scheduledStart: z.string().optional().nullable(),
  scheduledEnd: z.string().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  inquiryId: z.string().uuid().optional().nullable(),
  customerName: z.string().max(160).optional().nullable(),
  customerPhone: z.string().max(80).optional().nullable(),
  customerAddress: z.string().max(500).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  quantity: z.number().int().positive().optional(),
  unitPrice: z.number().nonnegative().nullable().optional(),
  totalAmount: z.number().nonnegative().nullable().optional(),
  purchasePrice: z.number().nonnegative().nullable().optional(),
  saleInstallState: z.enum(["pending_mount", "completed"]).optional().nullable(),
  installationWorkItemId: z.string().uuid().optional().nullable(),
  cancelReason: z.enum(["client_declined", "staff_error"]).optional().nullable(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

const WORK_ITEM_DETAIL_SELECT = [
  "id",
  "type",
  "event_code",
  "status",
  "priority",
  "title",
  "notes",
  "due_date",
  "scheduled_start",
  "scheduled_end",
  "product_id",
  "contact_id",
  "sale_work_item_id",
  "sale_install_state",
  "installation_work_item_id",
  "customer_name",
  "customer_phone",
  "customer_address",
  "quantity",
  "unit_price",
  "total_amount",
  "purchase_price",
  "supplier_name",
  "supplier_invoice_number",
  "created_at",
  "completed_at",
  "cancel_reason",
  `products:product_id (
    id, name, slug, model_code, price, price_with_mount, purchase_price, product_condition,
    indoor_unit_serial, outdoor_unit_serial, stock_status, stock_quantity, supplier_invoice_number,
    brands:brand_id (name),
    product_types:type_id (name),
    product_images (url, is_main, sort_order)
  )`,
  `contacts:contact_id (id, full_name, phone, email, address)`,
].join(",");

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
  const { data: workItem, error } = await supabase.from("work_items").select(WORK_ITEM_DETAIL_SELECT).eq("id", id).maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!workItem) return withCors(req, NextResponse.json({ error: "Не е намерено" }, { status: 404 }));

  const saleId = (workItem as { sale_work_item_id?: string | null }).sale_work_item_id;
  const installIdFromSale = (workItem as { installation_work_item_id?: string | null }).installation_work_item_id;
  const eventCode = (workItem as { event_code?: string | null }).event_code;

  let linkedSale: Record<string, unknown> | null = null;
  if (saleId) {
    const { data: s } = await supabase
      .from("work_items")
      .select("id,title,status,sale_install_state,total_amount,unit_price,event_code,cancel_reason")
      .eq("id", saleId)
      .maybeSingle();
    linkedSale = s ?? null;
  }

  let linkedInstallation: Record<string, unknown> | null = null;
  if (eventCode === "sale" && installIdFromSale) {
    const { data: inst } = await supabase
      .from("work_items")
      .select("id,title,status,due_date,scheduled_start,scheduled_end,notes,completed_at")
      .eq("id", installIdFromSale)
      .maybeSingle();
    linkedInstallation = inst ?? null;
  }

  let linkedProtocol = null;
  const protocolWorkItemId =
    eventCode === "service_installation" ? id : eventCode === "sale" ? installIdFromSale : null;
  if (protocolWorkItemId) {
    try {
      linkedProtocol = await findAcceptanceProtocolByWorkItem(supabase, protocolWorkItemId);
      if (!linkedProtocol) {
        linkedProtocol = await ensureAcceptanceProtocolForInstallation(
          supabase,
          protocolWorkItemId,
          session.userId,
        );
      }
    } catch (e: unknown) {
      console.error(
        "[work-items GET] acceptance protocol lookup/create failed:",
        e instanceof Error ? e.message : e,
      );
      linkedProtocol = null;
    }
  }

  return withCors(
    req,
    NextResponse.json({
      data: {
        work_item: workItem,
        linked_sale: linkedSale,
        linked_installation: linkedInstallation,
        linked_protocol: linkedProtocol,
      },
    }),
  );
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Сервизните акаунти могат само да преглеждат календара." }, { status: 403 }));
  }

  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const supabase = session.db;

  const { data: beforeRow, error: beforeErr } = await supabase
    .from("work_items")
    .select("id,type,installation_work_item_id,sale_work_item_id,event_code,sale_install_state,status,title,due_date,customer_name,customer_phone,customer_address,product_id,contact_id,quantity")
    .eq("id", id)
    .maybeSingle();
  if (beforeErr) return withCors(req, NextResponse.json({ error: beforeErr.message }, { status: 500 }));
  if (!beforeRow) return withCors(req, NextResponse.json({ error: "Не е намерено" }, { status: 404 }));

  const br = beforeRow as {
    id: string;
    type?: string | null;
    installation_work_item_id?: string | null;
    sale_work_item_id?: string | null;
    event_code?: string | null;
    sale_install_state?: string | null;
    status?: string;
    title?: string | null;
    due_date?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_address?: string | null;
    product_id?: string | null;
    contact_id?: string | null;
    quantity?: number | null;
  };
  const installId = br.installation_work_item_id ?? null;
  const isInstallationRow = br.event_code === "service_installation";

  const markSaleCancelled =
    parsed.data.status === "cancelled" &&
    br.event_code === "sale" &&
    br.status !== "cancelled";

  const markInstallCancelled =
    parsed.data.status === "cancelled" &&
    br.event_code === "service_installation" &&
    br.status !== "cancelled";

  const saleDeniedMsg =
    "Продажбите се създават от панела „Продажби“ (каталог → „Продажба“), не чрез смяна на тип в календара.";
  if (parsed.data.eventCode === "sale" && br.event_code !== "sale") {
    return withCors(req, NextResponse.json({ error: saleDeniedMsg }, { status: 400 }));
  }
  if (parsed.data.type === "sale" && br.type !== "sale") {
    return withCors(req, NextResponse.json({ error: saleDeniedMsg }, { status: 400 }));
  }

  if (parsed.data.eventCode === "item_added" || parsed.data.eventCode === "item_removed") {
    return withCors(
      req,
      NextResponse.json(
        {
          error:
            "Типовете „добавяне/премахване на продукт“ се задават само от каталога с продукти, не ръчно.",
        },
        { status: 400 },
      ),
    );
  }
  if (
    (br.event_code === "item_added" || br.event_code === "item_removed") &&
    parsed.data.eventCode !== undefined &&
    String(parsed.data.eventCode) !== String(br.event_code)
  ) {
    return withCors(
      req,
      NextResponse.json(
        { error: "Не може да се сменя типът на автоматично складово събитие от каталога." },
        { status: 400 },
      ),
    );
  }
  if (
    (br.event_code === "item_added" || br.event_code === "item_removed") &&
    parsed.data.type !== undefined &&
    parsed.data.type !== br.type
  ) {
    return withCors(
      req,
      NextResponse.json(
        { error: "Не може да се сменя видът (stock) на автоматично събитие от каталога." },
        { status: 400 },
      ),
    );
  }

  if (markSaleCancelled && br.sale_install_state === "completed") {
    return withCors(req, NextResponse.json({ error: "Завършена продажба не може да се отмени от тук." }, { status: 400 }));
  }
  if (markSaleCancelled && br.sale_install_state !== "pending_mount") {
    return withCors(
      req,
      NextResponse.json({ error: "Отказ е възможен само когато монтажът е в статус „чака монтаж“." }, { status: 400 }),
    );
  }
  if (markSaleCancelled) {
    const reason = parsed.data.cancelReason;
    if (!reason || !isSaleCancelReason(reason)) {
      return withCors(
        req,
        NextResponse.json({ error: "Посочете причина за отказ: отказ от клиент или лична грешка." }, { status: 400 }),
      );
    }
  }

  if (markInstallCancelled && br.sale_work_item_id) {
    const { data: linkedSaleBefore } = await supabase
      .from("work_items")
      .select("id,sale_install_state,status")
      .eq("id", br.sale_work_item_id)
      .maybeSingle();
    if (linkedSaleBefore?.sale_install_state === "completed") {
      return withCors(
        req,
        NextResponse.json({ error: "Завършен монтаж/продажба не може да се отмени от календара." }, { status: 400 }),
      );
    }
  }

  const markMountCompletePreview =
    !markSaleCancelled &&
    (parsed.data.saleInstallState === "completed" ||
      (parsed.data.status === "done" && br.event_code === "sale"));

  const saleHistoryFieldEdit =
    br.event_code === "sale" &&
    !markSaleCancelled &&
    !markMountCompletePreview &&
    parsed.data.status === undefined &&
    parsed.data.saleInstallState === undefined &&
    (parsed.data.customerName !== undefined ||
      parsed.data.customerPhone !== undefined ||
      parsed.data.customerAddress !== undefined ||
      parsed.data.purchasePrice !== undefined ||
      parsed.data.totalAmount !== undefined ||
      parsed.data.unitPrice !== undefined ||
      parsed.data.dueDate !== undefined ||
      parsed.data.notes !== undefined);

  if (saleHistoryFieldEdit && session.role !== "master_admin") {
    return withCors(
      req,
      NextResponse.json({ error: "Само главният администратор може да редактира записи в историята на продажбите." }, { status: 403 }),
    );
  }

  const patch: Record<string, unknown> = {};
  if (parsed.data.type !== undefined) patch.type = parsed.data.type;
  if (parsed.data.eventCode !== undefined) patch.event_code = parsed.data.eventCode;
  if (parsed.data.title !== undefined) patch.title = parsed.data.title.trim();
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes;
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority;
  if (parsed.data.dueDate !== undefined) patch.due_date = parsed.data.dueDate || null;
  if (parsed.data.scheduledStart !== undefined) patch.scheduled_start = parsed.data.scheduledStart || null;
  if (parsed.data.scheduledEnd !== undefined) patch.scheduled_end = parsed.data.scheduledEnd || null;
  if (parsed.data.productId !== undefined) patch.product_id = parsed.data.productId ?? null;
  if (parsed.data.contactId !== undefined) patch.contact_id = parsed.data.contactId ?? null;
  if (parsed.data.inquiryId !== undefined) patch.inquiry_id = parsed.data.inquiryId ?? null;
  if (parsed.data.customerName !== undefined) patch.customer_name = parsed.data.customerName ?? null;
  if (parsed.data.customerPhone !== undefined) patch.customer_phone = parsed.data.customerPhone ?? null;
  if (parsed.data.customerAddress !== undefined) patch.customer_address = parsed.data.customerAddress ?? null;
  if (parsed.data.assignedTo !== undefined) patch.assigned_to = parsed.data.assignedTo ?? null;
  if (parsed.data.quantity !== undefined) patch.quantity = parsed.data.quantity;
  if (parsed.data.unitPrice !== undefined) patch.unit_price = parsed.data.unitPrice;
  if (parsed.data.totalAmount !== undefined) patch.total_amount = parsed.data.totalAmount;
  if (parsed.data.purchasePrice !== undefined) patch.purchase_price = parsed.data.purchasePrice;
  if (parsed.data.saleInstallState !== undefined) patch.sale_install_state = parsed.data.saleInstallState;
  if (parsed.data.installationWorkItemId !== undefined) {
    patch.installation_work_item_id = parsed.data.installationWorkItemId;
  }

  const saleDateChanged =
    br.event_code === "sale" &&
    parsed.data.dueDate !== undefined &&
    parsed.data.dueDate &&
    parsed.data.dueDate !== br.due_date;

  if (saleDateChanged && (br.status === "done" || br.sale_install_state === "completed")) {
    const d = parsed.data.dueDate!.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      patch.completed_at = new Date(`${d}T10:00:00.000Z`).toISOString();
    }
  }

  if (parsed.data.status === "done") patch.completed_at = new Date().toISOString();
  if (parsed.data.status && parsed.data.status !== "done") patch.completed_at = null;

  if (markSaleCancelled) {
    patch.status = "cancelled";
    patch.completed_at = null;
    patch.sale_install_state = null;
    patch.cancel_reason = parsed.data.cancelReason ?? null;
  }

  const markMountComplete =
    !markSaleCancelled &&
    (parsed.data.saleInstallState === "completed" ||
      (parsed.data.status === "done" && br.event_code === "sale"));

  if (markMountComplete && br.event_code === "sale") {
    patch.sale_install_state = "completed";
    patch.status = "done";
    patch.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from("work_items").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Не е намерено" }, { status: 404 }));

  if (markMountComplete && installId) {
    const now = new Date().toISOString();
    const { error: instErr } = await supabase
      .from("work_items")
      .update({ status: "done", completed_at: now })
      .eq("id", installId);
    if (instErr) {
      return withCors(req, NextResponse.json({ error: `Продажбата е обновена, но монтажът: ${instErr.message}` }, { status: 500 }));
    }
  }

  let stockRestoreTarget: { productId: string; quantity: number } | null = null;
  if (markSaleCancelled && br.product_id && canRestoreStockForPendingSale(br)) {
    stockRestoreTarget = { productId: br.product_id, quantity: br.quantity ?? 1 };
  } else if (markInstallCancelled && br.sale_work_item_id) {
    const { data: linkedSaleForStock } = await supabase
      .from("work_items")
      .select("id,product_id,quantity,sale_install_state,status")
      .eq("id", br.sale_work_item_id)
      .maybeSingle();
    if (linkedSaleForStock && canRestoreStockForPendingSale(linkedSaleForStock)) {
      const pid = (linkedSaleForStock as { product_id?: string | null }).product_id ?? br.product_id;
      if (pid) {
        stockRestoreTarget = {
          productId: pid,
          quantity: (linkedSaleForStock as { quantity?: number | null }).quantity ?? br.quantity ?? 1,
        };
      }
    }
  }

  if (markSaleCancelled && installId) {
    const { error: instCancelErr } = await supabase
      .from("work_items")
      .update({ status: "cancelled", completed_at: null })
      .eq("id", installId);
    if (instCancelErr) {
      return withCors(
        req,
        NextResponse.json({ error: `Продажбата е отказана, но монтажът: ${instCancelErr.message}` }, { status: 500 }),
      );
    }
    try {
      await deleteAcceptanceProtocolForInstallation(supabase, installId, "sale_cancelled");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[work-items PUT] acceptance protocol delete on sale cancel failed:", message);
    }
  }

  if (markInstallCancelled && br.sale_work_item_id) {
    const { data: linkedSale } = await supabase
      .from("work_items")
      .select("id,sale_install_state,status")
      .eq("id", br.sale_work_item_id)
      .maybeSingle();
    if (linkedSale?.sale_install_state === "completed") {
      return withCors(
        req,
        NextResponse.json({ error: "Завършен монтаж/продажба не може да се отмени от календара." }, { status: 400 }),
      );
    }
    if (linkedSale && canRestoreStockForPendingSale(linkedSale)) {
      const { error: saleCancelErr } = await supabase
        .from("work_items")
        .update({ status: "cancelled", sale_install_state: null, completed_at: null })
        .eq("id", br.sale_work_item_id);
      if (saleCancelErr) {
        return withCors(
          req,
          NextResponse.json({ error: `Монтажът е отказан, но продажбата: ${saleCancelErr.message}` }, { status: 500 }),
        );
      }
    }
    try {
      await deleteAcceptanceProtocolForInstallation(supabase, id, "install_cancelled");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[work-items PUT] acceptance protocol delete on install cancel failed:", message);
    }
  }

  let restoredProductId: string | null = null;
  try {
    if (stockRestoreTarget) {
      const result = await restoreProductStockAfterPendingSaleCancel(
        supabase,
        stockRestoreTarget.productId,
        stockRestoreTarget.quantity,
      );
      if (result.restored) restoredProductId = result.productId;
    }
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return withCors(
      req,
      NextResponse.json({ error: `Задачата е отказана, но възстановяването на склада: ${message}` }, { status: 500 }),
    );
  }

  await syncConsultationContactFollowUp(supabase, {
    contactId: (parsed.data.contactId ?? data.contact_id) as string | null,
    dueDate: (parsed.data.dueDate ?? data.due_date) as string | null,
    status: String(parsed.data.status ?? data.status),
    eventCode: (parsed.data.eventCode ?? data.event_code) as string | null,
  });

  const auditOperation = markSaleCancelled
    ? "sale_cancelled"
    : markInstallCancelled
      ? "install_cancelled"
      : markMountComplete
        ? "sale_completed"
        : "update";

  await logAdminActivity({
    action: "work_item.update",
    entityType: "work_item",
    entityId: id,
    details: {
      operation: auditOperation,
      event_code: data.event_code ?? br.event_code ?? null,
      title: data.title ?? br.title ?? null,
      customer_name: data.customer_name ?? br.customer_name ?? null,
      changedFields: Object.keys(patch),
      status: data.status,
      priority: data.priority,
      due_date: data.due_date,
      sale_install_state: data.sale_install_state ?? null,
      ...(restoredProductId ? { restored_product_id: restoredProductId } : {}),
      ...(markSaleCancelled && parsed.data.cancelReason ? { cancel_reason: parsed.data.cancelReason } : {}),
    },
  });

  const protocolSyncFields = ["dueDate", "customerName", "customerPhone", "customerAddress", "productId", "contactId"] as const;
  const shouldSyncProtocol =
    isInstallationRow &&
    protocolSyncFields.some((f) => parsed.data[f] !== undefined) &&
    String(data.status ?? br.status) !== "cancelled";

  if (shouldSyncProtocol) {
    try {
      await syncAcceptanceProtocolFromInstallation(supabase, id);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[work-items PUT] acceptance protocol sync failed:", message);
    }
  }

  const linkedInstallId =
    parsed.data.installationWorkItemId !== undefined
      ? parsed.data.installationWorkItemId
      : br.event_code === "sale"
        ? (data as { installation_work_item_id?: string | null }).installation_work_item_id ?? installId
        : null;

  if (linkedInstallId && br.event_code === "sale") {
    try {
      await ensureAcceptanceProtocolForInstallation(supabase, linkedInstallId, session.userId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[work-items PUT] acceptance protocol ensure after sale link failed:", message);
    }
  }

  return withCors(req, NextResponse.json({ data }));
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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
      NextResponse.json({ error: "Само главният администратор може да изтрива събития от календара." }, { status: 403 }),
    );
  }

  const { id } = await ctx.params;
  const supabase = session.db;
  const { data: existing } = await supabase
    .from("work_items")
    .select("event_code,title,customer_name,type,installation_work_item_id,product_id,contact_id,status,sale_install_state")
    .eq("id", id)
    .maybeSingle();

  let cascadeMeta: { deletedSupplierOrderId?: string | null } = {};
  if (existing?.event_code === "sale") {
    if (existing.product_id && canRestoreStockForPendingSale(existing)) {
      return withCors(
        req,
        NextResponse.json(
          { error: "Първо откажете продажбата, за да се възстанови складът, след това я изтрийте." },
          { status: 400 },
        ),
      );
    }
    const cascade = await cascadeDeleteBeforeSaleWorkItem(supabase, {
      id,
      installation_work_item_id: existing.installation_work_item_id,
      product_id: existing.product_id,
    });
    if (cascade.error) {
      return withCors(req, NextResponse.json({ error: cascade.error }, { status: 500 }));
    }
    cascadeMeta = { deletedSupplierOrderId: cascade.deletedSupplierOrderId ?? null };
  } else if (existing?.event_code === "service_installation") {
    try {
      await deleteAcceptanceProtocolForInstallation(supabase, id, "install_cancelled");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.error("[work-items DELETE] acceptance protocol delete failed:", message);
    }
  }

  const { error } = await supabase.from("work_items").delete().eq("id", id);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  await logAdminActivity({
    action: "work_item.delete",
    entityType: "work_item",
    entityId: id,
    details: existing
      ? {
          event_code: existing.event_code ?? null,
          title: existing.title ?? null,
          customer_name: existing.customer_name ?? null,
          type: existing.type ?? null,
          ...(cascadeMeta.deletedSupplierOrderId
            ? { deleted_supplier_order_id: cascadeMeta.deletedSupplierOrderId }
            : {}),
        }
      : undefined,
  });
  return withCors(req, NextResponse.json({ ok: true }));
}
