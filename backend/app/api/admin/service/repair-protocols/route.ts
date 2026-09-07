/**
 * /api/admin/service/repair-protocols
 *
 * GET  → списък със сервизни (профилактика/ремонт) протоколи.
 * POST → създаване на нов сервизен протокол.
 *
 * Различен от `/api/admin/service/protocols` (приемно-предавателен).
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { applyAdminRepairProtocolSearchFilter } from "@/lib/admin/productSearchFilter";
import { applyRecycleSerialsToProduct } from "@/lib/admin/recycleProtocolProductLink";
import { combineLegacySerialField } from "@/lib/protocol-contact-fields";

const QuerySchema = z.object({
  page:     z.coerce.number().int().min(1).optional().default(1),
  perPage:  z.coerce.number().int().min(1).max(100).optional().default(20),
  status:   z.enum(["prepared", "in_progress", "signed"]).optional(),
  kind:     z.enum(["client", "recycle"]).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q:        z.string().optional(),
});

const CreateSchema = z.object({
  work_item_id:  z.string().uuid().optional().nullable(),
  date:          z.string().optional(),
  service_kind:  z.enum(["client", "recycle"]).optional().default("client"),

  client_name:   z.string().max(200).optional().nullable(),
  ac_brand:      z.string().max(120).optional().nullable(),
  ac_model:      z.string().max(200).optional().nullable(),
  serial_number: z.string().max(100).optional().nullable(),
  address:       z.string().max(500).optional().nullable(),
  paid_amount:   z.number().nonnegative().optional().nullable(),
  client_email:  z.string().max(200).optional().nullable().transform(v => v?.trim() || null),
  client_phone:  z.string().max(30).optional().nullable(),

  // Само за service_kind='recycle' — свързва протокола с конкретна анонимна
  // бройка от партида втора употреба (products). Виж 0105_*.sql.
  product_id:            z.string().uuid().optional().nullable(),
  indoor_unit_serial:    z.string().max(100).optional().nullable(),
  outdoor_unit_serial:   z.string().max(100).optional().nullable(),

  is_japanese_brand:   z.boolean().optional().nullable(),
  freon_charge_method: z.enum(["none", "scale", "standard"]).optional().nullable(),
  refrigerant_type:     z.string().max(40).optional().nullable(),
  refrigerant_amount_g: z.number().nonnegative().optional().nullable(),

  vacuum_cleaning_done:   z.boolean().optional().nullable(),
  valves_ok:              z.boolean().optional().nullable(),
  outdoor_bearings_state: z.enum(["ok", "noisy", "lubricated", "replaced"]).optional().nullable(),
  indoor_bearings_state:  z.enum(["ok", "noisy", "lubricated", "replaced"]).optional().nullable(),

  pressure_cold_bar:  z.number().optional().nullable(),
  pressure_hot_bar:   z.number().optional().nullable(),
  consumption_cold_kw: z.number().optional().nullable(),
  consumption_hot_kw:  z.number().optional().nullable(),

  original_remote:     z.boolean().optional().nullable(),
  outdoor_noise_level: z.enum(["quiet", "normal", "elevated", "loud", "very_loud"]).optional().nullable(),

  welds_indoor_heat_exchanger:  z.boolean().optional().nullable(),
  welds_outdoor_heat_exchanger: z.boolean().optional().nullable(),
  welds_pipes:                  z.boolean().optional().nullable(),
  indoor_mechanism_repaired:    z.boolean().optional().nullable(),
  broken_turbine:               z.boolean().optional().nullable(),

  service_rating: z.number().int().min(1).max(5).optional().nullable(),

  notes:            z.string().max(2000).optional().nullable(),
  signature_team:   z.string().optional().nullable(),
  status:           z.enum(["prepared", "in_progress", "signed"]).optional().default("prepared"),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

async function nextRepairProtocolNumber(
  db: Awaited<ReturnType<typeof adminSession>>["db"],
): Promise<{ ok: true; number: string } | { ok: false; error: string }> {
  const { data: rpcNumber, error: rpcErr } = await db.rpc("next_repair_protocol_number");
  if (!rpcErr && typeof rpcNumber === "string" && rpcNumber.trim()) {
    return { ok: true, number: rpcNumber.trim() };
  }
  // Fallback — само ако RPC липсва (стара DB). Не е атомарно.
  const year = new Date().getFullYear();
  const { count, error: cntErr } = await db
    .from("service_repair_protocols")
    .select("*", { count: "exact", head: true })
    .gte("created_at", `${year}-01-01T00:00:00Z`);
  if (cntErr) return { ok: false, error: cntErr.message };
  const seq = (count ?? 0) + 1;
  return { ok: true, number: `SR-${year}${String(seq).padStart(3, "0")}` };
}

export async function GET(req: NextRequest) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin", "office_staff", "service_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));

  const { page, perPage, status, kind, dateFrom, dateTo, q } = parsed.data;
  const offset = (page - 1) * perPage;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return withCors(req, NextResponse.json({ error: "Невалиден период: „от“ е след „до“" }, { status: 400 }));
  }

  const selectWithKind =
    "id,protocol_number,date,client_name,client_phone,ac_brand,ac_model,serial_number,address,is_japanese_brand,freon_charge_method,status,service_kind,created_at,created_by,service_rating";
  const selectWithBrand =
    "id,protocol_number,date,client_name,client_phone,ac_brand,ac_model,serial_number,address,is_japanese_brand,freon_charge_method,status,created_at,created_by,service_rating";
  const selectLegacy =
    "id,protocol_number,date,client_name,client_phone,ac_model,serial_number,address,is_japanese_brand,freon_charge_method,status,created_at,created_by,service_rating";

  const runList = async (cols: string, searchOpts?: { includeBrand?: boolean; includeRecycleSerials?: boolean }) => {
    let listQuery = session.db
      .from("service_repair_protocols")
      .select(cols, { count: "exact" })
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    // service_staff — само собствени протоколи (API е service-role → RLS не важи)
    if (session.role === "service_staff") {
      listQuery = listQuery.eq("created_by", session.userId);
    }

    if (status) listQuery = listQuery.eq("status", status);
    if (kind && cols.includes("service_kind")) listQuery = listQuery.eq("service_kind", kind);
    if (dateFrom) listQuery = listQuery.gte("date", dateFrom);
    if (dateTo) listQuery = listQuery.lte("date", dateTo);
    if (q?.trim()) {
      listQuery = applyAdminRepairProtocolSearchFilter(listQuery, q, searchOpts);
    }
    return listQuery;
  };

  let { data, error, count } = await runList(selectWithKind, { includeBrand: true, includeRecycleSerials: true });

  const missingRecycleSerialColumn =
    !!error &&
    /indoor_unit_serial|outdoor_unit_serial|42703|does not exist|undefined_column/i.test(
      `${error.message} ${(error as { code?: string }).code ?? ""}`,
    );
  if (missingRecycleSerialColumn) {
    const retry = await runList(selectWithKind, { includeBrand: true, includeRecycleSerials: false });
    data = retry.data;
    error = retry.error;
    count = retry.count;
  }

  const missingKind =
    !!error &&
    /service_kind|42703|does not exist|undefined_column/i.test(
      `${error.message} ${(error as { code?: string }).code ?? ""}`,
    );
  if (missingKind) {
    const retry = await runList(selectWithBrand, { includeBrand: true, includeRecycleSerials: true });
    data = retry.data;
    error = retry.error;
    count = retry.count;
    if (!error && Array.isArray(data)) {
      data = (data as unknown as Record<string, unknown>[]).map((row) => ({
        ...row,
        service_kind: "client",
      })) as unknown as typeof data;
    }
  }

  const missingBrandColumn =
    !!error &&
    /ac_brand|42703|does not exist|undefined_column/i.test(
      `${error.message} ${(error as { code?: string }).code ?? ""}`,
    );
  if (missingBrandColumn) {
    const retry = await runList(selectLegacy, { includeBrand: false, includeRecycleSerials: false });
    data = retry.data;
    error = retry.error;
    count = retry.count;
    if (!error && Array.isArray(data)) {
      data = (data as unknown as Record<string, unknown>[]).map((row) => ({
        ...row,
        ac_brand: null,
        service_kind: row.service_kind ?? "client",
      })) as unknown as typeof data;
    }
  }

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [], meta: { page, perPage, total: count ?? 0 } }));
}

function hasTechnicalContent(d: z.infer<typeof CreateSchema>): boolean {
  const fieldsToCheck: (keyof z.infer<typeof CreateSchema>)[] = [
    "freon_charge_method", "refrigerant_type", "refrigerant_amount_g", "vacuum_cleaning_done", "valves_ok",
    "outdoor_bearings_state", "indoor_bearings_state",
    "pressure_cold_bar", "pressure_hot_bar",
    "consumption_cold_kw", "consumption_hot_kw",
    "original_remote", "outdoor_noise_level",
    "welds_indoor_heat_exchanger", "welds_outdoor_heat_exchanger", "welds_pipes",
    "indoor_mechanism_repaired", "broken_turbine",
    "service_rating",
  ];
  return fieldsToCheck.some((f) => d[f] !== undefined && d[f] !== null);
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin", "office_staff", "service_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const json = await req.json().catch(() => null);
  if (!json) return withCors(req, NextResponse.json({ error: "Невалидно тяло" }, { status: 400 }));

  const parsed = CreateSchema.safeParse(json);
  if (!parsed.success) {
    console.error("[POST /api/admin/service/repair-protocols] validation:", JSON.stringify(parsed.error.issues));
    return withCors(req, NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Невалидни данни", details: parsed.error.issues }, { status: 400 }));
  }

  const numbered = await nextRepairProtocolNumber(session.db);
  if (!numbered.ok) {
    return withCors(req, NextResponse.json({ error: numbered.error }, { status: 500 }));
  }
  const protocolNumber = numbered.number;

  const d = parsed.data;

  const inputHadStatus = Object.prototype.hasOwnProperty.call(json ?? {}, "status");
  let computedStatus: "prepared" | "in_progress" | "signed" = d.status;
  if (!inputHadStatus) {
    const technicalPresent = hasTechnicalContent(d);
    const techSigned = Boolean(d.signature_team?.trim());
    if (techSigned) computedStatus = "signed";
    else if (technicalPresent) computedStatus = "in_progress";
    else computedStatus = "prepared";
  }

  if (inputHadStatus && computedStatus === "signed" && !d.signature_team?.trim()) {
    return withCors(req, NextResponse.json(
      { error: "За подписан протокол е нужен подпис на сервизния техник." },
      { status: 400 },
    ));
  }

  const isRecycle = d.service_kind === "recycle";
  const clientIndoor = d.indoor_unit_serial?.trim() || null;
  const clientOutdoor = d.outdoor_unit_serial?.trim() || null;

  const payload: Record<string, unknown> = {
    protocol_number:  protocolNumber,
    date:             d.date || new Date().toISOString().slice(0, 10),
    work_item_id:     d.work_item_id ?? null,
    service_kind:     d.service_kind ?? "client",

    client_name:      isRecycle ? null : (d.client_name?.trim() || null),
    ac_brand:         d.ac_brand ?? null,
    ac_model:         d.ac_model ?? null,
    serial_number:    isRecycle
      ? null
      : (combineLegacySerialField(clientIndoor, clientOutdoor) ?? (d.serial_number?.trim() || null)),
    address:          isRecycle ? null : (d.address?.trim() || null),
    paid_amount:      d.paid_amount ?? null,
    client_email:     isRecycle ? null : (d.client_email || null),
    client_phone:     isRecycle ? null : (d.client_phone?.trim() || null),

    product_id:          d.product_id ?? null,
    indoor_unit_serial:  isRecycle ? clientIndoor : clientIndoor,
    outdoor_unit_serial: isRecycle ? clientOutdoor : clientOutdoor,

    is_japanese_brand:   d.is_japanese_brand ?? (isRecycle ? true : null),
    freon_charge_method: d.freon_charge_method ?? null,
    refrigerant_type:     d.refrigerant_type?.trim() || null,
    refrigerant_amount_g: d.refrigerant_amount_g ?? null,

    vacuum_cleaning_done:   d.vacuum_cleaning_done ?? null,
    valves_ok:              d.valves_ok ?? null,
    outdoor_bearings_state: d.outdoor_bearings_state ?? null,
    indoor_bearings_state:  d.indoor_bearings_state ?? null,

    pressure_cold_bar:  d.pressure_cold_bar ?? null,
    pressure_hot_bar:   d.pressure_hot_bar ?? null,
    consumption_cold_kw: d.consumption_cold_kw ?? null,
    consumption_hot_kw:  d.consumption_hot_kw ?? null,

    original_remote:     d.original_remote ?? null,
    outdoor_noise_level: d.outdoor_noise_level ?? null,

    welds_indoor_heat_exchanger:  d.welds_indoor_heat_exchanger ?? null,
    welds_outdoor_heat_exchanger: d.welds_outdoor_heat_exchanger ?? null,
    welds_pipes:                  d.welds_pipes ?? null,
    indoor_mechanism_repaired:    d.indoor_mechanism_repaired ?? null,
    broken_turbine:               d.broken_turbine ?? null,

    service_rating: d.service_rating ?? null,

    notes:            d.notes ?? null,
    signature_team:   d.signature_team ?? null,
    status:           computedStatus,
    created_by:       session.userId,
  };

  let { data, error } = await session.db
    .from("service_repair_protocols")
    .insert(payload)
    .select("*")
    .single();

  // Unique conflict на номер — вземи нов номер и опитай пак веднъж
  if (error && (error as { code?: string }).code === "23505") {
    const retryNum = await nextRepairProtocolNumber(session.db);
    if (retryNum.ok) {
      const retry = await session.db
        .from("service_repair_protocols")
        .insert({ ...payload, protocol_number: retryNum.number })
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }
  }

  const missingProductLinkColumn =
    !!error &&
    /product_id|indoor_unit_serial|outdoor_unit_serial|42703|does not exist|undefined_column/i.test(
      `${error.message} ${(error as { code?: string }).code ?? ""}`,
    );
  if (missingProductLinkColumn) {
    const { product_id: _drop1, indoor_unit_serial: _drop2, outdoor_unit_serial: _drop3, ...payloadNoLink } = payload;
    const retry = await session.db
      .from("service_repair_protocols")
      .insert(payloadNoLink)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

  const missingBrandColumn =
    !!error &&
    /ac_brand|42703|does not exist|undefined_column/i.test(
      `${error.message} ${(error as { code?: string }).code ?? ""}`,
    );
  if (missingBrandColumn) {
    const { ac_brand: _drop, ...payloadLegacy } = payload;
    const retry = await session.db
      .from("service_repair_protocols")
      .insert(payloadLegacy)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

  const missingKindColumn =
    !!error &&
    /service_kind|42703|does not exist|undefined_column/i.test(
      `${error.message} ${(error as { code?: string }).code ?? ""}`,
    );
  if (missingKindColumn) {
    const { service_kind: _drop, ...payloadNoKind } = payload;
    const retry = await session.db
      .from("service_repair_protocols")
      .insert(payloadNoKind)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) {
    console.error("[POST /api/admin/service/repair-protocols] insert:", error);
    return withCors(req, NextResponse.json({ error: error.message, code: error.code }, { status: 500 }));
  }

  await logAdminActivity({
    action: "service_repair_protocol.create",
    entityType: "service_repair_protocol",
    entityId: (data as { id: string }).id,
    details: {
      protocol_number: (data as { protocol_number?: string }).protocol_number ?? protocolNumber,
      client_name: d.client_name ?? null,
      status: computedStatus,
    },
  });

  // При рециклиране, ако вече са попълнени и двата серийни номера →
  // "финализирай" свързаната партидна бройка веднага при създаване.
  let productLinkWarning: string | null = null;
  if (isRecycle && payload.product_id) {
    const linkResult = await applyRecycleSerialsToProduct(
      session.db,
      String(payload.product_id),
      d.indoor_unit_serial,
      d.outdoor_unit_serial,
    );
    if (!linkResult.ok) productLinkWarning = linkResult.error;
  }

  return withCors(req, NextResponse.json(
    { data, ...(productLinkWarning ? { productLinkWarning } : {}) },
    { status: 201 },
  ));
}
