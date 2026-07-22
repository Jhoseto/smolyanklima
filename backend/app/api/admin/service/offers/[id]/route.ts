import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { isPostgrestMissingRelation } from "@/lib/admin/pgMissingColumn";
import { calcOfferTotals } from "@/lib/offers/calcTotals";
import {
  OFFER_ITEM_SELECT,
  OFFER_SELECT,
  mapItemInputToDb,
  type OfferItemInput,
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

const UpdateSchema = z.object({
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
  vatRate: z.coerce.number().min(0).max(100).optional(),
  pricesIncludeVat: z.boolean().optional(),
  discountTotal: z.coerce.number().min(0).optional(),
  currency: z.string().max(8).optional(),
  status: z.enum(["draft", "sent", "accepted", "rejected"]).optional(),
  publicEnabled: z.boolean().optional(),
  items: z.array(ItemSchema).optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }

  const { data, error } = await session.db.from("service_offers").select(OFFER_SELECT).eq("id", id).maybeSingle();
  if (error) {
    if (isPostgrestMissingRelation(error, "service_offers")) {
      return withCors(req, NextResponse.json({ error: "Миграцията за оферти не е приложена." }, { status: 503 }));
    }
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }
  if (!data) return withCors(req, NextResponse.json({ error: "Офертата не е намерена" }, { status: 404 }));

  const { data: items } = await session.db
    .from("service_offer_items")
    .select(OFFER_ITEM_SELECT)
    .eq("offer_id", id)
    .order("sort_order", { ascending: true });

  return withCors(req, NextResponse.json({ data: { ...data, items: items ?? [] } }));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
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
    return withCors(req, NextResponse.json({ error: "Нямате право да редактирате оферти." }, { status: 403 }));
  }

  const supabase = session.db;
  const body = parsed.data;

  const { data: existing, error: existErr } = await supabase
    .from("service_offers")
    .select(OFFER_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (existErr) return withCors(req, NextResponse.json({ error: existErr.message }, { status: 500 }));
  if (!existing) return withCors(req, NextResponse.json({ error: "Офертата не е намерена" }, { status: 404 }));

  let itemsForCalc: OfferItemInput[] | null = null;
  if (body.items) {
    itemsForCalc = body.items as OfferItemInput[];
  } else {
    const { data: currentItems } = await supabase
      .from("service_offer_items")
      .select("quantity,unit_price,install_price")
      .eq("offer_id", id);
    itemsForCalc = (currentItems ?? []).map((r) => ({
      name: "x",
      quantity: Number(r.quantity),
      unitPrice: Number(r.unit_price),
      installPrice: r.install_price != null ? Number(r.install_price) : null,
    }));
  }

  const vatRate = body.vatRate ?? Number(existing.vat_rate);
  const pricesIncludeVat = body.pricesIncludeVat ?? Boolean(existing.prices_include_vat);
  const discountTotal = body.discountTotal ?? Number(existing.discount_total);

  const totals = calcOfferTotals({
    items: (itemsForCalc ?? []).map((i) => ({
      quantity: i.quantity,
      unit_price: i.unitPrice,
      install_price: i.installPrice,
    })),
    vatRate,
    pricesIncludeVat,
    discountTotal,
  });

  const payload: Record<string, unknown> = {
    subtotal: totals.subtotal,
    base_excl_vat: totals.base_excl_vat,
    vat_amount: totals.vat_amount,
    total_incl_vat: totals.total_incl_vat,
  };
  if ("contactId" in body) payload.contact_id = body.contactId ?? null;
  if ("clientName" in body) payload.client_name = body.clientName?.trim() || null;
  if ("clientPhone" in body) payload.client_phone = body.clientPhone?.trim() || null;
  if ("clientEmail" in body) payload.client_email = body.clientEmail?.trim() || null;
  if ("clientAddress" in body) payload.client_address = body.clientAddress?.trim() || null;
  if ("title" in body) payload.title = body.title?.trim() || null;
  if ("objectNote" in body) payload.object_note = body.objectNote?.trim() || null;
  if ("introNote" in body) payload.intro_note = body.introNote?.trim() || null;
  if ("termsNote" in body) payload.terms_note = body.termsNote?.trim() || null;
  if ("validUntil" in body) payload.valid_until = body.validUntil?.trim() || null;
  if ("vatRate" in body && body.vatRate != null) payload.vat_rate = body.vatRate;
  if ("pricesIncludeVat" in body && body.pricesIncludeVat != null) payload.prices_include_vat = body.pricesIncludeVat;
  if ("discountTotal" in body && body.discountTotal != null) payload.discount_total = body.discountTotal;
  if ("currency" in body && body.currency) payload.currency = body.currency;
  if ("publicEnabled" in body && body.publicEnabled != null) payload.public_enabled = body.publicEnabled;
  if ("status" in body && body.status) {
    payload.status = body.status;
    if (body.status === "sent" && !existing.sent_at) payload.sent_at = new Date().toISOString();
    if (body.status === "accepted" && !existing.accepted_at) payload.accepted_at = new Date().toISOString();
  }

  const { data: offer, error: offerErr } = await supabase
    .from("service_offers")
    .update(payload)
    .eq("id", id)
    .select(OFFER_SELECT)
    .single();
  if (offerErr) return withCors(req, NextResponse.json({ error: offerErr.message }, { status: 500 }));

  let items = null;
  if (body.items) {
    await supabase.from("service_offer_items").delete().eq("offer_id", id);
    const itemRows = (body.items as OfferItemInput[]).map((item, idx) => mapItemInputToDb(item, id, idx));
    if (itemRows.length > 0) {
      const { data: inserted, error: itemsErr } = await supabase
        .from("service_offer_items")
        .insert(itemRows)
        .select(OFFER_ITEM_SELECT);
      if (itemsErr) return withCors(req, NextResponse.json({ error: itemsErr.message }, { status: 500 }));
      items = inserted;
    } else {
      items = [];
    }
  } else {
    const { data: existingItems } = await supabase
      .from("service_offer_items")
      .select(OFFER_ITEM_SELECT)
      .eq("offer_id", id)
      .order("sort_order", { ascending: true });
    items = existingItems;
  }

  await logAdminActivity({
    action: "offer.update",
    entityType: "offer",
    entityId: id,
    details: { status: offer.status },
  });

  return withCors(req, NextResponse.json({ data: { ...offer, items: items ?? [] } }));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право да изтривате оферти." }, { status: 403 }));
  }

  const { error } = await session.db.from("service_offers").delete().eq("id", id);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  await logAdminActivity({ action: "offer.delete", entityType: "offer", entityId: id, details: {} });
  return withCors(req, NextResponse.json({ ok: true }));
}
