import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { OFFER_ITEM_SELECT, OFFER_SELECT } from "@/lib/offers/offerTypes";
import { sanitizeOfferDescription } from "@/lib/offers/sanitizeOfferDescription";
import { COMPANY_INFO } from "@/lib/company/companyInfo";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) {
    return withCors(req, NextResponse.json({ error: "Невалиден линк" }, { status: 400 }));
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_offers")
    .select(OFFER_SELECT)
    .eq("public_token", token)
    .eq("public_enabled", true)
    .maybeSingle();

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Офертата не е намерена или линкът е деактивиран" }, { status: 404 }));

  const { data: items } = await supabase
    .from("service_offer_items")
    .select(OFFER_ITEM_SELECT)
    .eq("offer_id", data.id)
    .order("sort_order", { ascending: true });

  // Display-safe payload (без created_by и вътрешни бележки на ниво система)
  const safe = {
    offer_number: data.offer_number,
    status: data.status,
    client_name: data.client_name,
    title: data.title,
    object_note: data.object_note,
    intro_note: data.intro_note,
    terms_note: data.terms_note,
    valid_until: data.valid_until,
    vat_rate: data.vat_rate,
    prices_include_vat: data.prices_include_vat,
    discount_total: data.discount_total,
    currency: data.currency,
    subtotal: data.subtotal,
    base_excl_vat: data.base_excl_vat,
    vat_amount: data.vat_amount,
    total_incl_vat: data.total_incl_vat,
    created_at: data.created_at,
    items: (items ?? []).map((it) => ({
      id: it.id,
      kind: it.kind,
      name: it.name,
      brand_name: it.brand_name,
      type_name: it.type_name,
      model_code: it.model_code,
      image_url: it.image_url,
      description: sanitizeOfferDescription(it.description),
      specs: it.specs,
      group_label: it.group_label,
      quantity: it.quantity,
      unit_price: it.unit_price,
      install_price: it.install_price,
      line_note: it.line_note,
      sort_order: it.sort_order,
    })),
    company: {
      tradeName: COMPANY_INFO.tradeName,
      legalName: COMPANY_INFO.legalName,
      phone: COMPANY_INFO.phone,
      phoneE164: COMPANY_INFO.phoneE164,
      email: COMPANY_INFO.email,
      tradeAddress: COMPANY_INFO.tradeAddress,
      website: COMPANY_INFO.website,
      eik: COMPANY_INFO.eik,
      vatNumber: COMPANY_INFO.vatNumber,
    },
  };

  return withCors(req, NextResponse.json({ data: safe }));
}
