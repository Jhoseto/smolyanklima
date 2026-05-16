import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { clearContactFollowUpWhenInquiryResolved } from "@/lib/admin/inquiry-contact-sync";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
import {
  INQUIRY_ADMIN_SELECT,
  INQUIRY_ADMIN_SELECT_BASE,
  withDefaultIncludeInstallation,
} from "@/lib/inquiry/inquiryAdminSelect";
import { attachProductsToInquiries } from "@/lib/inquiry/inquiryProducts";

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
  let { data, error } = await supabase
    .from("inquiries")
    .select(INQUIRY_ADMIN_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error && isPostgrestMissingColumn(error, "include_installation")) {
    ({ data, error } = await supabase
      .from("inquiries")
      .select(INQUIRY_ADMIN_SELECT_BASE)
      .eq("id", id)
      .maybeSingle());
    if (data) data = withDefaultIncludeInstallation([data])[0];
  }
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Не е намерено" }, { status: 404 }));

  const [enriched] = await attachProductsToInquiries(supabase, [data]);

  return withCors(req, NextResponse.json({ data: enriched ?? { ...data, products: [] } }));
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
    .select("id,status,priority,assigned_to,admin_notes,customer_phone")
    .maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Не е намерено" }, { status: 404 }));

  if (parsed.data.status !== undefined && parsed.data.status !== "new") {
    try {
      await clearContactFollowUpWhenInquiryResolved(
        supabase,
        String(data.customer_phone ?? ""),
        data.status,
      );
    } catch {
      /* не блокираме записа на запитването */
    }
  }

  await logAdminActivity({
    action: "inquiry.update",
    entityType: "inquiry",
    entityId: id,
    details: {
      changedFields: Object.keys(patch),
      status: data.status,
      priority: data.priority,
      assigned_to: data.assigned_to,
    },
  });
  return withCors(req, NextResponse.json({ data }));
}

