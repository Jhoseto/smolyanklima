/**
 * GET /api/admin/service/repair-protocols/[id]/product-match
 * Предложения за свързване на протокол с продукт от каталога (legacy данни).
 */

import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { assertRepairProtocolVisible } from "@/lib/admin/repairProtocolAccess";
import { findProductMatchesForRepairProtocol } from "@/lib/admin/matchRepairProtocolProduct";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let session;
  try {
    session = await adminSession();
  } catch {
    return withCors(req, NextResponse.json({ error: "Неоторизиран достъп" }, { status: 401 }));
  }

  try {
    requireRole(session, "master_admin", "office_staff", "service_staff");
  } catch {
    return withCors(req, NextResponse.json({ error: "Забранен достъп" }, { status: 403 }));
  }

  const { id } = await params;
  const { data: protocol, error } = await session.db
    .from("service_repair_protocols")
    .select("id,ac_brand,ac_model,serial_number,indoor_unit_serial,outdoor_unit_serial,product_id,service_kind,created_by")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  const access = assertRepairProtocolVisible(session, protocol);
  if (!access.ok) {
    return withCors(req, NextResponse.json({ error: access.error }, { status: access.status }));
  }
  if (!protocol) {
    return withCors(req, NextResponse.json({ error: "Не е намерен" }, { status: 404 }));
  }

  const row = protocol as {
    ac_brand?: string | null;
    ac_model?: string | null;
    serial_number?: string | null;
    indoor_unit_serial?: string | null;
    outdoor_unit_serial?: string | null;
    product_id?: string | null;
  };

  const suggestions = await findProductMatchesForRepairProtocol(session.db, {
    ac_brand: row.ac_brand,
    ac_model: row.ac_model,
    serial_number: row.serial_number,
    indoor_unit_serial: row.indoor_unit_serial,
    outdoor_unit_serial: row.outdoor_unit_serial,
    product_id: row.product_id,
  });

  return withCors(req, NextResponse.json({ data: { suggestions } }));
}
