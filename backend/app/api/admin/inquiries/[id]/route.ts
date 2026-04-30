import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

const UpdateSchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assignedTo: z.string().uuid().nullable().optional(),
  adminNotes: z.string().max(8000).nullable().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("inquiries")
    .select(
      "id,source,customer_name,customer_phone,customer_email,message,product_id,service_type,status,priority,assigned_to,admin_notes,created_at,updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Не е намерено" }, { status: 404 }));
  return withCors(req, NextResponse.json({ data }));
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const patch: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) patch.status = parsed.data.status;
  if (parsed.data.priority !== undefined) patch.priority = parsed.data.priority;
  if (parsed.data.assignedTo !== undefined) patch.assigned_to = parsed.data.assignedTo;
  if (parsed.data.adminNotes !== undefined) patch.admin_notes = parsed.data.adminNotes;

  const supabase = await adminDb();
  const { data, error } = await supabase
    .from("inquiries")
    .update(patch)
    .eq("id", id)
    .select("id,status,priority,assigned_to,admin_notes")
    .maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Не е намерено" }, { status: 404 }));
  return withCors(req, NextResponse.json({ data }));
}

