import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { authErrorResponse, requireOfficeStaffSession } from "@/lib/admin/authGuard";
import { logAdminActivity } from "@/lib/admin/audit";
import {
  ContactPhoneInputSchema,
  loadContactPhones,
  replaceContactPhones,
} from "@/lib/admin/contactPhones";
import {
  findPrimaryPhoneConflict,
  formatDuplicatePrimaryPhoneMessage,
  isPostgresContactsPhoneUniqueViolation,
} from "@/lib/admin/contactPhoneDuplicate";
import { phoneFlexibleIlikePattern } from "@/lib/admin/phoneSearchPattern";
import { loadContactLinkedProducts } from "@/lib/admin/contactLinkedProducts";
import { workItemAmountAsEur } from "@/lib/admin/normalizeLegacyEurAmount";

const UpdateSchema = z.object({
  fullName: z.string().min(2).max(200).optional(),
  phone: z.string().min(3).max(80).optional(),
  // Замества целия списък с допълнителни телефони, ако е подаден.
  // ВАЖНО: undefined = „не пипай телефоните“; [] = „изтрий всички допълнителни“.
  additionalPhones: z.array(ContactPhoneInputSchema).max(20).optional(),
  email: z.string().email().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  contactKind: z.enum(["client", "supplier"]).optional(),
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

  // Зареждаме всички телефони (основен + допълнителни) — UI ги показва в детайла.
  const phones = await loadContactPhones(supabase, id).catch(() => []);

  const phoneRaw = String((contact as any).phone ?? "").trim();
  const emailRaw = String((contact as any).email ?? "").trim().toLowerCase();
  const phoneDigits = phoneRaw.replace(/[^\d+]/g, "");
  const phonePattern = phoneFlexibleIlikePattern(phoneRaw);

  const workByContactQ = supabase
    .from("work_items")
      .select("id,event_code,type,status,title,due_date,completed_at,customer_name,customer_phone,customer_address,quantity,unit_price,total_amount,amounts_converted_from_bgn_at,created_at,product_id,products:product_id(id,name,slug)")
    .eq("contact_id", id)
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(500);

  const workByPhoneQ =
    phoneRaw.length > 0
      ? supabase
          .from("work_items")
          .select("id,event_code,type,status,title,due_date,completed_at,customer_name,customer_phone,customer_address,quantity,unit_price,total_amount,amounts_converted_from_bgn_at,created_at,product_id,products:product_id(id,name,slug)")
          .eq("customer_phone", phoneRaw)
          .order("due_date", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: [], error: null } as any);

  const workByDigitsQ =
    phonePattern || phoneDigits.length >= 6
      ? supabase
          .from("work_items")
          .select("id,event_code,type,status,title,due_date,completed_at,customer_name,customer_phone,customer_address,quantity,unit_price,total_amount,amounts_converted_from_bgn_at,created_at,product_id,products:product_id(id,name,slug)")
          .ilike("customer_phone", phonePattern ?? `%${phoneDigits}%`)
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
    phonePattern || phoneDigits.length >= 6
      ? supabase
          .from("inquiries")
          .select("id,service_type,status,message,customer_name,customer_phone,customer_email,created_at,product_id,products:product_id(id,name,slug)")
          .ilike("customer_phone", phonePattern ?? `%${phoneDigits}%`)
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
      total_amount: workItemAmountAsEur(w),
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

  let linkedProducts: Awaited<ReturnType<typeof loadContactLinkedProducts>> = [];
  try {
    linkedProducts = await loadContactLinkedProducts(supabase, {
      id,
      contact_kind: (contact as { contact_kind?: string | null }).contact_kind,
      phone: phoneRaw,
    });
  } catch (linkedErr) {
    console.warn("[contacts.get] linked products:", linkedErr);
  }

  return withCors(req, NextResponse.json({ data: { contact, phones, history, linkedProducts } }));
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
  if (parsed.data.contactKind !== undefined) patch.contact_kind = parsed.data.contactKind;
  if (parsed.data.customerStatus !== undefined) patch.customer_status = parsed.data.customerStatus;
  if (parsed.data.nextFollowUpAt !== undefined) patch.next_follow_up_at = parsed.data.nextFollowUpAt || null;
  if (parsed.data.lastContactedAt !== undefined) patch.last_contacted_at = parsed.data.lastContactedAt || null;

  const supabase = await adminDb();
  if (parsed.data.phone !== undefined) {
    const nextPhone = parsed.data.phone.trim();
    const conflict = await findPrimaryPhoneConflict(supabase, nextPhone, id);
    if (conflict) {
      return withCors(
        req,
        NextResponse.json(
          {
            error: formatDuplicatePrimaryPhoneMessage(conflict),
            code: "DUPLICATE_PHONE",
            existingContact: { id: conflict.id, fullName: conflict.full_name },
          },
          { status: 409 },
        ),
      );
    }
  }

  let { data, error } = await supabase.from("contacts").update(patch).eq("id", id).select("*").maybeSingle();
  if (error && isMissingFollowupColumns(error.message)) {
    const {
      contact_kind: _contactKind,
      customer_status: _customerStatus,
      next_follow_up_at: _nextFollowUpAt,
      last_contacted_at: _lastContactedAt,
      ...legacyPatch
    } = patch;
    const legacyRes = await supabase.from("contacts").update(legacyPatch).eq("id", id).select("*").maybeSingle();
    data = legacyRes.data;
    error = legacyRes.error;
  }
  if (error) {
    if (isPostgresContactsPhoneUniqueViolation(error.message) && parsed.data.phone !== undefined) {
      const c = await findPrimaryPhoneConflict(supabase, parsed.data.phone.trim(), id);
      if (c) {
        return withCors(
          req,
          NextResponse.json(
            {
              error: formatDuplicatePrimaryPhoneMessage(c),
              code: "DUPLICATE_PHONE",
              existingContact: { id: c.id, fullName: c.full_name },
            },
            { status: 409 },
          ),
        );
      }
    }
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }
  if (!data) return withCors(req, NextResponse.json({ error: "Контактът не е намерен" }, { status: 404 }));

  // Ако клиентът е изпратил additionalPhones (включително празен масив),
  // правим пълен replace на телефоните. Когато полето отсъства — не пипаме.
  if (parsed.data.additionalPhones !== undefined) {
    const primaryPhone =
      (patch.phone as string | undefined) ?? String((data as any).phone ?? "");
    const phonesRes = await replaceContactPhones(
      supabase,
      id,
      primaryPhone,
      parsed.data.additionalPhones,
    );
    if (phonesRes.error) {
      console.warn("[contacts.update] failed to update contact_phones:", phonesRes.error);
      return withCors(req, NextResponse.json({ error: phonesRes.error }, { status: 500 }));
    }
  } else if (parsed.data.phone !== undefined) {
    // Ако сменят основния телефон, синхронизираме primary записа в contact_phones,
    // като оставяме съществуващите допълнителни на мира.
    await syncPrimaryPhone(supabase, id, parsed.data.phone);
  }

  await logAdminActivity({
    action: "contact.update",
    entityType: "contact",
    entityId: id,
    details: {
      changedFields: Object.keys(patch),
      ...(parsed.data.additionalPhones !== undefined
        ? { additional_phones_count: parsed.data.additionalPhones.length }
        : {}),
    },
  });

  return withCors(req, NextResponse.json({ data }));
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireOfficeStaffSession();
  } catch (e) {
    const err = authErrorResponse(e);
    return withCors(req, NextResponse.json({ error: err.message }, { status: err.status }));
  }

  const { id } = await ctx.params;
  const supabase = session.db;

  const { data: contact, error: cErr } = await supabase
    .from("contacts")
    .select("id,full_name,phone,contact_kind")
    .eq("id", id)
    .maybeSingle();
  if (cErr) return withCors(req, NextResponse.json({ error: cErr.message }, { status: 500 }));
  if (!contact) return withCors(req, NextResponse.json({ error: "Контактът не е намерен" }, { status: 404 }));

  const [{ count: linkedWorkItems }, { count: linkedProducts }, { count: linkedAccessories }] = await Promise.all([
    supabase.from("work_items").select("id", { count: "exact", head: true }).eq("contact_id", id),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("supplier_id", id),
    supabase.from("accessories").select("id", { count: "exact", head: true }).eq("supplier_id", id),
  ]);

  const { error: dErr } = await supabase.from("contacts").delete().eq("id", id);
  if (dErr) return withCors(req, NextResponse.json({ error: dErr.message }, { status: 500 }));

  await logAdminActivity({
    action: "contact.delete",
    entityType: "contact",
    entityId: id,
    details: {
      fullName: (contact as any).full_name,
      contactKind: (contact as any).contact_kind,
      linkedWorkItems: linkedWorkItems ?? 0,
      linkedProducts: linkedProducts ?? 0,
      linkedAccessories: linkedAccessories ?? 0,
    },
  });

  return withCors(
    req,
    NextResponse.json({
      ok: true,
      data: {
        id,
        unlinked: {
          workItems: linkedWorkItems ?? 0,
          products: linkedProducts ?? 0,
          accessories: linkedAccessories ?? 0,
        },
      },
    }),
  );
}

/**
 * Когато основният телефон се смени, искаме записът с is_primary=true в
 * contact_phones да бъде в синхрон. Допълнителните остават на мира.
 */
async function syncPrimaryPhone(
  supabase: Awaited<ReturnType<typeof adminDb>>,
  contactId: string,
  newPrimary: string,
): Promise<void> {
  const phone = newPrimary.trim();
  if (phone.length < 3) return;

  const { data: existing, error: fetchErr } = await supabase
    .from("contact_phones")
    .select("id,phone,label,is_primary")
    .eq("contact_id", contactId)
    .eq("is_primary", true)
    .maybeSingle();
  if (fetchErr) {
    if (
      fetchErr.message.includes("contact_phones") &&
      (fetchErr.message.includes("does not exist") || fetchErr.message.includes("schema cache"))
    ) {
      return;
    }
    console.warn("[contacts.syncPrimaryPhone] fetch failed:", fetchErr.message);
    return;
  }

  if (existing) {
    await supabase
      .from("contact_phones")
      .update({ phone })
      .eq("id", existing.id);
  } else {
    await supabase
      .from("contact_phones")
      .insert({ contact_id: contactId, phone, label: "Основен", is_primary: true, sort_order: 0 });
  }
}

function isMissingFollowupColumns(message: string) {
  return (
    message.includes("contact_kind") ||
    message.includes("customer_status") ||
    message.includes("next_follow_up_at") ||
    message.includes("last_contacted_at") ||
    message.includes("schema cache")
  );
}
