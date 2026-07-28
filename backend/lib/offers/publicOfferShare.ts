import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { COMPANY_INFO } from "@/lib/company/companyInfo";
import { formatOfferMoney } from "@/lib/offers/calcTotals";
import { OFFER_ITEM_SELECT, OFFER_SELECT } from "@/lib/offers/offerTypes";

export type PublicOfferShareItem = {
  brand_name: string | null;
  model_code: string | null;
  name: string;
  image_url: string | null;
};

export type PublicOfferShare = {
  token: string;
  offer_number: string;
  title: string | null;
  client_name: string | null;
  object_note: string | null;
  valid_until: string | null;
  total_incl_vat: number;
  currency: string;
  items: PublicOfferShareItem[];
};

const EUR_RATE = 1.95583;

export function toDisplayEur(amount: number, currency: string): number {
  const val = Number(amount) || 0;
  if ((currency || "EUR").toUpperCase() === "BGN") return Math.round((val / EUR_RATE) * 100) / 100;
  return val;
}

export function offerItemDisplayName(it: PublicOfferShareItem): string {
  return [it.brand_name, it.model_code || it.name].filter(Boolean).join(" ") || it.name;
}

export function offerProductSummary(items: PublicOfferShareItem[]): string | null {
  if (!items.length) return null;
  const names = items.slice(0, 3).map(offerItemDisplayName);
  const extra = items.length > 3 ? ` +${items.length - 3}` : "";
  return names.join(" · ") + extra;
}

export function formatShareValidUntil(validUntil: string | null): string {
  if (!validUntil) return "—";
  try {
    return new Date(validUntil).toLocaleDateString("bg-BG", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return validUntil;
  }
}

export function formatShareTotal(data: Pick<PublicOfferShare, "total_incl_vat" | "currency">): string {
  return formatOfferMoney(toDisplayEur(data.total_incl_vat, data.currency), "EUR");
}

export function offerShareOgImagePath(token: string): string {
  return `/api/og/offer/${encodeURIComponent(token)}`;
}

export function offerShareTitle(data: PublicOfferShare): string {
  const headline = data.title?.trim() || "Оферта за климатизация";
  return `${headline} · ${data.offer_number} | ${COMPANY_INFO.tradeName}`;
}

export function offerShareDescription(data: PublicOfferShare): string {
  const parts: string[] = [];
  if (data.client_name?.trim()) parts.push(`Клиент: ${data.client_name.trim()}`);
  if (data.object_note?.trim()) parts.push(data.object_note.trim());
  const products = offerProductSummary(data.items);
  if (products) parts.push(products);
  parts.push(`Крайна цена: ${formatShareTotal(data)} с ДДС`);
  parts.push(`Валидна до ${formatShareValidUntil(data.valid_until)}`);
  parts.push(`${COMPANY_INFO.phone} · ${COMPANY_INFO.tradeName}`);
  return parts.join(" · ");
}

export async function fetchPublicOfferShare(token: string): Promise<PublicOfferShare | null> {
  if (!token || token.length < 16) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("service_offers")
    .select(OFFER_SELECT)
    .eq("public_token", token)
    .eq("public_enabled", true)
    .maybeSingle();

  if (error || !data) return null;

  const { data: items } = await supabase
    .from("service_offer_items")
    .select(OFFER_ITEM_SELECT)
    .eq("offer_id", data.id)
    .order("sort_order", { ascending: true });

  return {
    token,
    offer_number: String(data.offer_number),
    title: data.title ? String(data.title) : null,
    client_name: data.client_name ? String(data.client_name) : null,
    object_note: data.object_note ? String(data.object_note) : null,
    valid_until: data.valid_until ? String(data.valid_until) : null,
    total_incl_vat: Number(data.total_incl_vat) || 0,
    currency: String(data.currency || "EUR"),
    items: (items ?? []).map((it) => ({
      brand_name: it.brand_name ? String(it.brand_name) : null,
      model_code: it.model_code ? String(it.model_code) : null,
      name: String(it.name),
      image_url: it.image_url ? String(it.image_url) : null,
    })),
  };
}
