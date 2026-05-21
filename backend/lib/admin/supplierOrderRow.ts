import { withCloudinaryWebOptimization } from "@/lib/services/cloudinaryService";

function first<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export type NormalizedSupplierOrderProduct = {
  id: string;
  name: string;
  model_code: string | null;
  price: number | null;
  price_with_mount: number | null;
  purchase_price: number | null;
  source_url: string | null;
  slug: string | null;
  show_in_public_catalog: boolean | null;
  brand_name: string | null;
  product_type_name: string | null;
  supplier_name: string | null;
  product_images: Array<{ url: string; is_main: boolean; sort_order: number }>;
  product_specs: {
    cooling_power_kw?: number | null;
    heating_power_kw?: number | null;
    energy_class_cool?: string | null;
    energy_class_heat?: string | null;
    coverage_m2?: number | null;
    wifi?: boolean | null;
    btu?: number | null;
  } | null;
};

export type SupplierOrderDeliveredProduct = {
  id: string;
  name: string;
  slug: string | null;
  price: number | null;
  purchase_price: number | null;
  stock_status: string;
  sold_quantity: number;
  model_code: string | null;
  brand_id: string | null;
  stock_quantity: number;
  indoor_unit_serial: string | null;
  outdoor_unit_serial: string | null;
  supplier_invoice_number: string | null;
  purchased_at: string | null;
};

export type NormalizedSupplierOrderRow = {
  id: string;
  title: string;
  status: string;
  due_date: string | null;
  created_at: string;
  customer_name: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  unit_price: number | null;
  notes: string | null;
  product_id: string | null;
  contact_id: string | null;
  products: NormalizedSupplierOrderProduct | null;
  contacts: { id?: string; full_name?: string; phone?: string; email?: string; address?: string } | null;
  /** Складова бройка след „Доставен“ — за продажба от панела. */
  delivered_product?: SupplierOrderDeliveredProduct | null;
};

export function normalizeSupplierOrderRow(row: Record<string, unknown>): NormalizedSupplierOrderRow {
  const prodRaw = first(row.products as Record<string, unknown> | Record<string, unknown>[] | null);
  let products: NormalizedSupplierOrderProduct | null = null;

  if (prodRaw && typeof prodRaw === "object") {
    const brand = first(prodRaw.brands as { name?: string } | { name?: string }[] | null);
    const specs = first(
      prodRaw.product_specs as Record<string, unknown> | Record<string, unknown>[] | null,
    );
    const supplier = first(prodRaw.supplier as { full_name?: string } | { full_name?: string }[] | null);
    const pType = first(prodRaw.product_types as { name?: string } | { name?: string }[] | null);
    const imagesRaw = prodRaw.product_images;
    const images = Array.isArray(imagesRaw)
      ? imagesRaw
      : imagesRaw
        ? [imagesRaw]
        : [];

    products = {
      id: String(prodRaw.id ?? ""),
      name: String(prodRaw.name ?? ""),
      model_code: (prodRaw.model_code as string | null) ?? null,
      price: prodRaw.price != null ? Number(prodRaw.price) : null,
      price_with_mount: prodRaw.price_with_mount != null ? Number(prodRaw.price_with_mount) : null,
      purchase_price: prodRaw.purchase_price != null ? Number(prodRaw.purchase_price) : null,
      source_url: (prodRaw.source_url as string | null) ?? null,
      slug: (prodRaw.slug as string | null) ?? null,
      show_in_public_catalog:
        prodRaw.show_in_public_catalog != null ? Boolean(prodRaw.show_in_public_catalog) : null,
      brand_name: brand?.name ?? null,
      product_type_name: pType?.name ?? null,
      supplier_name: supplier?.full_name ?? null,
      product_images: images
        .filter((img): img is { url: string; is_main: boolean; sort_order: number } =>
          Boolean(img && typeof img === "object" && "url" in img),
        )
        .map((img) => ({
          ...img,
          url: withCloudinaryWebOptimization(String(img.url)),
        })),
      product_specs: specs
        ? {
            cooling_power_kw: specs.cooling_power_kw != null ? Number(specs.cooling_power_kw) : null,
            heating_power_kw: specs.heating_power_kw != null ? Number(specs.heating_power_kw) : null,
            energy_class_cool: (specs.energy_class_cool as string | null) ?? null,
            energy_class_heat: (specs.energy_class_heat as string | null) ?? null,
            coverage_m2: specs.coverage_m2 != null ? Number(specs.coverage_m2) : null,
            wifi: specs.wifi != null ? Boolean(specs.wifi) : null,
            btu: specs.btu != null ? Number(specs.btu) : null,
          }
        : null,
    };
  }

  const contactRaw = first(row.contacts as Record<string, unknown> | Record<string, unknown>[] | null);

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    status: String(row.status ?? ""),
    due_date: (row.due_date as string | null) ?? null,
    created_at: String(row.created_at ?? ""),
    customer_name: (row.customer_name as string | null) ?? null,
    customer_phone: (row.customer_phone as string | null) ?? null,
    customer_address: (row.customer_address as string | null) ?? null,
    unit_price: row.unit_price != null ? Number(row.unit_price) : null,
    notes: (row.notes as string | null) ?? null,
    product_id: (row.product_id as string | null) ?? null,
    contact_id: (row.contact_id as string | null) ?? null,
    products,
    contacts: contactRaw
      ? {
          id: contactRaw.id as string | undefined,
          full_name: (contactRaw.full_name as string | null) ?? undefined,
          phone: (contactRaw.phone as string | null) ?? undefined,
          email: (contactRaw.email as string | null) ?? undefined,
          address: (contactRaw.address as string | null) ?? undefined,
        }
      : null,
    delivered_product: null,
  };
}

export function attachDeliveredProductsToOrders(
  orders: NormalizedSupplierOrderRow[],
  instances: Array<Record<string, unknown>>,
): NormalizedSupplierOrderRow[] {
  const byOrderId = new Map<string, SupplierOrderDeliveredProduct>();
  for (const raw of instances) {
    const orderId = raw.supplier_order_work_item_id as string | undefined;
    if (!orderId) continue;
    byOrderId.set(orderId, {
      id: String(raw.id ?? ""),
      name: String(raw.name ?? ""),
      slug: (raw.slug as string | null) ?? null,
      price: raw.price != null ? Number(raw.price) : null,
      purchase_price: raw.purchase_price != null ? Number(raw.purchase_price) : null,
      stock_status: String(raw.stock_status ?? ""),
      sold_quantity: Number(raw.sold_quantity ?? 0),
      model_code: (raw.model_code as string | null) ?? null,
      brand_id: (raw.brand_id as string | null) ?? null,
      stock_quantity: Number(raw.stock_quantity ?? 0),
      indoor_unit_serial: (raw.indoor_unit_serial as string | null) ?? null,
      outdoor_unit_serial: (raw.outdoor_unit_serial as string | null) ?? null,
      supplier_invoice_number: (raw.supplier_invoice_number as string | null) ?? null,
      purchased_at: (raw.purchased_at as string | null) ?? null,
    });
  }
  return orders.map((o) => ({
    ...o,
    delivered_product: byOrderId.get(o.id) ?? null,
  }));
}

export const SUPPLIER_ORDER_SELECT = `
  id, title, status, priority, due_date, customer_name, customer_phone,
  customer_address, unit_price, total_amount, notes, created_at,
  product_id, contact_id,
  products:product_id (
    id, name, model_code, price, price_with_mount, purchase_price, source_url, slug,
    show_in_public_catalog, brand_id,
    brands:brand_id (name),
    product_types:type_id (name),
    supplier:supplier_id (full_name),
    product_images (url, is_main, sort_order),
    product_specs (
      cooling_power_kw, heating_power_kw, energy_class_cool, energy_class_heat,
      coverage_m2, wifi, btu
    )
  ),
  contacts:contact_id (id, full_name, phone, email, address)
`;
