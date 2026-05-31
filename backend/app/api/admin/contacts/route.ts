import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { ContactPhoneInputSchema, replaceContactPhones } from "@/lib/admin/contactPhones";
import {
  findPrimaryPhoneConflict,
  formatDuplicatePrimaryPhoneMessage,
  isPostgresContactsPhoneUniqueViolation,
} from "@/lib/admin/contactPhoneDuplicate";
import {
  buildAdminSearchOrFilter,
  phoneFlexibleIlikePatterns,
} from "@/lib/admin/phoneSearchPattern";

const QuerySchema = z.object({
  q: z.string().optional(),
  kind: z.enum(["client", "supplier"]).optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(5000).optional().default(30),
});

const BodySchema = z.object({
  fullName: z.string().min(2).max(200),
  phone: z.string().min(3).max(80),
  // Допълнителни телефони — извън основния. Запазват се в contact_phones.
  additionalPhones: z.array(ContactPhoneInputSchema).max(20).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  notes: z.string().max(4000).optional().nullable(),
  contactKind: z.enum(["client", "supplier"]).optional().default("client"),
  customerStatus: z.enum(["new", "active", "vip", "lost"]).optional().default("new"),
  nextFollowUpAt: z.string().optional().nullable(),
  lastContactedAt: z.string().optional().nullable(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const { q, kind, page, perPage } = parsed.data;
  const supabase = await adminDb();
  let query = supabase
    .from("contacts")
    .select("id,full_name,phone,email,address,notes,contact_kind,customer_status,next_follow_up_at,last_contacted_at,updated_at,created_at", { count: "exact" });
  if (kind) query = query.eq("contact_kind", kind);
  if (q?.trim()) {
    const orFilter = buildAdminSearchOrFilter(q, {
      textFields: ["full_name", "phone", "email", "address"],
      phoneFields: ["phone"],
    });
    const phonePatterns = phoneFlexibleIlikePatterns(q);
    let extraContactIds: string[] = [];
    if (phonePatterns.length) {
      const idSet = new Set<string>();
      for (const phonePattern of phonePatterns) {
        const { data: phoneRows } = await supabase
          .from("contact_phones")
          .select("contact_id")
          .ilike("phone", phonePattern);
        for (const row of phoneRows ?? []) {
          idSet.add(row.contact_id as string);
        }
      }
      extraContactIds = [...idSet];
    }
    const orParts = [orFilter, extraContactIds.length ? `id.in.(${extraContactIds.join(",")})` : null].filter(
      Boolean,
    ) as string[];
    if (orParts.length) query = query.or(orParts.join(","));
  }
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  // Default sort: азбучно по име (възходящо), със стабилен tiebreaker.
  const { data, error, count } = await query
    .order("full_name", { ascending: true })
    .order("id", { ascending: true })
    .range(from, to);
  if (error && isMissingFollowupColumns(error.message)) {
    let fallback = supabase
      .from("contacts")
      .select("id,full_name,phone,email,address,notes,contact_kind,updated_at,created_at", { count: "exact" });
    if (kind) fallback = fallback.eq("contact_kind", kind);
    if (q?.trim()) {
      const orFilter = buildAdminSearchOrFilter(q, {
        textFields: ["full_name", "phone", "email", "address"],
        phoneFields: ["phone"],
      });
      const phonePatterns = phoneFlexibleIlikePatterns(q);
      let extraContactIds: string[] = [];
      if (phonePatterns.length) {
        const idSet = new Set<string>();
        for (const phonePattern of phonePatterns) {
          const { data: phoneRows } = await supabase
            .from("contact_phones")
            .select("contact_id")
            .ilike("phone", phonePattern);
          for (const row of phoneRows ?? []) {
            idSet.add(row.contact_id as string);
          }
        }
        extraContactIds = [...idSet];
      }
      const orParts = [orFilter, extraContactIds.length ? `id.in.(${extraContactIds.join(",")})` : null].filter(
        Boolean,
      ) as string[];
      if (orParts.length) fallback = fallback.or(orParts.join(","));
    }
    const fallbackRes = await fallback
      .order("full_name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);
    if (fallbackRes.error) return withCors(req, NextResponse.json({ error: fallbackRes.error.message }, { status: 500 }));
    return withCors(
      req,
      NextResponse.json({
        data: (fallbackRes.data ?? []).map(withDefaultFollowupFields),
        meta: { page, perPage, total: fallbackRes.count ?? 0 },
      }),
    );
  }
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: (data ?? []).map(withDefaultFollowupFields), meta: { page, perPage, total: count ?? 0 } }));
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  const supabase = await adminDb();
  const phoneTrimmed = parsed.data.phone.trim();
  const conflictBefore = await findPrimaryPhoneConflict(supabase, phoneTrimmed, null);
  if (conflictBefore) {
    return withCors(
      req,
      NextResponse.json(
        {
          error: formatDuplicatePrimaryPhoneMessage(conflictBefore),
          code: "DUPLICATE_PHONE",
          existingContact: { id: conflictBefore.id, fullName: conflictBefore.full_name },
        },
        { status: 409 },
      ),
    );
  }

  const payload = {
    full_name: parsed.data.fullName.trim(),
    phone: phoneTrimmed,
    email: parsed.data.email?.trim() || null,
    address: parsed.data.address?.trim() || null,
    notes: parsed.data.notes?.trim() || null,
    contact_kind: parsed.data.contactKind,
    customer_status: parsed.data.customerStatus,
    next_follow_up_at: parsed.data.nextFollowUpAt || null,
    last_contacted_at: parsed.data.lastContactedAt || null,
  };

  let { data, error } = await supabase.from("contacts").insert(payload).select("*").single();
  if (error && isMissingFollowupColumns(error.message)) {
    const {
      contact_kind: _contactKind,
      customer_status: _customerStatus,
      next_follow_up_at: _nextFollowUpAt,
      last_contacted_at: _lastContactedAt,
      ...legacyPayload
    } = payload;
    const legacyRes = await supabase.from("contacts").insert(legacyPayload).select("*").single();
    data = legacyRes.data;
    error = legacyRes.error;
  }
  if (error) {
    if (isPostgresContactsPhoneUniqueViolation(error.message)) {
      const c = await findPrimaryPhoneConflict(supabase, phoneTrimmed, null);
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

  // Записваме всички телефони (основен + допълнителни) в contact_phones,
  // за да могат да се показват и редактират като списък в UI.
  const contactId = data.id as string;
  const phonesRes = await replaceContactPhones(
    supabase,
    contactId,
    parsed.data.phone,
    parsed.data.additionalPhones ?? null,
  );
  if (phonesRes.error) {
    // Не блокираме създаването — основният телефон вече е записан в contacts.phone.
    console.warn("[contacts.create] failed to seed contact_phones:", phonesRes.error);
  }

  await logAdminActivity({
    action: "contact.create",
    entityType: "contact",
    entityId: contactId,
    details: {
      full_name: payload.full_name,
      phone: payload.phone,
      additional_phones_count: (parsed.data.additionalPhones ?? []).length,
    },
  });

  return withCors(req, NextResponse.json({ data }, { status: 201 }));
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

function withDefaultFollowupFields<T extends Record<string, unknown>>(row: T) {
  return {
    contact_kind: "client",
    customer_status: "new",
    next_follow_up_at: null,
    last_contacted_at: null,
    ...row,
  };
}
