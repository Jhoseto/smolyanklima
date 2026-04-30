import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAdminActivity } from "@/lib/admin/audit";

const QuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  q: z.string().optional(),
  eventCode: z
    .enum([
      "item_added",
      "item_removed",
      "sale",
      "service_installation",
      "service_inspection",
      "service_repair",
      "service_maintenance",
    ])
    .optional(),
  type: z.enum(["sale", "service", "stock_in", "stock_out", "task"]).optional(),
  status: z.enum(["planned", "in_progress", "done", "cancelled"]).optional(),
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
  inquiryId: z.string().uuid().optional().nullable(),
  customerName: z.string().max(160).optional().nullable(),
  customerPhone: z.string().max(80).optional().nullable(),
  customerAddress: z.string().max(500).optional().nullable(),
  assignedTo: z.string().uuid().optional().nullable(),
  eventCode: z
    .enum([
      "item_added",
      "item_removed",
      "sale",
      "service_installation",
      "service_inspection",
      "service_repair",
      "service_maintenance",
    ])
    .optional()
    .nullable(),
  quantity: z.number().int().positive().optional().default(1),
  unitPrice: z.number().nonnegative().optional().nullable(),
  totalAmount: z.number().nonnegative().optional().nullable(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const { from, to, q, eventCode, type, status, page, perPage } = parsed.data;
  const supabase = await adminDb();
  let query = supabase
    .from("work_items")
    .select("id,type,event_code,status,priority,title,notes,due_date,scheduled_start,scheduled_end,product_id,inquiry_id,customer_name,customer_phone,customer_address,quantity,unit_price,total_amount,assigned_to,completed_at,created_at,products:product_id(id,slug,name)", {
      count: "exact",
    })
    .order("due_date", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (q?.trim()) {
    query = query.or(
      `title.ilike.%${q.trim()}%,customer_name.ilike.%${q.trim()}%,customer_phone.ilike.%${q.trim()}%,customer_address.ilike.%${q.trim()}%`,
    );
  }
  if (eventCode) query = query.eq("event_code", eventCode);
  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("due_date", from);
  if (to) query = query.lte("due_date", to);

  const offset = (page - 1) * perPage;
  const toRow = offset + perPage - 1;
  const { data, error, count } = await query.range(offset, toRow);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [], meta: { page, perPage, total: count ?? 0 } }));
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const supabase = await adminDb();
  const anon = await createSupabaseServerClient();
  const {
    data: { user },
  } = await anon.auth.getUser();

  const payload = {
    type: parsed.data.type,
    title: parsed.data.title.trim(),
    notes: parsed.data.notes ?? null,
    status: parsed.data.status,
    priority: parsed.data.priority,
    due_date: parsed.data.dueDate || null,
    scheduled_start: parsed.data.scheduledStart || null,
    scheduled_end: parsed.data.scheduledEnd || null,
    product_id: parsed.data.productId ?? null,
    inquiry_id: parsed.data.inquiryId ?? null,
    customer_name: parsed.data.customerName ?? null,
    customer_phone: parsed.data.customerPhone ?? null,
    customer_address: parsed.data.customerAddress ?? null,
    assigned_to: parsed.data.assignedTo ?? null,
    event_code: parsed.data.eventCode ?? null,
    quantity: parsed.data.quantity,
    unit_price: parsed.data.unitPrice ?? null,
    total_amount: parsed.data.totalAmount ?? null,
    created_by: user?.id ?? null,
  };

  const { data, error } = await supabase.from("work_items").insert(payload).select("*").single();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  await logAdminActivity({
    action: "work_item.create",
    entityType: "work_item",
    entityId: data.id as string,
    details: {
      type: data.type,
      status: data.status,
      priority: data.priority,
      due_date: data.due_date,
    },
  });
  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}
