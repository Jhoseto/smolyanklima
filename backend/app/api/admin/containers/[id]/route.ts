import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
import {
  CONTAINER_OPTIONAL_COLUMNS,
  buildContainerSelect,
  type ContainerDbRow,
  type PgError,
} from "@/lib/admin/containerOptionalColumns";

const numericField = () =>
  z
    .union([z.coerce.number(), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v));

const UpdateSchema = z.object({
  arrivalDate: z.string().max(32).optional().nullable(),
  supplierName: z.string().max(255).optional().nullable(),
  departureDate: z.string().max(32).optional().nullable(),
  customsDuty: numericField(),
  vatAmount: numericField(),
  japanPrice: numericField(),
  transportToBulgaria: numericField(),
  transportToSmolyan: numericField(),
  notes: z.string().max(4000).optional().nullable(),
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
  const supabase = session.db;

  async function runGet(columns: readonly string[]) {
    const res = await supabase.from("containers").select(buildContainerSelect(columns)).eq("id", id).maybeSingle();
    return { data: res.data as ContainerDbRow | null, error: res.error as PgError };
  }

  let columns: readonly string[] = CONTAINER_OPTIONAL_COLUMNS;
  let result = await runGet(columns);
  while (result.error) {
    const missing = columns.find((c) => isPostgrestMissingColumn(result.error, c));
    if (!missing) break;
    columns = columns.filter((c) => c !== missing);
    result = await runGet(columns);
  }
  const { data, error } = result;
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) return withCors(req, NextResponse.json({ error: "Контейнерът не е намерен" }, { status: 404 }));

  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("container_id", id);

  return withCors(req, NextResponse.json({ data: { ...data, product_count: count ?? 0 } }));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни данни" }, { status: 400 }));

  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право да редактирате контейнери." }, { status: 403 }));
  }

  const supabase = session.db;
  const payload: Record<string, unknown> = {};
  if ("arrivalDate" in parsed.data) payload.arrival_date = parsed.data.arrivalDate?.trim() || null;
  if ("supplierName" in parsed.data) payload.supplier_name = parsed.data.supplierName?.trim() || null;
  if ("departureDate" in parsed.data) payload.departure_date = parsed.data.departureDate?.trim() || null;
  if ("customsDuty" in parsed.data) payload.customs_duty = parsed.data.customsDuty;
  if ("vatAmount" in parsed.data) payload.vat_amount = parsed.data.vatAmount;
  if ("japanPrice" in parsed.data) payload.japan_price = parsed.data.japanPrice;
  if ("transportToBulgaria" in parsed.data) payload.transport_to_bulgaria = parsed.data.transportToBulgaria;
  if ("transportToSmolyan" in parsed.data) payload.transport_to_smolyan = parsed.data.transportToSmolyan;
  if ("notes" in parsed.data) payload.notes = parsed.data.notes?.trim() || null;

  async function runUpdate(columns: readonly string[]) {
    const res = await supabase
      .from("containers")
      .update(payload)
      .eq("id", id)
      .select(buildContainerSelect(columns))
      .single();
    return { data: res.data as ContainerDbRow | null, error: res.error as PgError };
  }

  let columns: readonly string[] = CONTAINER_OPTIONAL_COLUMNS;
  let result = await runUpdate(columns);
  while (result.error) {
    const missing = CONTAINER_OPTIONAL_COLUMNS.find(
      (c) => c in payload && isPostgrestMissingColumn(result.error, c),
    );
    if (!missing) break;
    delete payload[missing];
    columns = columns.filter((c) => c !== missing);
    result = await runUpdate(columns);
  }
  const { data, error } = result;
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  await logAdminActivity({ action: "container.update", entityType: "container", entityId: id, details: payload });

  return withCors(req, NextResponse.json({ data }));
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
    return withCors(req, NextResponse.json({ error: "Нямате право да изтривате контейнери." }, { status: 403 }));
  }

  const supabase = session.db;
  const { count } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("container_id", id);
  if ((count ?? 0) > 0) {
    return withCors(
      req,
      NextResponse.json(
        {
          error: `Контейнерът съдържа ${count} климатик${count === 1 ? "" : "а"}. Преместете ги в друг контейнер или премахнете обвързването им, преди да изтриете контейнера.`,
        },
        { status: 409 },
      ),
    );
  }

  const { error } = await supabase.from("containers").delete().eq("id", id);
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  await logAdminActivity({ action: "container.delete", entityType: "container", entityId: id, details: {} });

  return withCors(req, NextResponse.json({ ok: true }));
}
