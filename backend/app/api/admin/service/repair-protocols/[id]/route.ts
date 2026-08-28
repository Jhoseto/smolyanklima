/**
 * /api/admin/service/repair-protocols/[id]
 *
 * GET    → пълни данни на един сервизен протокол.
 * PUT    → обновяване (със auto-progress на статуса).
 * DELETE → изтриване (само master_admin).
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { logAdminActivity } from "@/lib/admin/audit";
import { assertRepairProtocolVisible, assertRepairProtocolWritable } from "@/lib/admin/repairProtocolAccess";

const UpdateSchema = z.object({
  date:             z.string().optional(),
  service_kind:     z.enum(["client", "recycle"]).optional(),

  client_name:      z.string().max(200).optional().nullable(),
  ac_brand:         z.string().max(120).optional().nullable(),
  ac_model:         z.string().max(200).optional().nullable(),
  serial_number:    z.string().max(100).optional().nullable(),
  address:          z.string().max(500).optional().nullable(),
  paid_amount:      z.number().nonnegative().optional().nullable(),
  client_email:     z.string().max(200).optional().nullable().transform(v => v?.trim() || null),
  client_phone:     z.string().max(30).optional().nullable(),

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
  status:           z.enum(["prepared", "in_progress", "signed"]).optional(),
});

/**
 * Списък с технически полета, които при наличие на стойност (вкл. false)
 * показват че екипът реално работи на място → преход prepared → in_progress.
 */
const TECHNICAL_FIELDS = [
  "freon_charge_method", "refrigerant_type", "refrigerant_amount_g", "vacuum_cleaning_done", "valves_ok",
  "outdoor_bearings_state", "indoor_bearings_state",
  "pressure_cold_bar", "pressure_hot_bar",
  "consumption_cold_kw", "consumption_hot_kw",
  "original_remote", "outdoor_noise_level",
  "welds_indoor_heat_exchanger", "welds_outdoor_heat_exchanger", "welds_pipes",
  "indoor_mechanism_repaired", "broken_turbine",
  "service_rating",
] as const;

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin", "office_staff", "service_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const { id } = await params;
  const { data, error } = await session.db
    .from("service_repair_protocols")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  const access = assertRepairProtocolVisible(session, data);
  if (!access.ok) {
    return withCors(req, NextResponse.json({ error: access.error }, { status: access.status }));
  }

  return withCors(req, NextResponse.json({ data }));
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin", "office_staff", "service_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const { id } = await params;

  const json = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Невалидни данни" }, { status: 400 }));
  }

  const { data: current, error: curErr } = await session.db
    .from("service_repair_protocols")
    .select("id, created_by, status, signature_team, freon_charge_method, refrigerant_type, refrigerant_amount_g, vacuum_cleaning_done, valves_ok, outdoor_bearings_state, indoor_bearings_state, pressure_cold_bar, pressure_hot_bar, consumption_cold_kw, consumption_hot_kw, original_remote, outdoor_noise_level, welds_indoor_heat_exchanger, welds_outdoor_heat_exchanger, welds_pipes, indoor_mechanism_repaired, broken_turbine, service_rating")
    .eq("id", id)
    .maybeSingle();

  if (curErr) return withCors(req, NextResponse.json({ error: curErr.message }, { status: 500 }));
  if (!current) return withCors(req, NextResponse.json({ error: "Не е намерен" }, { status: 404 }));

  const writable = assertRepairProtocolWritable(
    session,
    current,
    parsed.data.status,
  );
  if (!writable.ok) {
    return withCors(req, NextResponse.json({ error: writable.error }, { status: writable.status }));
  }

  const update: Record<string, unknown> = { ...parsed.data };
  const c = current as unknown as Record<string, unknown>;
  const currentStatus = String(c.status) as "prepared" | "in_progress" | "signed";

  const effectiveKind =
    (parsed.data.service_kind ?? (c as { service_kind?: string }).service_kind ?? "client") as
      "client" | "recycle";
  if (effectiveKind === "recycle") {
    update.client_name = null;
    update.client_phone = null;
    update.client_email = null;
    update.address = null;
    update.serial_number = null;
  }

  // Автоматичен workflow на статуси (само ако клиентът НЕ изпраща явно status):
  //   prepared    → in_progress : при поява на технически параметри или подпис на техник
  //   *           → signed      : при подпис на сервизен техник
  //   signed                    : final — не се връща назад (освен master)
  if (parsed.data.status === undefined) {
    if (currentStatus !== "signed") {
      const sigTeam = parsed.data.signature_team !== undefined
        ? parsed.data.signature_team
        : (c.signature_team as string | null);

      const technicalPresent = TECHNICAL_FIELDS.some((field) => {
        const incomingVal = (parsed.data as Record<string, unknown>)[field];
        const merged = incomingVal !== undefined ? incomingVal : c[field];
        return merged !== null && merged !== undefined;
      });

      const techSigned = Boolean(sigTeam?.trim());

      let newStatus: "prepared" | "in_progress" | "signed" = currentStatus;
      if (techSigned) {
        newStatus = "signed";
      } else if (currentStatus === "prepared" && (technicalPresent || sigTeam)) {
        newStatus = "in_progress";
      }
      if (newStatus !== currentStatus) {
        update.status = newStatus;
      }
    } else {
      // Вече signed — подписът трябва да остане
      const mergedTeam = parsed.data.signature_team !== undefined
        ? parsed.data.signature_team
        : (c.signature_team as string | null);
      if (!mergedTeam?.trim()) {
        return withCors(req, NextResponse.json(
          { error: "Подписан протокол не може да остане без подпис на сервизен техник" },
          { status: 400 },
        ));
      }
    }
  } else if (parsed.data.status === "signed") {
    const team = parsed.data.signature_team ?? (c.signature_team as string | null);
    if (!team?.trim()) {
      return withCors(req, NextResponse.json(
        { error: "За подписан протокол е нужен подпис на сервизен техник." },
        { status: 400 },
      ));
    }
  }

  // Без undefined стойности — иначе PostgREST може да изпрати невалиден PATCH.
  const cleaned: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(update)) {
    if (v !== undefined) cleaned[k] = v;
  }

  // Няма какво да се обнови → върни текущия ред
  if (Object.keys(cleaned).length === 0) {
    const { data: row, error: selErr } = await session.db
      .from("service_repair_protocols")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (selErr) return withCors(req, NextResponse.json({ error: selErr.message }, { status: 500 }));
    if (!row) return withCors(req, NextResponse.json({ error: "Не е намерен" }, { status: 404 }));
    return withCors(req, NextResponse.json({ data: row }));
  }

  let { data, error } = await session.db
    .from("service_repair_protocols")
    .update(cleaned)
    .eq("id", id)
    .select("*")
    .maybeSingle();

  const missingBrandColumn =
    !!error &&
    /ac_brand|42703|does not exist|undefined_column/i.test(
      `${error.message} ${(error as { code?: string }).code ?? ""}`,
    );
  if (missingBrandColumn && "ac_brand" in cleaned) {
    const { ac_brand: _drop, ...updateLegacy } = cleaned;
    const retry = await session.db
      .from("service_repair_protocols")
      .update(updateLegacy)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  const missingKindColumn =
    !!error &&
    /service_kind|42703|does not exist|undefined_column/i.test(
      `${error.message} ${(error as { code?: string }).code ?? ""}`,
    );
  if (missingKindColumn && "service_kind" in cleaned) {
    const { service_kind: _drop, ...updateNoKind } = cleaned;
    const retry = await session.db
      .from("service_repair_protocols")
      .update(updateNoKind)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  if (!data) {
    return withCors(
      req,
      NextResponse.json(
        { error: "Протоколът не е намерен или не може да бъде обновен (проверете дали записът съществува)." },
        { status: 404 },
      ),
    );
  }

  await logAdminActivity({
    action: "service_repair_protocol.update",
    entityType: "service_repair_protocol",
    entityId: id,
    details: {
      changedFields: Object.keys(cleaned),
      status: (data as { status?: string }).status ?? null,
      protocol_number: (data as { protocol_number?: string }).protocol_number ?? null,
    },
  });

  return withCors(req, NextResponse.json({ data }));
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const { id } = await params;
  const { data: existing } = await session.db
    .from("service_repair_protocols")
    .select("protocol_number, client_name")
    .eq("id", id)
    .maybeSingle();

  const { error } = await session.db
    .from("service_repair_protocols")
    .delete()
    .eq("id", id);

  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));

  await logAdminActivity({
    action: "service_repair_protocol.delete",
    entityType: "service_repair_protocol",
    entityId: id,
    details: {
      protocol_number: (existing as { protocol_number?: string } | null)?.protocol_number ?? null,
      client_name: (existing as { client_name?: string } | null)?.client_name ?? null,
    },
  });

  return withCors(req, new NextResponse(null, { status: 204 }));
}
