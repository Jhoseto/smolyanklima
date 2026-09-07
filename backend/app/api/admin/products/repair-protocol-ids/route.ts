/**
 * GET /api/admin/products/repair-protocol-ids?ids=uuid,uuid,...
 * Последен сервизен протокол по product_id за списъка продукти.
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { findRepairProtocolsForProductIds } from "@/lib/admin/matchRepairProtocolProduct";
import {
  repairProtocolRowToSummary,
  type LinkedRepairProtocolSummary,
} from "@/lib/admin/productServiceProtocol";

const QuerySchema = z.object({
  ids: z.string().min(1),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
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

  const parsed = QuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams.entries()));
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));
  }

  const ids = [...new Set(
    parsed.data.ids.split(",").map((s) => s.trim()).filter(Boolean),
  )].slice(0, 100);

  const uuidRe = /^[0-9a-f-]{36}$/i;
  const validIds = ids.filter((id) => uuidRe.test(id));
  if (validIds.length === 0) {
    return withCors(req, NextResponse.json({ data: {} }));
  }

  try {
    const rows = await findRepairProtocolsForProductIds(session.db, validIds);
    const map: Record<string, LinkedRepairProtocolSummary> = {};
    for (const [pid, row] of Object.entries(rows)) {
      map[pid] = repairProtocolRowToSummary(row);
    }
    return withCors(req, NextResponse.json({ data: map }));
  } catch (e: unknown) {
    return withCors(
      req,
      NextResponse.json(
        { error: e instanceof Error ? e.message : "Грешка при търсене на протоколи" },
        { status: 500 },
      ),
    );
  }
}
