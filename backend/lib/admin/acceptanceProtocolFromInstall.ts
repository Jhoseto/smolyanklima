import type { SupabaseClient } from "@supabase/supabase-js";
import { logAdminActivity } from "@/lib/admin/audit";
import { combineUnitSerials } from "@/lib/protocol-contact-fields";

type Db = SupabaseClient;

type InstallRow = {
  id: string;
  event_code?: string | null;
  due_date?: string | null;
  product_id?: string | null;
  contact_id?: string | null;
  sale_work_item_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_address?: string | null;
  status?: string | null;
};

type ProductRow = {
  name?: string | null;
  indoor_unit_serial?: string | null;
  outdoor_unit_serial?: string | null;
  brands?: { name?: string | null } | { name?: string | null }[] | null;
};

type ContactRow = {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
};

type SaleRow = {
  total_amount?: number | null;
  unit_price?: number | null;
};

export type LinkedAcceptanceProtocol = {
  id: string;
  protocol_number: string;
  status: string;
  date: string | null;
};

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function protocolPhone(raw: string | null | undefined): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 15) return null;
  return digits;
}

function protocolDateFromWorkItem(dueDate: string | null | undefined): string {
  const raw = String(dueDate ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return new Date().toISOString().slice(0, 10);
}

function formatAcModel(product: ProductRow | null): string | null {
  if (!product?.name) return null;
  const brand = asOne(product.brands)?.name?.trim();
  const name = product.name.trim();
  if (!brand) return name;
  if (name.toLowerCase().startsWith(brand.toLowerCase())) return name;
  return `${brand} ${name}`;
}

function isMissingColumnError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return error.code === "42703" || error.code === "PGRST204" || msg.includes("does not exist");
}

function isStatusCheckError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return msg.includes("service_protocols_status_check") || (msg.includes("status") && msg.includes("check constraint"));
}

async function nextProtocolNumber(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const { count, error } = await db.from("service_protocols").select("*", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  const seq = (count ?? 0) + 1;
  return `SK-${year}${String(seq).padStart(3, "0")}`;
}

async function loadInstallContext(db: Db, installWorkItemId: string) {
  const { data: install, error: installErr } = await db
    .from("work_items")
    .select(
      "id,event_code,due_date,product_id,contact_id,sale_work_item_id,customer_name,customer_phone,customer_address,status",
    )
    .eq("id", installWorkItemId)
    .maybeSingle();
  if (installErr) throw new Error(installErr.message);
  if (!install) throw new Error("Монтажът не е намерен.");
  const row = install as InstallRow;
  if (row.event_code !== "service_installation") {
    throw new Error("Задачата не е монтаж.");
  }

  let product: ProductRow | null = null;
  if (row.product_id) {
    const { data: p } = await db
      .from("products")
      .select("name,indoor_unit_serial,outdoor_unit_serial,brands:brand_id(name)")
      .eq("id", row.product_id)
      .maybeSingle();
    product = (p as ProductRow | null) ?? null;
  }

  let contact: ContactRow | null = null;
  if (row.contact_id) {
    const { data: c } = await db
      .from("contacts")
      .select("full_name,phone,email,address")
      .eq("id", row.contact_id)
      .maybeSingle();
    contact = (c as ContactRow | null) ?? null;
  }

  let sale: SaleRow | null = null;
  if (row.sale_work_item_id) {
    const { data: s } = await db
      .from("work_items")
      .select("total_amount,unit_price")
      .eq("id", row.sale_work_item_id)
      .maybeSingle();
    sale = (s as SaleRow | null) ?? null;
  }

  return { install: row, product, contact, sale };
}

function buildPageOneFields(ctx: Awaited<ReturnType<typeof loadInstallContext>>) {
  const { install, product, contact, sale } = ctx;
  const clientName = install.customer_name?.trim() || contact?.full_name?.trim() || null;
  const clientPhone = protocolPhone(install.customer_phone ?? contact?.phone);
  const clientEmail = contact?.email?.trim() || null;
  const address = install.customer_address?.trim() || contact?.address?.trim() || null;
  const indoor = product?.indoor_unit_serial?.trim() || null;
  const outdoor = product?.outdoor_unit_serial?.trim() || null;
  const paidRaw = sale?.total_amount ?? sale?.unit_price ?? null;
  const paidAmount =
    paidRaw != null && Number.isFinite(Number(paidRaw)) ? Number(paidRaw) : null;

  return {
    work_item_id: install.id,
    date: protocolDateFromWorkItem(install.due_date),
    client_name: clientName,
    client_phone: clientPhone,
    client_email: clientEmail,
    address,
    ac_model: formatAcModel(product),
    indoor_unit_serial: indoor,
    outdoor_unit_serial: outdoor,
    serial_number: combineUnitSerials(indoor, outdoor),
    paid_amount: paidAmount,
    mount_types: [] as string[],
    materials: [] as unknown[],
    cable_channels_m: 0,
    accessories: {} as Record<string, number>,
    notes: null as string | null,
    signature_team: null as string | null,
    signature_client: null as string | null,
  };
}

function buildProtocolInsertPayload(
  ctx: Awaited<ReturnType<typeof loadInstallContext>>,
  protocolNumber: string,
  createdBy: string | null,
  status: "prepared" | "draft" = "prepared",
) {
  const pageOne = buildPageOneFields(ctx);
  return {
    protocol_number: protocolNumber,
    created_by: createdBy,
    status,
    ...pageOne,
  };
}

async function insertProtocolRow(
  db: Db,
  payload: ReturnType<typeof buildProtocolInsertPayload>,
): Promise<LinkedAcceptanceProtocol> {
  let attemptPayload: Record<string, unknown> = { ...payload };
  let lastError: { code?: string; message?: string } | null = null;

  for (let i = 0; i < 4; i += 1) {
    const { data, error } = await db
      .from("service_protocols")
      .insert(attemptPayload)
      .select("id,protocol_number,status,date")
      .single();

    if (!error && data) return data as LinkedAcceptanceProtocol;
    lastError = error;

    if (isStatusCheckError(error) && attemptPayload.status === "prepared") {
      attemptPayload = { ...attemptPayload, status: "draft" };
      continue;
    }

    if (isMissingColumnError(error)) {
      const next = { ...attemptPayload };
      delete next.indoor_unit_serial;
      delete next.outdoor_unit_serial;
      attemptPayload = next;
      continue;
    }

    break;
  }

  throw new Error(lastError?.message ?? "Неуспешно създаване на протокол.");
}

export function shouldAutoCreateAcceptanceProtocol(install: InstallRow): boolean {
  return (
    install.event_code === "service_installation" &&
    install.status !== "cancelled" &&
    Boolean(install.sale_work_item_id)
  );
}

export async function findAcceptanceProtocolByWorkItem(
  db: Db,
  installWorkItemId: string,
): Promise<LinkedAcceptanceProtocol | null> {
  const { data, error } = await db
    .from("service_protocols")
    .select("id,protocol_number,status,date")
    .eq("work_item_id", installWorkItemId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as LinkedAcceptanceProtocol;
}

/** Idempotent: създава чернова протокол за монтаж от продажба, ако липсва. */
export async function ensureAcceptanceProtocolForInstallation(
  db: Db,
  installWorkItemId: string,
  createdBy: string | null,
): Promise<LinkedAcceptanceProtocol | null> {
  const existing = await findAcceptanceProtocolByWorkItem(db, installWorkItemId);
  if (existing) return existing;

  const ctx = await loadInstallContext(db, installWorkItemId);
  if (!shouldAutoCreateAcceptanceProtocol(ctx.install)) return null;

  const protocolNumber = await nextProtocolNumber(db);
  const payload = buildProtocolInsertPayload(ctx, protocolNumber, createdBy);
  const data = await insertProtocolRow(db, payload);

  await logAdminActivity({
    action: "service_protocol.create",
    entityType: "service_protocol",
    entityId: data.id,
    details: {
      protocol_number: data.protocol_number,
      client_name: payload.client_name ?? null,
      status: data.status,
      source: "sale_installation",
      work_item_id: installWorkItemId,
    },
  });

  return data;
}

/** Изтрива протокола за монтаж при отказ на продажба/монтаж (не трие подписани). */
export async function deleteAcceptanceProtocolForInstallation(
  db: Db,
  installWorkItemId: string,
  reason: "sale_cancelled" | "install_cancelled" = "sale_cancelled",
): Promise<boolean> {
  const existing = await findAcceptanceProtocolByWorkItem(db, installWorkItemId);
  if (!existing) return false;
  if (existing.status === "signed") return false;

  const { data: row } = await db
    .from("service_protocols")
    .select("protocol_number, client_name")
    .eq("id", existing.id)
    .maybeSingle();

  const { error } = await db.from("service_protocols").delete().eq("id", existing.id);
  if (error) throw new Error(error.message);

  await logAdminActivity({
    action: "service_protocol.delete",
    entityType: "service_protocol",
    entityId: existing.id,
    details: {
      protocol_number: (row as { protocol_number?: string } | null)?.protocol_number ?? existing.protocol_number,
      client_name: (row as { client_name?: string } | null)?.client_name ?? null,
      source: reason,
      work_item_id: installWorkItemId,
    },
  });

  return true;
}

/** Синхронизира дата и клиентски данни от монтажа към протокола (само prepared/in_progress/draft). */
export async function syncAcceptanceProtocolFromInstallation(
  db: Db,
  installWorkItemId: string,
): Promise<void> {
  const existing = await findAcceptanceProtocolByWorkItem(db, installWorkItemId);
  if (!existing) return;
  if (existing.status === "signed") return;

  const ctx = await loadInstallContext(db, installWorkItemId);
  if (ctx.install.status === "cancelled") return;
  const pageOne = buildPageOneFields(ctx);

  const { error } = await db
    .from("service_protocols")
    .update({
      date: pageOne.date,
      client_name: pageOne.client_name,
      client_phone: pageOne.client_phone,
      client_email: pageOne.client_email,
      address: pageOne.address,
      ac_model: pageOne.ac_model,
      indoor_unit_serial: pageOne.indoor_unit_serial,
      outdoor_unit_serial: pageOne.outdoor_unit_serial,
      serial_number: pageOne.serial_number,
      paid_amount: pageOne.paid_amount,
    })
    .eq("id", existing.id);

  if (error && isMissingColumnError(error)) {
    const rest = {
      date: pageOne.date,
      client_name: pageOne.client_name,
      client_phone: pageOne.client_phone,
      client_email: pageOne.client_email,
      address: pageOne.address,
      ac_model: pageOne.ac_model,
      serial_number: pageOne.serial_number,
      paid_amount: pageOne.paid_amount,
    };
    const { error: retryErr } = await db.from("service_protocols").update(rest).eq("id", existing.id);
    if (retryErr) throw new Error(retryErr.message);
    return;
  }

  if (error) throw new Error(error.message);
}
