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
  customerStatus: z.enum(["new", "active", "vip", "lost"]).optional(),
  nextFollowUpAt: z.string().optional().nullable(),
  lastContactedAt: z.string().optional().nullable(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const supabase = await adminDb();

  const { data: contact, error: cErr } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();

  if (cErr) return withCors(req, NextResponse.json({ error: cErr.message }, { status: 500 }));
  if (!contact) return withCors(req, NextResponse.json({ error: "Контактът не е намерен" }, { status: 404 }));

  const phoneRaw = String((contact as any).phone ?? "").trim();
  const emailRaw = String((contact as any).email ?? "").trim().toLowerCase();
  const phoneDigits = phoneRaw.replace(/[^\d+]/g, "");

  const workByContactQ = supabase
    .from("work_items")
      .select("id,event_code,type,status,title,due_date,customer_name,customer_phone,customer_address,quantity,unit_price,total_amount,created_at,product_id,products:product_id(id,name,slug)")
    .eq("contact_id", id)
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);

  const workByPhoneQ =
    phoneRaw.length > 0
      ? supabase
          .from("work_items")
          .select("id,event_code,type,status,title,due_date,customer_name,customer_phone,customer_address,quantity,unit_price,total_amount,created_at,product_id,products:product_id(id,name,slug)")
          .eq("customer_phone", phoneRaw)
          .order("due_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null } as any);

  const workByDigitsQ =
    phoneDigits.length >= 6
      ? supabase
          .from("work_items")
          .select("id,event_code,type,status,title,due_date,customer_name,customer_phone,customer_address,quantity,unit_price,total_amount,created_at,product_id,products:product_id(name,slug)")
          .ilike("customer_phone", `%${phoneDigits}%`)
          .order("due_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null } as any);

  const inqByPhoneQ =
    phoneRaw.length > 0
      ? supabase
          .from("inquiries")
          .select("id,service_type,status,message,customer_name,customer_phone,customer_email,created_at,product_id,products:product_id(id,name,slug)")
          .eq("customer_phone", phoneRaw)
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null } as any);

  const inqByDigitsQ =
    phoneDigits.length >= 6
      ? supabase
          .from("inquiries")
          .select("id,service_type,status,message,customer_name,customer_phone,customer_email,created_at,product_id,products:product_id(id,name,slug)")
          .ilike("customer_phone", `%${phoneDigits}%`)
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null } as any);

  const inqByEmailQ =
    emailRaw.length > 0
      ? supabase
          .from("inquiries")
          .select("id,service_type,status,message,customer_name,customer_phone,customer_email,created_at,product_id,products:product_id(id,name,slug)")
          .ilike("customer_email", emailRaw)
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null } as any);

  const [workByContact, workByPhone, workByDigits, inqByPhone, inqByDigits, inqByEmail] = await Promise.all([
    workByContactQ,
    workByPhoneQ,
    workByDigitsQ,
    inqByPhoneQ,
    inqByDigitsQ,
    inqByEmailQ,
  ]);

  if (workByContact.error) return withCors(req, NextResponse.json({ error: workByContact.error.message }, { status: 500 }));
  if (workByPhone.error) return withCors(req, NextResponse.json({ error: workByPhone.error.message }, { status: 500 }));
  if (workByDigits.error) return withCors(req, NextResponse.json({ error: workByDigits.error.message }, { status: 500 }));
  if (inqByPhone.error) return withCors(req, NextResponse.json({ error: inqByPhone.error.message }, { status: 500 }));
  if (inqByDigits.error) return withCors(req, NextResponse.json({ error: inqByDigits.error.message }, { status: 500 }));
  if (inqByEmail.error) return withCors(req, NextResponse.json({ error: inqByEmail.error.message }, { status: 500 }));

  const uniqById = <T extends { id: string }>(arr: T[]) => {
    const map = new Map<string, T>();
    for (const it of arr) map.set(it.id, it);
    return Array.from(map.values());
  };

  const workRows = uniqById([...(workByContact.data ?? []), ...(workByPhone.data ?? []), ...(workByDigits.data ?? [])] as any[]);
  const inquiryRows = uniqById([...(inqByPhone.data ?? []), ...(inqByDigits.data ?? []), ...(inqByEmail.data ?? [])] as any[]);

  const history = [
    ...workRows.map((w: any) => ({
      id: `work:${w.id}`,
      source: "work_item",
      event_code: w.event_code ?? null,
      type: w.type,
      status: w.status,
      title: w.title,
      due_date: w.due_date ?? null,
      total_amount: w.total_amount ?? null,
      created_at: w.created_at,
      products: w.products ?? null,
      service_type: null,
      message: null,
      customer_name: w.customer_name ?? null,
      customer_phone: w.customer_phone ?? null,
      customer_email: null,
    })),
    ...inquiryRows.map((i: any) => ({
      id: `inq:${i.id}`,
      source: "inquiry",
      event_code: null,
      type: "inquiry",
      status: i.status ?? "new",
      title: "Запитване",
      due_date: null,
      total_amount: null,
      created_at: i.created_at,
      products: i.products ?? null,
      service_type: i.service_type ?? null,
      message: i.message ?? null,
      customer_name: i.customer_name ?? null,
      customer_phone: i.customer_phone ?? null,
      customer_email: i.customer_email ?? null,
    })),
  ].sort((a, b) => {
    const da = new Date(a.due_date || a.created_at).getTime();
    const db = new Date(b.due_date || b.created_at).getTime();
    return db - da;
  });

  return withCors(req, NextResponse.json({ data: { contact, history } }));
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
  if (parsed.data.customerStatus !== undefined) patch.customer_status = parsed.data.customerStatus;
  if (parsed.data.nextFollowUpAt !== undefined) patch.next_follow_up_at = parsed.data.nextFollowUpAt || null;
  if (parsed.data.lastContactedAt !== undefined) patch.last_contacted_at = parsed.data.lastContactedAt || null;

  const supabase = await adminDb();
  let { data, error } = await supabase.from("contacts").update(patch).eq("id", id).select("*").maybeSingle();
  if (error && isMissingFollowupColumns(error.message)) {
    const {
      customer_status: _customerStatus,
      next_follow_up_at: _nextFollowUpAt,
      last_contacted_at: _lastContactedAt,
      ...legacyPatch
    } = patch;
    const legacyRes = await supabase.from("contacts").update(legacyPatch).eq("id", id).select("*").maybeSingle();
    data = legacyRes.data;
    error = legacyRes.error;
  }
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

function isMissingFollowupColumns(message: string) {
  return (
    message.includes("customer_status") ||
    message.includes("next_follow_up_at") ||
    message.includes("last_contacted_at") ||
    message.includes("schema cache")
  );
}
