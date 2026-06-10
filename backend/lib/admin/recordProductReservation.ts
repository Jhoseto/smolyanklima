import type { SupabaseClient } from "@supabase/supabase-js";
import { adminLocalDateKey } from "@/lib/admin/localDateKey";
import { restoreProductStockAfterReservationCancel } from "@/lib/admin/restoreProductStockAfterReservationCancel";

export type ProductReservationInput = {
  productId: string;
  contactId?: string | null;
  customerName: string;
  customerPhone: string;
  customerAddress?: string | null;
  notes?: string | null;
  agreedPrice?: number | null;
  reservationDate?: string | null;
  createdBy: string;
};

type ActiveReservationRow = {
  id: string;
  product_id: string | null;
  status: string;
};

export function canReserveProduct(stockStatus: string | null | undefined): boolean {
  return stockStatus === "in_stock";
}

export async function findActiveProductReservation(
  db: SupabaseClient,
  productId: string,
): Promise<ActiveReservationRow | null> {
  const { data, error } = await db
    .from("work_items")
    .select("id,product_id,status")
    .eq("event_code", "reservation")
    .eq("product_id", productId)
    .in("status", ["planned", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as ActiveReservationRow | null) ?? null;
}

export async function recordProductReservation(
  db: SupabaseClient,
  input: ProductReservationInput,
): Promise<{ reservationId: string }> {
  const customerName = input.customerName.trim();
  const customerPhone = input.customerPhone.trim();
  if (customerName.length < 2) throw new Error("Посочете име на клиента.");
  if (customerPhone.length < 6) throw new Error("Посочете телефон на клиента.");

  const { data: product, error: prodErr } = await db
    .from("products")
    .select("id,name,stock_status,price")
    .eq("id", input.productId)
    .maybeSingle();
  if (prodErr) throw new Error(prodErr.message);
  if (!product) throw new Error("Продуктът не е намерен.");
  if (!canReserveProduct((product as { stock_status?: string }).stock_status)) {
    throw new Error('Само продукти „В наличност“ могат да се резервират.');
  }

  const existing = await findActiveProductReservation(db, input.productId);
  if (existing) throw new Error("Продуктът вече има активна резервация.");

  const productName = String((product as { name?: string }).name ?? "").trim() || "Продукт";
  const catalogPrice = Number((product as { price?: number | null }).price);
  const unitPrice =
    input.agreedPrice != null && Number.isFinite(input.agreedPrice) && input.agreedPrice >= 0
      ? input.agreedPrice
      : Number.isFinite(catalogPrice) && catalogPrice >= 0
        ? catalogPrice
        : null;

  const reservationDate =
    input.reservationDate?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(input.reservationDate.trim())
      ? input.reservationDate.trim()
      : adminLocalDateKey();

  const workItemPayload: Record<string, unknown> = {
    type: "sale",
    event_code: "reservation",
    title: `Резервация: ${productName}`,
    status: "planned",
    priority: "medium",
    due_date: reservationDate,
    completed_at: null,
    product_id: input.productId,
    contact_id: input.contactId ?? null,
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_address: input.customerAddress?.trim() || null,
    notes: input.notes?.trim() || null,
    quantity: 1,
    unit_price: unitPrice,
    total_amount: unitPrice,
    created_by: input.createdBy,
  };

  const { data: reservationRow, error: insertErr } = await db
    .from("work_items")
    .insert(workItemPayload)
    .select("id")
    .single();
  if (insertErr) throw new Error(insertErr.message);

  const reservationId = String(reservationRow.id);
  const { error: stockErr } = await db
    .from("products")
    .update({ stock_status: "reserved" })
    .eq("id", input.productId)
    .eq("stock_status", "in_stock");
  if (stockErr) {
    await db.from("work_items").delete().eq("id", reservationId);
    throw new Error(stockErr.message);
  }

  return { reservationId };
}

export async function cancelProductReservation(
  db: SupabaseClient,
  opts: { workItemId?: string | null; productId?: string | null },
): Promise<{ reservationId: string; productId: string; restored: boolean }> {
  let reservation: ActiveReservationRow | null = null;

  if (opts.workItemId) {
    const { data, error } = await db
      .from("work_items")
      .select("id,product_id,status")
      .eq("id", opts.workItemId)
      .eq("event_code", "reservation")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Резервацията не е намерена.");
    if (data.status === "cancelled") throw new Error("Резервацията вече е отменена.");
    if (data.status === "done") throw new Error("Завършена резервация не може да се отмени от тук.");
    reservation = data as ActiveReservationRow;
  } else if (opts.productId) {
    reservation = await findActiveProductReservation(db, opts.productId);
    if (!reservation) throw new Error("Няма активна резервация за този продукт.");
  } else {
    throw new Error("Посочете продукт или резервация.");
  }

  const productId = reservation.product_id;
  if (!productId) throw new Error("Резервацията няма свързан продукт.");

  const { error: cancelErr } = await db
    .from("work_items")
    .update({ status: "cancelled", completed_at: null })
    .eq("id", reservation.id);
  if (cancelErr) throw new Error(cancelErr.message);

  const { restored } = await restoreProductStockAfterReservationCancel(db, productId);
  return { reservationId: reservation.id, productId, restored };
}
