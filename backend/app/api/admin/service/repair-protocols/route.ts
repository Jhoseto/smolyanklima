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
import { REPAIR_WORKFLOW_STAGES } from "@/lib/repair-protocol-fields";
import { RepairWriteSchema, repairProtocolWrite } from "@/lib/admin/repairProtocolWorkflow";

const QuerySchema = z.object({
  page:     z.coerce.number().int().min(1).optional().default(1),
  perPage:  z.coerce.number().int().min(1).max(100).optional().default(20),
  status:   z.enum(["prepared", "in_progress", "signed"]).optional(),
  stage:    z.enum(REPAIR_WORKFLOW_STAGES).optional(),
  kind:     z.enum(["client", "recycle"]).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  q:        z.string().optional(),
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

  const { page, perPage, status, stage, kind, dateFrom, dateTo, q } = parsed.data;
  const offset = (page - 1) * perPage;

  if (dateFrom && dateTo && dateFrom > dateTo) {
    return withCors(req, NextResponse.json({ error: "Невалиден период: „от“ е след „до“" }, { status: 400 }));
  }

  const cols = "id,protocol_number,date,client_name,client_phone,ac_brand,ac_model,serial_number,address,is_japanese_brand,freon_charge_method,status,workflow_stage,service_kind,created_at,created_by,service_rating";
  let listQuery = session.db.from("service_repair_protocols")
    .select(cols, { count: "exact" })
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id")
    .range(offset, offset + perPage - 1);

  if (session.role === "service_staff") listQuery = listQuery.eq("created_by", session.userId);
  if (status) listQuery = listQuery.eq("status", status);
  if (stage) listQuery = listQuery.eq("workflow_stage", stage);
  if (kind) listQuery = listQuery.eq("service_kind", kind);
  if (dateFrom) listQuery = listQuery.gte("date", dateFrom);
  if (dateTo) listQuery = listQuery.lte("date", dateTo);
  if (q?.trim()) listQuery = applyAdminRepairProtocolSearchFilter(listQuery, q, { includeBrand: true, includeRecycleSerials: true });
  const { data, error, count } = await listQuery;
  if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  return withCors(req, NextResponse.json({ data: data ?? [], meta: { page, perPage, total: count ?? 0 } }));
}

export async function POST(req: NextRequest) {
  let session;
  try { session = await adminSession(); }
  catch { return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 })); }

  try { requireRole(session, "master_admin", "office_staff", "service_staff"); }
  catch { return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 })); }

  const json = await req.json().catch(() => null);
  if (!json) return withCors(req, NextResponse.json({ error: "Невалидно тяло" }, { status: 400 }));

  const parsed = RepairWriteSchema.safeParse(json);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Невалидни данни" }, { status: 400 }));
  }
  const input = parsed.data;
  const write = repairProtocolWrite(null, input, session.role);
  if (!write.ok) return withCors(req, NextResponse.json({ error: write.error }, { status: write.status }));

  for (let attempt = 0; attempt < 2; attempt++) {
    const numbered = await nextRepairProtocolNumber(session.db);
    if (!numbered.ok) return withCors(req, NextResponse.json({ error: numbered.error }, { status: 500 }));
    const { data, error } = await session.db.from("service_repair_protocols").insert({
      ...write.patch,
      ...(input.creation_id && { id: input.creation_id }),
      created_by: session.userId,
      protocol_number: numbered.number,
    }).select("*").single();
    if (error?.code === "23505") {
      if (input.creation_id) {
        const { data: existing, error: lookupError } = await session.db.from("service_repair_protocols")
          .select("*").eq("id", input.creation_id).eq("created_by", session.userId).maybeSingle();
        if (lookupError) return withCors(req, NextResponse.json({ error: lookupError.message }, { status: 500 }));
        if (existing) {
          const same = Object.entries(write.patch).every(([key, value]) => (existing[key] ?? null) === (value ?? null));
          if (!same) return withCors(req, NextResponse.json({
            data: existing, error: "Протоколът вече е създаден с различни данни. Проверете записа преди да потвърдите промените.",
          }, { status: 409 }));
          let productLinkWarning: string | undefined;
          if (write.syncProduct && existing.product_id) {
            const result = await applyRecycleSerialsToProduct(session.db, existing.product_id, existing.indoor_unit_serial, existing.outdoor_unit_serial);
            if (!result.ok) productLinkWarning = result.error;
          }
          return withCors(req, NextResponse.json({ data: existing, productLinkWarning }));
        }
      }
      continue;
    }
    if (error) return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
    await logAdminActivity({
      action: "service_repair_protocol.create", entityType: "service_repair_protocol", entityId: data.id,
      details: { protocol_number: data.protocol_number, client_name: data.client_name, workflow_stage: data.workflow_stage },
    });
    let productLinkWarning: string | undefined;
    if (write.syncProduct && data.product_id) {
      const result = await applyRecycleSerialsToProduct(session.db, data.product_id, data.indoor_unit_serial, data.outdoor_unit_serial);
      if (!result.ok) productLinkWarning = result.error;
    }
    return withCors(req, NextResponse.json({ data, productLinkWarning }, { status: 201 }));
  }
  return withCors(req, NextResponse.json({ error: "Конфликт при създаване на протокола. Опитайте отново." }, { status: 409 }));
}
