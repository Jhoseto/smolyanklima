/**
 * Запис на продажба (+ опционален монтаж).
 * Използва се от панела поръчки и от products page.
 */

export type RecordSaleCustomer = {
  id?: string;
  name: string;
  phone: string;
  address: string;
  email?: string;
  notes: string;
};

export type RecordSaleMount = {
  date: string;
  timeFrom: string;
  timeTo: string;
};

export type RecordSaleProduct = {
  id: string;
  name: string;
  price: number;
  model_code?: string | null;
  stock_status: string;
  stock_quantity?: number;
  sold_quantity?: number;
  brand_id?: string | null;
};

export type RecordProductSaleOptions = {
  /** По подразбиране true — създава и монтаж в календара. */
  withInstallation?: boolean;
  salePrice?: number;
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

function stockStatusAfterSale(
  priorStatus: string,
  hasModelCode: boolean,
  nextQty: number,
): string | undefined {
  if (priorStatus !== "in_stock") return undefined;
  if (hasModelCode) return "out_of_stock";
  return nextQty <= 0 ? "out_of_stock" : "in_stock";
}

function saleNotes(customer: RecordSaleCustomer, extra?: string | null): string | null {
  const parts = [customer.notes.trim() || null, extra?.trim() || null].filter(Boolean) as string[];
  return parts.length ? parts.join("\n\n") : null;
}

async function adminPostWorkItem(body: Record<string, unknown>): Promise<{
  id: string;
  protocol_warning?: string;
}> {
  const res = await fetch("/api/admin/work-items", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as {
    error?: string;
    data?: { id: string };
    protocol_warning?: string;
  };
  if (!res.ok) throw new Error(json.error || "Грешка при създаване на задача");
  if (!json.data?.id) throw new Error("Липсва ID на задача");
  return { id: json.data.id, protocol_warning: json.protocol_warning };
}

async function adminPatchWorkItem(itemId: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/admin/work-items/${itemId}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error || "Грешка при обновяване на задача");
}

async function adminDeleteWorkItem(itemId: string): Promise<void> {
  await fetch(`/api/admin/work-items/${itemId}`, { method: "DELETE", credentials: "include" });
}

async function applyProductStockAfterSale(prod: RecordSaleProduct, putBody: Record<string, unknown>): Promise<void> {
  const res = await fetch(`/api/admin/products/${prod.id}`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(putBody),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error || "Грешка при маркиране на продажба в склада");
}

export function canRecordProductSale(stockStatus: string): boolean {
  return stockStatus === "in_stock" || stockStatus === "on_order";
}

export async function recordProductSale(
  prod: RecordSaleProduct,
  customer: RecordSaleCustomer,
  mount: RecordSaleMount | null,
  options?: RecordProductSaleOptions,
): Promise<void> {
  if (!canRecordProductSale(prod.stock_status)) {
    throw new Error("Продажбата не е възможна за този статус на склада.");
  }

  const withInstallation = options?.withInstallation !== false;
  const unitPrice =
    options?.salePrice != null && Number.isFinite(options.salePrice) && options.salePrice >= 0
      ? options.salePrice
      : Number(prod.price);

  const hasModelCode = Boolean((prod.model_code ?? "").trim());
  const currentQty = Math.max(0, Number(prod.stock_quantity ?? 0));
  const nextSold = Math.max(0, Number(prod.sold_quantity ?? 0) + 1);
  const nextQty = Math.max(0, currentQty - 1);

  const putBody: Record<string, unknown> = { soldQuantity: nextSold };
  if (!hasModelCode) putBody.stockQuantity = nextQty;
  const nextStockStatus = stockStatusAfterSale(prod.stock_status, hasModelCode, nextQty);
  if (nextStockStatus !== undefined) putBody.stockStatus = nextStockStatus;

  let saleId: string | null = null;
  let installId: string | null = null;

  try {
    if (!withInstallation) {
      const today = new Date().toISOString().slice(0, 10);
      const saleRow = await adminPostWorkItem({
        type: "sale",
        eventCode: "sale",
        title: `Продажба: ${prod.name}`,
        status: "done",
        priority: "medium",
        dueDate: today,
        saleInstallState: "completed",
        productId: prod.id,
        contactId: customer.id || null,
        customerName: customer.name || null,
        customerPhone: customer.phone || null,
        customerAddress: customer.address || null,
        notes: saleNotes(customer, "Продажба без монтаж"),
        quantity: 1,
        unitPrice,
        totalAmount: unitPrice,
      });
      saleId = saleRow.id;
      await applyProductStockAfterSale(prod, putBody);
      return;
    }

    const mountDate = (mount?.date ?? "").trim();
    if (!mountDate) throw new Error("Посочете дата за монтаж.");

    const schedStart = toIsoFromDateAndTimeLocal(mountDate, mount?.timeFrom);
    let schedEnd = toIsoFromDateAndTimeLocal(mountDate, mount?.timeTo);
    if (schedStart && schedEnd && new Date(schedEnd) < new Date(schedStart)) {
      schedEnd = schedStart;
    }

    const saleRow = await adminPostWorkItem({
      type: "sale",
      eventCode: "sale",
      title: `Продажба: ${prod.name}`,
      status: "planned",
      priority: "medium",
      dueDate: mountDate,
      saleInstallState: "pending_mount",
      productId: prod.id,
      contactId: customer.id || null,
      customerName: customer.name || null,
      customerPhone: customer.phone || null,
      customerAddress: customer.address || null,
      notes: saleNotes(customer),
      quantity: 1,
      unitPrice,
      totalAmount: unitPrice,
    });
    saleId = saleRow.id;

    const noteLines = [customer.notes.trim() || null, `Връзка продажба: ${saleId}`].filter(Boolean) as string[];
    const inst = await adminPostWorkItem({
      type: "service",
      eventCode: "service_installation",
      title: `Монтаж: ${prod.name}`,
      status: "planned",
      priority: "medium",
      dueDate: mountDate,
      scheduledStart: schedStart,
      scheduledEnd: schedEnd,
      productId: prod.id,
      contactId: customer.id || null,
      customerName: customer.name || null,
      customerPhone: customer.phone || null,
      customerAddress: customer.address || null,
      notes: noteLines.join("\n\n") || null,
      saleWorkItemId: saleId,
      quantity: 1,
    });
    installId = inst.id;
    await adminPatchWorkItem(saleId, { installationWorkItemId: installId });
    await applyProductStockAfterSale(prod, putBody);
  } catch (e) {
    if (installId) void adminDeleteWorkItem(installId);
    if (saleId) void adminDeleteWorkItem(saleId);
    throw e;
  }
}
