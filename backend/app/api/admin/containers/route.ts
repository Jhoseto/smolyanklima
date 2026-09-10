import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
import { listContainers } from "@/lib/admin/containerQueries";
import {
  CONTAINER_OPTIONAL_COLUMNS,
  buildContainerSelect,
  type ContainerDbRow,
  type PgError,
} from "@/lib/admin/containerOptionalColumns";

const QuerySchema = z.object({
  year: z.coerce.number().int().optional(),
  q: z.string().optional(),
  sortBy: z.enum(["name", "year", "arrival_date", "created_at"]).optional().default("year"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(500).optional().default(200),
});

const numericField = () =>
  z
    .union([z.coerce.number(), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v === "" || v === null || v === undefined ? null : v));

const CreateSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
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

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  let session;
  try {
    session = await adminSession();
    requireRole(session, "master_admin", "office_staff");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Неоторизиран достъп";
    const status = msg === "FORBIDDEN" ? 403 : 401;
    return withCors(req, NextResponse.json({ error: msg }, { status }));
  }

  const { year, q, sortBy, sortDir, page, perPage } = parsed.data;

  try {
    const { data, total } = await listContainers(session.db, { year, q, sortBy, sortDir, page, perPage });
    return withCors(req, NextResponse.json({ data, meta: { page, perPage, total } }));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Грешка при зареждане";
    return withCors(req, NextResponse.json({ error: message }, { status: 500 }));
  }
}

export async function POST(req: NextRequest) {
  const json = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const detail = first ? `${first.path.join(".") || "body"}: ${first.message}` : "Невалидни данни";
    return withCors(req, NextResponse.json({ error: detail }, { status: 400 }));
  }

  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }
  try {
    requireRole(session, "master_admin", "office_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Нямате право да създавате контейнери." }, { status: 403 }));
  }

  const supabase = session.db;
  const {
    year,
    arrivalDate,
    supplierName,
    departureDate,
    customsDuty,
    vatAmount,
    japanPrice,
    transportToBulgaria,
    transportToSmolyan,
    notes,
  } = parsed.data;

  const { data: existing, error: seqErr } = await supabase
    .from("containers")
    .select("sequence_in_year")
    .eq("year", year)
    .order("sequence_in_year", { ascending: false })
    .limit(1);
  if (seqErr) return withCors(req, NextResponse.json({ error: seqErr.message }, { status: 500 }));

  const nextSeq = ((existing?.[0]?.sequence_in_year as number | undefined) ?? 0) + 1;
  const name = nextSeq <= 1 ? `Контейнер ${year}` : `Контейнер ${year}-${nextSeq}`;

  const payload: Record<string, unknown> = {
    name,
    year,
    sequence_in_year: nextSeq,
    arrival_date: arrivalDate?.trim() || null,
    supplier_name: supplierName?.trim() || null,
    departure_date: departureDate?.trim() || null,
    customs_duty: customsDuty,
    vat_amount: vatAmount,
    japan_price: japanPrice,
    transport_to_bulgaria: transportToBulgaria,
    transport_to_smolyan: transportToSmolyan,
    notes: notes?.trim() || null,
  };

  async function runInsert(columns: readonly string[]) {
    const res = await supabase.from("containers").insert(payload).select(buildContainerSelect(columns)).single();
    return { data: res.data as ContainerDbRow | null, error: res.error as PgError };
  }

  let columns: readonly string[] = CONTAINER_OPTIONAL_COLUMNS;
  let insertResult = await runInsert(columns);
  while (insertResult.error) {
    const missing = CONTAINER_OPTIONAL_COLUMNS.find(
      (c) => c in payload && isPostgrestMissingColumn(insertResult.error, c),
    );
    if (!missing) break;
    delete payload[missing];
    columns = columns.filter((c) => c !== missing);
    insertResult = await runInsert(columns);
  }
  const { data, error } = insertResult;

  if (error || !data) return withCors(req, NextResponse.json({ error: error?.message ?? "Грешка при създаване" }, { status: 500 }));

  await logAdminActivity({
    action: "container.create",
    entityType: "container",
    entityId: data.id,
    details: { name, year, sequence_in_year: nextSeq },
  });

  return withCors(req, NextResponse.json({ data: { ...data, product_count: 0 } }, { status: 201 }));
}
