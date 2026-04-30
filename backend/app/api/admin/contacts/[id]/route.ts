import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";

const UpdateSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  phone: z.string().min(3).max(80).optional(),
  email: z.string().email().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await adminDb();

  const [{ data: contact, error: cErr }, { data: history, error: hErr }] = await Promise.all([
    supabase.from("contacts").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("work_items")
      .select("id,event_code,type,status,title,due_date,customer_name,customer_phone,customer_address,quantity,unit_price,total_amount,created_at,product_id,products:product_id(name,slug)")
      .eq("contact_id", id)
      .order("due_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (cErr) return withCors(req, NextResponse.json({ error: cErr.message }, { status: 500 }));
  if (!contact) return withCors(req, NextResponse.json({ error: "Контактът не е намерен" }, { status: 404 }));
  if (hErr) return withCors(req, NextResponse.json({ error: hErr.message }, { status: 500 }));

  return withCors(req, NextResponse.json({ data: { contact, history: history ?? [] } }));
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const patch: Record<string, unknown> = {};
  if (parsed.data.fullName !== undefined) patch.full_name = parsed.data.fullName.trim();
  if (parsed.data.phone !== undefined) patch.phone = parsed.data.phone.trim();
  if (parsed.data.email !== undefined) patch.email = parsed.data.email?.trim() || null;
  if (parsed.data.address !== undefined) patch.address = parsed.data.address?.trim() || null;
  if (parsed.data.notes !== undefined) patch.notes = parsed.data.notes?.trim() || null;

  const supabase = await adminDb();
  const { data, error } = await supabase.from("contacts").update(patch).eq("id", id).select("*").maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Контактът не е намерен" }, { status: 404 }));

  await logAdminActivity({
    action: "contact.update",
    entityType: "contact",
    entityId: id,
    details: { changedFields: Object.keys(patch) },
  });

  return withCors(req, NextResponse.json({ data }));
}
