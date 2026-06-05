import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAcceptanceProtocolForInstallation } from "@/lib/admin/acceptanceProtocolFromInstall";

export type ManualSaleInput = {
  productId?: string | null;
  productName: string;
  saleProductCondition?: "new" | "used" | null;
  contactId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  notes?: string | null;
  saleDate: string;
  salePrice: number;
  purchasePrice?: number | null;
  supplierName?: string | null;
  supplierInvoiceNumber?: string | null;
  saleInstallState: "pending_mount" | "completed";
  withInstallation?: boolean;
  mountDate?: string | null;
  mountTimeFrom?: string | null;
  mountTimeTo?: string | null;
  /** Бележка само за задачата „Монтаж“ в календара (не в продажбата). */
  mountNotes?: string | null;
  updateStock?: boolean;
  createdBy: string;
};

function buildInstallationNotes(
  saleId: string,
  mountNotes: string | null | undefined,
  saleNotes: string | null | undefined,
): string | null {
  const parts = [
    mountNotes?.trim() ? `Бележка към монтажа: ${mountNotes.trim()}` : null,
    saleNotes?.trim() || null,
    `Връзка продажба: ${saleId}`,
  ].filter(Boolean) as string[];
  return parts.length ? parts.join("\n\n") : null;
}

type ProductRow = {
  id: string;
  name: string;
  model_code: string | null;
  price: number;
  purchase_price: number | null;
  supplier_invoice_number: string | null;
  stock_status: string;
  stock_quantity: number | null;
  sold_quantity: number | null;
  product_condition: string | null;
  suppliers: { name: string | null } | { name: string | null }[] | null;
};

function toIsoFromDateAndTimeLocal(dateStr: string, timeStr: string | undefined | null): string | null {
  const d0 = (dateStr ?? "").trim();
  if (!d0) return null;
  const rawT = (timeStr ?? "").trim();
  const time = rawT.length >= 4 ? rawT : "09:00";
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const min = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  const d = new Date(`${d0}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function completedAtFromSaleDate(saleDate: string): string {
  const d = new Date(`${saleDate.trim()}T12:00:00`);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function stockStatusAfterSale(priorStatus: string, hasModelCode: boolean, nextQty: number): string | undefined {
  if (priorStatus !== "in_stock") return undefined;
  if (hasModelCode) return "out_of_stock";
  return nextQty <= 0 ? "out_of_stock" : "in_stock";
}

export function validateManualSaleInput(input: ManualSaleInput): string | null {
  const name = input.productName.trim();
  if (!input.productId && name.length < 2) {
    return "Въведете име на продукта или изберете от каталога.";
  }
  if (!input.productId && !input.saleProductCondition) {
    return "Посочете категория: нови или втора употреба.";
  }
  if (!input.saleDate.trim()) return "Посочете дата на продажбата.";
  if (!Number.isFinite(input.salePrice) || input.salePrice < 0) return "Въведете валидна продажна цена.";
  const withInstallation = input.withInstallation === true && input.saleInstallState === "pending_mount";
  if (withInstallation && !input.mountDate?.trim()) return "Посочете дата за монтаж.";
  if (!input.customerName?.trim() && !input.customerPhone?.trim()) {
    return "Въведете поне име или телефон на клиента.";
  }
  return null;
}

export async function recordManualSale(
  supabase: SupabaseClient,
  input: ManualSaleInput,
): Promise<{ saleId: string; installId?: string; protocolWarning?: string }> {
  const validationError = validateManualSaleInput(input);
  if (validationError) throw new Error(validationError);

  let product: ProductRow | null = null;
  if (input.productId) {
    const { data, error } = await supabase
      .from("products")
      .select(
        "id,name,model_code,price,purchase_price,supplier_invoice_number,stock_status,stock_quantity,sold_quantity,product_condition,suppliers:supplier_id(name)",
      )
      .eq("id", input.productId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Продуктът не е намерен.");
    product = data as unknown as ProductRow;
  }

  const productName = (product?.name ?? input.productName).trim();
  const saleDate = input.saleDate.trim();
  const withInstallation = input.withInstallation === true && input.saleInstallState === "pending_mount";
  const mountDate = withInstallation ? (input.mountDate?.trim() ?? "") : "";
  if (withInstallation && !mountDate) throw new Error("Посочете дата за монтаж.");
  const unitPrice = input.salePrice;
  const purchasePrice =
    input.purchasePrice != null && Number.isFinite(input.purchasePrice) && input.purchasePrice >= 0
      ? input.purchasePrice
      : product?.purchase_price != null && Number.isFinite(Number(product.purchase_price))
        ? Number(product.purchase_price)
        : null;
  const supplierFromProduct = product?.suppliers;
  const supplierRow = Array.isArray(supplierFromProduct) ? supplierFromProduct[0] : supplierFromProduct;
  const supplierName =
    input.supplierName?.trim() ||
    (supplierRow?.name?.trim() ?? null) ||
    null;
  const supplierInvoice =
    input.supplierInvoiceNumber?.trim() ||
    product?.supplier_invoice_number?.trim() ||
    null;

  const saleStatus = withInstallation ? "planned" : "done";
  const completedAt = withInstallation ? null : completedAtFromSaleDate(saleDate);
  const eurRecordedAt = new Date().toISOString();

  const salePayload: Record<string, unknown> = {
    type: "sale",
    event_code: "sale",
    title: `Продажба: ${productName}`,
    status: saleStatus,
    priority: "medium",
    due_date: saleDate,
    completed_at: completedAt,
    sale_install_state: input.saleInstallState,
    product_id: product?.id ?? null,
    sale_product_condition:
      (product?.product_condition === "new" || product?.product_condition === "used"
        ? product.product_condition
        : null) ??
      input.saleProductCondition ??
      null,
    contact_id: input.contactId ?? null,
    customer_name: input.customerName?.trim() || null,
    customer_phone: input.customerPhone?.trim() || null,
    customer_address: input.customerAddress?.trim() || null,
    notes: input.notes?.trim() || null,
    quantity: 1,
    unit_price: unitPrice,
    total_amount: unitPrice,
    purchase_price: purchasePrice,
    supplier_name: supplierName,
    supplier_invoice_number: supplierInvoice,
    amounts_converted_from_bgn_at: eurRecordedAt,
    created_by: input.createdBy,
  };

  let saleId: string | null = null;
  let installId: string | null = null;
  let protocolWarning: string | undefined;

  try {
    const { data: saleRow, error: saleErr } = await supabase.from("work_items").insert(salePayload).select("id").single();
    if (saleErr) throw new Error(saleErr.message);
    saleId = saleRow.id as string;

    if (withInstallation) {
      const schedStart = toIsoFromDateAndTimeLocal(mountDate, input.mountTimeFrom);
      let schedEnd = toIsoFromDateAndTimeLocal(mountDate, input.mountTimeTo);
      if (schedStart && schedEnd && new Date(schedEnd) < new Date(schedStart)) {
        schedEnd = schedStart;
      }

      const installPayload: Record<string, unknown> = {
        type: "service",
        event_code: "service_installation",
        title: `Монтаж: ${productName}`,
        status: "planned",
        priority: "medium",
        due_date: mountDate,
        scheduled_start: schedStart,
        scheduled_end: schedEnd,
        product_id: product?.id ?? null,
        contact_id: input.contactId ?? null,
        customer_name: input.customerName?.trim() || null,
        customer_phone: input.customerPhone?.trim() || null,
        customer_address: input.customerAddress?.trim() || null,
        notes: buildInstallationNotes(saleId, input.mountNotes, input.notes),
        sale_work_item_id: saleId,
        quantity: 1,
        created_by: input.createdBy,
      };

      const { data: instRow, error: instErr } = await supabase.from("work_items").insert(installPayload).select("id").single();
      if (instErr) throw new Error(instErr.message);
      installId = instRow.id as string;

      const { error: linkErr } = await supabase
        .from("work_items")
        .update({ installation_work_item_id: installId })
        .eq("id", saleId);
      if (linkErr) throw new Error(linkErr.message);

      try {
        await ensureAcceptanceProtocolForInstallation(supabase, installId, input.createdBy);
      } catch (e: unknown) {
        protocolWarning = e instanceof Error ? e.message : String(e);
        console.error("[recordManualSale] acceptance protocol create failed:", protocolWarning);
      }
    }

    if (product && input.updateStock && (product.stock_status === "in_stock" || product.stock_status === "on_order")) {
      const hasModelCode = Boolean((product.model_code ?? "").trim());
      const currentQty = Math.max(0, Number(product.stock_quantity ?? 0));
      const nextSold = Math.max(0, Number(product.sold_quantity ?? 0) + 1);
      const nextQty = Math.max(0, currentQty - 1);
      const patch: Record<string, unknown> = { sold_quantity: nextSold };
      if (!hasModelCode) patch.stock_quantity = nextQty;
      const nextStockStatus = stockStatusAfterSale(product.stock_status, hasModelCode, nextQty);
      if (nextStockStatus !== undefined) patch.stock_status = nextStockStatus;
      const { error: stockErr } = await supabase.from("products").update(patch).eq("id", product.id);
      if (stockErr) throw new Error(stockErr.message);
    }

    return { saleId, installId: installId ?? undefined, protocolWarning };
  } catch (e) {
    if (installId) await supabase.from("work_items").delete().eq("id", installId);
    if (saleId) await supabase.from("work_items").delete().eq("id", saleId);
    throw e;
  }
}
