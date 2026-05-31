import type { SupabaseClient } from "@supabase/supabase-js";

export type ManualDeliveryInput = {
  productId?: string | null;
  productName: string;
  brandId?: string | null;
  modelCode?: string | null;
  productCondition: "new" | "used";
  productRegion?: "europe" | "japan" | null;
  supplierName?: string | null;
  purchasePrice?: number | null;
  agreedPrice?: number | null;
  orderDate: string;
  contactId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  notes?: string | null;
  createdBy: string;
};

type ProductTemplate = {
  id: string;
  name: string;
  brand_id: string | null;
  model_code: string | null;
  product_condition: string | null;
  product_region: string | null;
  price: number | null;
  purchase_price: number | null;
};

export function validateManualDeliveryInput(input: ManualDeliveryInput): string | null {
  const productName = input.productName.trim();
  if (!input.productId && productName.length < 2) {
    return "Въведете име на продукта или изберете от каталога.";
  }
  if (!input.orderDate.trim()) return "Посочете дата на поръчката.";
  return null;
}

export async function recordManualDelivery(
  supabase: SupabaseClient,
  input: ManualDeliveryInput,
): Promise<{ orderId: string }> {
  const validationError = validateManualDeliveryInput(input);
  if (validationError) throw new Error(validationError);

  let template: ProductTemplate | null = null;
  if (input.productId) {
    const { data, error } = await supabase
      .from("products")
      .select("id,name,brand_id,model_code,product_condition,product_region,price,purchase_price")
      .eq("id", input.productId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Продуктът не е намерен.");
    template = data as ProductTemplate;
  }

  const productName = (template?.name ?? input.productName).trim();
  const orderDate = input.orderDate.trim();

  const purchasePrice =
    input.purchasePrice != null && Number.isFinite(input.purchasePrice) && input.purchasePrice >= 0
      ? input.purchasePrice
      : template?.purchase_price != null && Number.isFinite(Number(template.purchase_price))
        ? Number(template.purchase_price)
        : null;

  const agreedPrice =
    input.agreedPrice != null && Number.isFinite(input.agreedPrice) && input.agreedPrice >= 0
      ? input.agreedPrice
      : template?.price != null && Number.isFinite(Number(template.price))
        ? Number(template.price)
        : null;

  const productCondition =
    (template?.product_condition === "new" || template?.product_condition === "used"
      ? template.product_condition
      : null) ?? input.productCondition;

  const workItemPayload: Record<string, unknown> = {
    type: "sale",
    event_code: "supplier_order",
    title: `Поръчка от доставчик: ${productName}`,
    status: "planned",
    priority: "medium",
    due_date: orderDate,
    completed_at: null,
    product_id: template?.id ?? null,
    order_product_condition: productCondition,
    contact_id: input.contactId ?? null,
    customer_name: input.customerName?.trim() || null,
    customer_phone: input.customerPhone?.trim() || null,
    customer_address: input.customerAddress?.trim() || null,
    notes: input.notes?.trim() || null,
    quantity: 1,
    unit_price: agreedPrice,
    total_amount: agreedPrice,
    purchase_price: purchasePrice,
    supplier_name: input.supplierName?.trim() || null,
    supplier_invoice_number: null,
    created_by: input.createdBy,
  };

  const { data: orderRow, error: orderErr } = await supabase
    .from("work_items")
    .insert(workItemPayload)
    .select("id")
    .single();
  if (orderErr) throw new Error(orderErr.message);

  return { orderId: orderRow.id as string };
}
