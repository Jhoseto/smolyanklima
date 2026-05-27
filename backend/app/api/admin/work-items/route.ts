import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb, adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { ensureAcceptanceProtocolForInstallation } from "@/lib/admin/acceptanceProtocolFromInstall";
import { syncConsultationContactFollowUp } from "@/lib/work-items/consultation-contact";

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

const QuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  eventCode: z.enum(WORK_ITEM_EVENT_CODES).optional(),
  type: z.enum(["sale", "service", "stock_in", "stock_out", "task"]).optional(),
  status: z.enum(["planned", "in_progress", "done", "cancelled"]).optional(),
  /** Филтър за панела „Продажби“: чака монтаж / завършен. */
  saleInstallState: z.enum(["pending_mount", "completed"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(500).optional().default(200),
});

const BodySchema = z.object({
  type: z.enum(["sale", "service", "stock_in", "stock_out", "task"]),
  title: z.string().min(2).max(240),
  notes: z.string().max(8000).optional().nullable(),
  status: z.enum(["planned", "in_progress", "done", "cancelled"]).optional().default("planned"),
  priority: z.enum(["low", "medium", "high"]).optional().default("medium"),
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
  eventCode: z.enum(WORK_ITEM_EVENT_CODES).optional().nullable(),
  quantity: z.number().int().positive().optional().default(1),
  unitPrice: z.number().nonnegative().optional().nullable(),
  totalAmount: z.number().nonnegative().optional().nullable(),
  saleInstallState: z.enum(["pending_mount", "completed"]).optional().nullable(),
  installationWorkItemId: z.string().uuid().optional().nullable(),
  saleWorkItemId: z.string().uuid().optional().nullable(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const { from, to, q, eventCode, type, status, saleInstallState, page, perPage } = parsed.data;
  const supabase = await adminDb();
  let query = supabase
    .from("work_items")
    .select(
      "id,type,event_code,status,priority,title,notes,due_date,scheduled_start,scheduled_end,product_id,contact_id,inquiry_id,customer_name,customer_phone,customer_address,quantity,unit_price,total_amount,assigned_to,completed_at,created_at,cancel_reason,sale_install_state,installation_work_item_id,sale_work_item_id,products:product_id(id,slug,name,model_code,price,product_condition,brands:brand_id(name)),contacts:contact_id(id,full_name,phone,email,address)",
      {
      count: "exact",
    },
    );

  // Панел „История на продажбите“ — най-новите (по дата на запис / монтаж) отгоре.
  if (eventCode === "sale") {
    query = query
      .order("created_at", { ascending: false, nullsFirst: false })
      .order("due_date", { ascending: false, nullsFirst: true });
  } else {
    query = query
      .order("due_date", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false });
  }

  if (q?.trim()) {
    query = query.or(
      `title.ilike.%${q.trim()}%,customer_name.ilike.%${q.trim()}%,customer_phone.ilike.%${q.trim()}%,customer_address.ilike.%${q.trim()}%`,
    );
  }
  if (eventCode) query = query.eq("event_code", eventCode);
  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);
  if (saleInstallState) query = query.eq("sale_install_state", saleInstallState);
  if (from) query = query.gte("due_date", from);
  if (to) query = query.lte("due_date", to);

  const offset = (page - 1) * perPage;
  const toRow = offset + perPage - 1;
  const { data, error, count } = await query.range(offset, toRow);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [], meta: { page, perPage, total: count ?? 0 } }));
}

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
    return withCors(req, NextResponse.json({ error: "Сервизните акаунти могат само да преглеждат календара." }, { status: 403 }));
  }

  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const isSaleWorkItem = parsed.data.type === "sale" || parsed.data.eventCode === "sale";
  if (isSaleWorkItem) {
    const fromProductSaleFlow =
      Boolean(parsed.data.productId) &&
      (parsed.data.saleInstallState === "pending_mount" || parsed.data.saleInstallState === "completed");
    if (!fromProductSaleFlow) {
      return withCors(
        req,
        NextResponse.json(
          {
            error:
              "Продажбите се създават от панела „Продажби“ (каталог → бутон „Продажба“), не като ръчно събитие в календара.",
          },
          { status: 400 },
        ),
      );
    }
  }

  if (parsed.data.eventCode === "item_added" || parsed.data.eventCode === "item_removed") {
    return withCors(
      req,
      NextResponse.json(
        {
          error:
            "Добавянето и премахването на продукт в календара се записват автоматично при нов продукт или изтриване от каталога.",
        },
        { status: 400 },
      ),
    );
  }

  const supabase = session.db;

  const payload: Record<string, unknown> = {
    type: parsed.data.type,
    title: parsed.data.title.trim(),
    notes: parsed.data.notes ?? null,
    status: parsed.data.status,
    priority: parsed.data.priority,
    due_date: parsed.data.dueDate || null,
    scheduled_start: parsed.data.scheduledStart || null,
    scheduled_end: parsed.data.scheduledEnd || null,
    product_id: parsed.data.productId ?? null,
    contact_id: parsed.data.contactId ?? null,
    inquiry_id: parsed.data.inquiryId ?? null,
    customer_name: parsed.data.customerName ?? null,
    customer_phone: parsed.data.customerPhone ?? null,
    customer_address: parsed.data.customerAddress ?? null,
    assigned_to: parsed.data.assignedTo ?? null,
    event_code: parsed.data.eventCode ?? null,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unitPrice ?? null,
    total_amount: parsed.data.totalAmount ?? null,
    created_by: session.userId,
  };
  if (parsed.data.saleInstallState !== undefined) {
    payload.sale_install_state = parsed.data.saleInstallState;
  }
  if (parsed.data.installationWorkItemId !== undefined) {
    payload.installation_work_item_id = parsed.data.installationWorkItemId;
  }
  if (parsed.data.saleWorkItemId !== undefined) {
    payload.sale_work_item_id = parsed.data.saleWorkItemId;
  }
  if (parsed.data.status === "done") {
    payload.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase.from("work_items").insert(payload).select("*").single();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  await syncConsultationContactFollowUp(supabase, {
    contactId: parsed.data.contactId,
    dueDate: parsed.data.dueDate,
    status: parsed.data.status,
    eventCode: parsed.data.eventCode,
  });

  await logAdminActivity({
    action: "work_item.create",
    entityType: "work_item",
    entityId: data.id as string,
    details: {
      type: data.type,
      event_code: data.event_code ?? null,
      title: data.title ?? null,
      customer_name: data.customer_name ?? null,
      status: data.status,
      priority: data.priority,
      due_date: data.due_date,
      sale_install_state: data.sale_install_state ?? null,
    },
  });

  const created = data as {
    id: string;
    event_code?: string | null;
    sale_work_item_id?: string | null;
  };

  let linkedProtocol = null;
  let protocolWarning: string | null = null;
  if (created.event_code === "service_installation" && created.sale_work_item_id) {
    try {
      linkedProtocol = await ensureAcceptanceProtocolForInstallation(supabase, created.id, session.userId);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      protocolWarning = message;
      console.error("[work-items POST] acceptance protocol create failed:", message);
    }
  }

  return withCors(
    req,
    NextResponse.json(
      {
        data,
        ...(linkedProtocol ? { linked_protocol: linkedProtocol } : {}),
        ...(protocolWarning ? { protocol_warning: protocolWarning } : {}),
      },
      { status: 201 },
    ),
  );
}
