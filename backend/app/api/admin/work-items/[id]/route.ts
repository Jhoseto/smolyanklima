import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

const UpdateSchema = z.object({
  type: z.enum(["sale", "service", "stock_in", "stock_out", "task"]).optional(),
  eventCode: z
    .enum([
      "item_added",
      "item_removed",
      "sale",
      "service_installation",
      "service_maintenance",
      "service_on_site",
      "service_in_shop",
    ])
    .nullable()
    .optional(),
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
  saleInstallState: z.enum(["pending_mount", "completed"]).optional().nullable(),
  installationWorkItemId: z.string().uuid().optional().nullable(),
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
  "created_at",
  `products:product_id (
    id, name, slug, model_code, price, price_with_mount, product_condition,
    indoor_unit_serial, outdoor_unit_serial, stock_status, stock_quantity,
    brands:brand_id (name),
    product_types:type_id (name)
  )`,
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
  let linkedSale: Record<string, unknown> | null = null;
  if (saleId) {
    const { data: s } = await supabase
      .from("work_items")
      .select("id,title,status,sale_install_state,total_amount,unit_price,event_code")
      .eq("id", saleId)
      .maybeSingle();
    linkedSale = s ?? null;
  }

  return withCors(req, NextResponse.json({ data: { work_item: workItem, linked_sale: linkedSale } }));
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
    .select("id,type,installation_work_item_id,event_code,sale_install_state,status")
    .eq("id", id)
    .maybeSingle();
  if (beforeErr) return withCors(req, NextResponse.json({ error: beforeErr.message }, { status: 500 }));
  if (!beforeRow) return withCors(req, NextResponse.json({ error: "Не е намерено" }, { status: 404 }));

  const br = beforeRow as {
    id: string;
    type?: string | null;
    installation_work_item_id?: string | null;
    event_code?: string | null;
    sale_install_state?: string | null;
    status?: string;
  };
  const installId = br.installation_work_item_id ?? null;

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

  const markSaleCancelled =
    parsed.data.status === "cancelled" && br.event_code === "sale";

  if (markSaleCancelled && br.sale_install_state === "completed") {
    return withCors(req, NextResponse.json({ error: "Завършена продажба не може да се отмени от тук." }, { status: 400 }));
  }
  if (markSaleCancelled && br.sale_install_state !== "pending_mount") {
    return withCors(
      req,
      NextResponse.json({ error: "Отказ е възможен само когато монтажът е в статус „чака монтаж“." }, { status: 400 }),
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
  if (parsed.data.saleInstallState !== undefined) patch.sale_install_state = parsed.data.saleInstallState;
  if (parsed.data.installationWorkItemId !== undefined) {
    patch.installation_work_item_id = parsed.data.installationWorkItemId;
  }

  if (parsed.data.status === "done") patch.completed_at = new Date().toISOString();
  if (parsed.data.status && parsed.data.status !== "done") patch.completed_at = null;

  if (markSaleCancelled) {
    patch.status = "cancelled";
    patch.completed_at = null;
    patch.sale_install_state = null;
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
  }
  await logAdminActivity({
    action: "work_item.update",
    entityType: "work_item",
    entityId: id,
    details: {
      changedFields: Object.keys(patch),
      status: data.status,
      priority: data.priority,
      due_date: data.due_date,
    },
  });
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
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Сервизните акаунти могат само да преглеждат календара." }, { status: 403 }));
  }

  const { id } = await ctx.params;
  const supabase = session.db;
  const { error } = await supabase.from("work_items").delete().eq("id", id);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  await logAdminActivity({
    action: "work_item.delete",
    entityType: "work_item",
    entityId: id,
  });
  return withCors(req, NextResponse.json({ ok: true }));
}
