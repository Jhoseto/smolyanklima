import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

const UpdateSchema = z.object({
  type: z.enum(["sale", "service", "stock_in", "stock_out", "task"]).optional(),
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
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

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
  if (parsed.data.status === "done") patch.completed_at = new Date().toISOString();
  if (parsed.data.status && parsed.data.status !== "done") patch.completed_at = null;

  const supabase = await adminDb();
  const { data, error } = await supabase.from("work_items").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Не е намерено" }, { status: 404 }));
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
  const { id } = await ctx.params;
  const supabase = await adminDb();
  const { error } = await supabase.from("work_items").delete().eq("id", id);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  await logAdminActivity({
    action: "work_item.delete",
    entityType: "work_item",
    entityId: id,
  });
  return withCors(req, NextResponse.json({ ok: true }));
}
