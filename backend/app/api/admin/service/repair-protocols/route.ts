/**
 * /api/admin/service/repair-protocols
 *
 * GET  → списък със сервизни (профилактика/ремонт) протоколи.
 * POST → създаване на нов сервизен протокол.
 *
 * Различен от `/api/admin/service/protocols` (приемно-предавателен).
 * Двата ползват една и съща статус машина (prepared/in_progress/signed),
 * но имат различни полета и таблици в БД.
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { scopeRepairProtocolQueryForSession } from "@/lib/admin/serviceProtocolAccess";

const QuerySchema = z.object({
  page:    z.coerce.number().int().min(1).optional().default(1),
  perPage: z.coerce.number().int().min(1).max(100).optional().default(20),
  status:  z.enum(["prepared", "in_progress", "signed"]).optional(),
  q:       z.string().optional(),
});

/**
 * Zod schema за payload-а при създаване. Всички технически полета са
 * опционални — офисът обикновено създава „prepared“ протокол със само
 * клиентски данни, а сервизният екип попълва технически параметри
 * на място.
 *
 * NULL означава „не проверено / не попълнено“. Boolean true/false
 * означава реален отговор на въпроса.
 */
const CreateSchema = z.object({
  work_item_id:  z.string().uuid().optional().nullable(),
  date:          z.string().optional(),

  // Клиент + климатик
  client_name:   z.string().max(200).optional().nullable(),
  ac_brand:      z.string().max(120).optional().nullable(),
  ac_model:      z.string().max(200).optional().nullable(),
  serial_number: z.string().max(100).optional().nullable(),
  address:       z.string().max(500).optional().nullable(),
  paid_amount:   z.number().nonnegative().optional().nullable(),
  client_email:  z.string().max(200).optional().nullable().transform(v => v?.trim() || null),
  client_phone:  z.string().max(30).optional().nullable(),

  // Японски климатици + фреон
  is_japanese_brand:   z.boolean().optional().nullable(),
  freon_charge_method: z.enum(["none", "scale", "standard"]).optional().nullable(),

  // Почистване и механика
  vacuum_cleaning_done:   z.boolean().optional().nullable(),
  valves_ok:              z.boolean().optional().nullable(),
  outdoor_bearings_state: z.enum(["ok", "noisy", "lubricated", "replaced"]).optional().nullable(),
  indoor_bearings_state:  z.enum(["ok", "noisy", "lubricated", "replaced"]).optional().nullable(),

  // Налягания / консумация
  pressure_cold_bar:  z.number().optional().nullable(),
  pressure_hot_bar:   z.number().optional().nullable(),
  consumption_cold_kw: z.number().optional().nullable(),
  consumption_hot_kw:  z.number().optional().nullable(),

  // Дистанционно + шум
  original_remote:     z.boolean().optional().nullable(),
  outdoor_noise_level: z.enum(["quiet", "normal", "elevated", "loud", "very_loud"]).optional().nullable(),

  // Заварки + ремонти
  welds_indoor_heat_exchanger:  z.boolean().optional().nullable(),
  welds_outdoor_heat_exchanger: z.boolean().optional().nullable(),
  welds_pipes:                  z.boolean().optional().nullable(),
  indoor_mechanism_repaired:    z.boolean().optional().nullable(),
  broken_turbine:               z.boolean().optional().nullable(),

  // Оценка
  service_rating: z.number().int().min(1).max(5).optional().nullable(),

  // Други
  notes:            z.string().max(2000).optional().nullable(),
  signature_team:   z.string().optional().nullable(),
  status:           z.enum(["prepared", "in_progress", "signed"]).optional().default("prepared"),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
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

  const { page, perPage, status, q } = parsed.data;
  const offset = (page - 1) * perPage;

  const selectWithBrand =
    "id,protocol_number,date,client_name,ac_brand,ac_model,serial_number,address,is_japanese_brand,freon_charge_method,status,created_at,created_by,service_rating";
  const selectLegacy =
    "id,protocol_number,date,client_name,ac_model,serial_number,address,is_japanese_brand,freon_charge_method,status,created_at,created_by,service_rating";

  const runList = async (includeAcBrand: boolean) => {
    const cols = includeAcBrand ? selectWithBrand : selectLegacy;
    let listQuery = session.db
      .from("service_repair_protocols")
      .select(cols, { count: "exact" })
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    listQuery = scopeRepairProtocolQueryForSession(listQuery, session);
    if (status) listQuery = listQuery.eq("status", status);
    if (q?.trim()) {
      const term = q.trim();
      const orClause = includeAcBrand
        ? `client_name.ilike.%${term}%,protocol_number.ilike.%${term}%,ac_brand.ilike.%${term}%,ac_model.ilike.%${term}%`
        : `client_name.ilike.%${term}%,protocol_number.ilike.%${term}%,ac_model.ilike.%${term}%`;
      listQuery = listQuery.or(orClause);
    }
    return listQuery;
  };

  let { data, error, count } = await runList(true);
  const missingBrandColumn =
    !!error &&
    /ac_brand|42703|does not exist|undefined_column/i.test(
      `${error.message} ${(error as { code?: string }).code ?? ""}`,
    );
  if (missingBrandColumn) {
    const retry = await runList(false);
    data = retry.data;
    error = retry.error;
    count = retry.count;
    if (!error && Array.isArray(data)) {
      const rows = data as unknown as Record<string, unknown>[];
      data = rows.map((row) => ({ ...row, ac_brand: null })) as unknown as typeof data;
    }
  }

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [], meta: { page, perPage, total: count ?? 0 } }));
}

/**
 * Технически параметри, които при наличие на стойност (включително false)
 * показват че екипът реално е проверявал нещо на място. Това определя
 * прехода `prepared → in_progress`.
 */
function hasTechnicalContent(d: z.infer<typeof CreateSchema>): boolean {
  const fieldsToCheck: (keyof z.infer<typeof CreateSchema>)[] = [
    "freon_charge_method", "vacuum_cleaning_done", "valves_ok",
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

  // Генериране на номер — SR-YYYYNNN (SR = Service Repair)
  const year = new Date().getFullYear();
  const { count, error: cntErr } = await session.db
    .from("service_repair_protocols")
    .select("*", { count: "exact", head: true });
  if (cntErr) return withCors(req, NextResponse.json({ error: cntErr.message }, { status: 500 }));

  const seq = (count ?? 0) + 1;
  const protocolNumber = `SR-${year}${String(seq).padStart(3, "0")}`;

  const d = parsed.data;

  // Автоматичен начален статус — еднаква логика като в acceptance:
  //   prepared    : по подразбиране (офисът подготвя клиентски данни)
  //   in_progress : ако има технически параметри / подписи
  //   signed      : ако сервизният техник е подписал
  const inputHadStatus = Object.prototype.hasOwnProperty.call(json ?? {}, "status");
  let computedStatus: "prepared" | "in_progress" | "signed" = d.status;
  if (!inputHadStatus) {
    const technicalPresent = hasTechnicalContent(d);
    const techSigned = Boolean(d.signature_team);
    if (techSigned) computedStatus = "signed";
    else if (technicalPresent || d.signature_team) computedStatus = "in_progress";
    else computedStatus = "prepared";
  }

  const payload = {
    protocol_number:  protocolNumber,
    date:             d.date || new Date().toISOString().slice(0, 10),
    work_item_id:     d.work_item_id ?? null,

    client_name:      d.client_name ?? null,
    ac_brand:         d.ac_brand ?? null,
    ac_model:         d.ac_model ?? null,
    serial_number:    d.serial_number ?? null,
    address:          d.address ?? null,
    paid_amount:      d.paid_amount ?? null,
    client_email:     d.client_email || null,
    client_phone:     d.client_phone ?? null,

    is_japanese_brand:   d.is_japanese_brand ?? null,
    freon_charge_method: d.freon_charge_method ?? null,

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

  if (error) {
    console.error("[POST /api/admin/service/repair-protocols] insert:", error);
    return withCors(req, NextResponse.json({ error: error.message, code: error.code }, { status: 500 }));
  }

  await logAdminActivity({
    action: "service_repair_protocol.create",
    entityType: "service_repair_protocol",
    entityId: (data as { id: string }).id,
    details: {
      protocol_number: protocolNumber,
      client_name: d.client_name ?? null,
      status: computedStatus,
    },
  });

  return withCors(req, NextResponse.json({ data }, { status: 201 }));
}
