import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { isPostgrestMissingRelation } from "@/lib/admin/pgMissingColumn";
import { calcOfferTotals } from "@/lib/offers/calcTotals";
import { DEFAULT_OFFER_INTRO, DEFAULT_OFFER_TERMS } from "@/lib/company/companyInfo";
import {
  OFFER_ITEM_SELECT,
  OFFER_SELECT,
  mapItemInputToDb,
  type OfferItemInput,
  type OfferItemRow,
} from "@/lib/offers/offerTypes";

const SpecSchema = z.object({
  label: z.string().max(200),
  value: z.string().max(500),
});

const ItemSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid().optional().nullable(),
  kind: z.enum(["product", "installation", "custom"]).optional().default("product"),
  name: z.string().min(1).max(500),
  brandName: z.string().max(200).optional().nullable(),
  typeName: z.string().max(200).optional().nullable(),
  modelCode: z.string().max(200).optional().nullable(),
  imageUrl: z.string().max(2000).optional().nullable(),
  description: z.string().max(20000).optional().nullable(),
  specs: z.array(SpecSchema).optional().default([]),
  groupLabel: z.string().max(200).optional().nullable(),
  quantity: z.coerce.number().positive().default(1),
  unitPrice: z.coerce.number().min(0),
  installPrice: z.union([z.coerce.number().min(0), z.literal(""), z.null()]).optional().nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v)),
  lineNote: z.string().max(2000).optional().nullable(),
  sortOrder: z.coerce.number().int().optional(),
});

const CreateSchema = z.object({
  contactId: z.string().uuid().optional().nullable(),
  clientName: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1, "Името на клиента е задължително").max(300),
  ),
  clientPhone: z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z.string().min(1, "Телефонът е задължителен").max(80),
  ),
  clientEmail: z.string().max(200).optional().nullable(),
  clientAddress: z.string().max(500).optional().nullable(),
  title: z.string().max(500).optional().nullable(),
  objectNote: z.string().max(1000).optional().nullable(),
  introNote: z.string().max(5000).optional().nullable(),
  termsNote: z.string().max(10000).optional().nullable(),
  validUntil: z.string().max(32).optional().nullable(),
  vatRate: z.coerce.number().min(0).max(100).optional().default(20),
  pricesIncludeVat: z.boolean().optional().default(true),
  discountTotal: z.coerce.number().min(0).optional().default(0),
  currency: z.string().max(8).optional().default("EUR"),
  status: z.enum(["draft", "sent", "accepted", "rejected"]).optional().default("draft"),
  items: z.array(ItemSchema).optional().default([]),
});

const QuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
  sortBy: z.enum(["created_at", "offer_number", "total_incl_vat", "valid_until"]).optional().default("created_at"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }

  const { q, status, sortBy, sortDir, page, perPage } = parsed.data;
  const supabase = session.db;
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  let query = supabase.from("service_offers").select(OFFER_SELECT, { count: "exact" });
  if (status) query = query.eq("status", status);
  if (q?.trim()) {
    const term = q.trim();
    query = query.or(
      `offer_number.ilike.%${term}%,client_name.ilike.%${term}%,title.ilike.%${term}%,object_note.ilike.%${term}%`,
    );
  }

  const { data, error, count } = await query
    .order(sortBy, { ascending: sortDir === "asc" })
    .order("id", { ascending: true })
    .range(from, to);

  if (error) {
    if (isPostgrestMissingRelation(error, "service_offers")) {
      return withCors(req, NextResponse.json({
        error: "Таблицата service_offers липсва. Приложете миграция 0100_service_offers.sql.",
        data: [],
        meta: { page, perPage, total: 0 },
      }, { status: 503 }));
    }
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  return withCors(req, NextResponse.json({ data: data ?? [], meta: { page, perPage, total: count ?? 0 } }));
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const detail = first ? `${first.path.join(".") || "body"}: ${first.message}` : "Невалидни данни";
    return withCors(req, NextResponse.json({ error: detail }, { status: 400 }));
  }

  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право да създавате оферти." }, { status: 403 }));
  }

  const supabase = session.db;
  const body = parsed.data;
  const items = body.items as OfferItemInput[];

  const totals = calcOfferTotals({
    items: items.map((i) => ({
      quantity: i.quantity,
      unit_price: i.unitPrice,
      install_price: i.installPrice,
    })),
    vatRate: body.vatRate,
    pricesIncludeVat: body.pricesIncludeVat,
    discountTotal: body.discountTotal,
  });

  const { data: numberRow, error: numErr } = await supabase.rpc("next_offer_number");
  if (numErr) {
    if (isPostgrestMissingRelation(numErr, "service_offers") || numErr.message?.includes("next_offer_number")) {
      return withCors(req, NextResponse.json({
        error: "Миграцията за оферти не е приложена (next_offer_number / service_offers).",
      }, { status: 503 }));
    }
    return withCors(req, NextResponse.json({ error: numErr.message }, { status: 500 }));
  }
  const offerNumber = String(numberRow);

  const insertOffer = {
    offer_number: offerNumber,
    status: body.status,
    contact_id: body.contactId ?? null,
    client_name: body.clientName?.trim() || null,
    client_phone: body.clientPhone?.trim() || null,
    client_email: body.clientEmail?.trim() || null,
    client_address: body.clientAddress?.trim() || null,
    title: body.title?.trim() || null,
    object_note: body.objectNote?.trim() || null,
    intro_note: body.introNote?.trim() || DEFAULT_OFFER_INTRO,
    terms_note: body.termsNote?.trim() || DEFAULT_OFFER_TERMS,
    valid_until: body.validUntil?.trim() || null,
    vat_rate: body.vatRate,
    prices_include_vat: body.pricesIncludeVat,
    discount_total: body.discountTotal,
    currency: body.currency,
    subtotal: totals.subtotal,
    base_excl_vat: totals.base_excl_vat,
    vat_amount: totals.vat_amount,
    total_incl_vat: totals.total_incl_vat,
    created_by: session.userId ?? null,
    sent_at: body.status === "sent" ? new Date().toISOString() : null,
    accepted_at: body.status === "accepted" ? new Date().toISOString() : null,
  };

  const { data: offer, error: offerErr } = await supabase
    .from("service_offers")
    .insert(insertOffer)
    .select(OFFER_SELECT)
    .single();

  if (offerErr || !offer) {
    return withCors(req, NextResponse.json({ error: offerErr?.message ?? "Грешка при създаване" }, { status: 500 }));
  }

  const itemRows = items.map((item, idx) => mapItemInputToDb(item, offer.id as string, idx));
  let insertedItems: OfferItemRow[] = [];
  if (itemRows.length > 0) {
    const { data, error: itemsErr } = await supabase
      .from("service_offer_items")
      .insert(itemRows)
      .select(OFFER_ITEM_SELECT);
    insertedItems = (data ?? []) as OfferItemRow[];

    if (itemsErr) {
      await supabase.from("service_offers").delete().eq("id", offer.id);
      return withCors(req, NextResponse.json({ error: itemsErr.message }, { status: 500 }));
    }
  }

  await logAdminActivity({
    action: "offer.create",
    entityType: "offer",
    entityId: offer.id as string,
    details: { offer_number: offerNumber, items: items.length },
  });

  return withCors(
    req,
    NextResponse.json({ data: { ...offer, items: insertedItems ?? [] } }, { status: 201 }),
  );
}
