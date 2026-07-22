import type { OfferSpecRow } from "@/lib/offers/buildSpecsFromProduct";

export type OfferStatus = "draft" | "sent" | "accepted" | "rejected";
export type OfferItemKind = "product" | "installation" | "custom";

export type OfferItemInput = {
  id?: string;
  productId?: string | null;
  kind?: OfferItemKind;
  name: string;
  brandName?: string | null;
  typeName?: string | null;
  modelCode?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  specs?: OfferSpecRow[];
  groupLabel?: string | null;
  quantity: number;
  unitPrice: number;
  installPrice?: number | null;
  lineNote?: string | null;
  sortOrder?: number;
};

export type OfferItemRow = {
  id: string;
  offer_id: string;
  product_id: string | null;
  kind: OfferItemKind;
  name: string;
  brand_name: string | null;
  type_name: string | null;
  model_code: string | null;
  image_url: string | null;
  description: string | null;
  specs: OfferSpecRow[];
  group_label: string | null;
  quantity: number;
  unit_price: number;
  install_price: number | null;
  line_note: string | null;
  sort_order: number;
};

export type OfferRow = {
  id: string;
  offer_number: string;
  status: OfferStatus;
  contact_id: string | null;
  client_name: string | null;
  client_phone: string | null;
  client_email: string | null;
  client_address: string | null;
  title: string | null;
  object_note: string | null;
  intro_note: string | null;
  terms_note: string | null;
  valid_until: string | null;
  vat_rate: number;
  prices_include_vat: boolean;
  discount_total: number;
  currency: string;
  subtotal: number;
  base_excl_vat: number;
  vat_amount: number;
  total_incl_vat: number;
  public_token: string;
  public_enabled: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  items?: OfferItemRow[];
};

export const OFFER_SELECT =
  "id,offer_number,status,contact_id,client_name,client_phone,client_email,client_address,title,object_note,intro_note,terms_note,valid_until,vat_rate,prices_include_vat,discount_total,currency,subtotal,base_excl_vat,vat_amount,total_incl_vat,public_token,public_enabled,created_by,created_at,updated_at,sent_at,accepted_at";

export const OFFER_ITEM_SELECT =
  "id,offer_id,product_id,kind,name,brand_name,type_name,model_code,image_url,description,specs,group_label,quantity,unit_price,install_price,line_note,sort_order";

export function mapItemInputToDb(item: OfferItemInput, offerId: string, sortOrder: number) {
  return {
    offer_id: offerId,
    product_id: item.productId ?? null,
    kind: item.kind ?? "product",
    name: item.name.trim(),
    brand_name: item.brandName?.trim() || null,
    type_name: item.typeName?.trim() || null,
    model_code: item.modelCode?.trim() || null,
    image_url: item.imageUrl?.trim() || null,
    description: item.description?.trim() || null,
    specs: item.specs ?? [],
    group_label: item.groupLabel?.trim() || null,
    quantity: Number(item.quantity) || 1,
    unit_price: Number(item.unitPrice) || 0,
    install_price: item.installPrice == null || item.installPrice === ("" as unknown) ? null : Number(item.installPrice),
    line_note: item.lineNote?.trim() || null,
    sort_order: item.sortOrder ?? sortOrder,
  };
}
