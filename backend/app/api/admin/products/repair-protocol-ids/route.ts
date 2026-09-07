/**
 * GET /api/admin/products/repair-protocol-ids?ids=uuid,uuid,...
 * Последен сервизен протокол по product_id за списъка продукти.
 * Използва същата логика като GET /products/[id]/repair-protocol
 * (product_id, серийни №, марка/модел).
 */

import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { findRepairProtocolForSale } from "@/lib/admin/matchRepairProtocolProduct";
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

  const { data: products, error: prodErr } = await session.db
    .from("products")
    .select("id, name, model_code, indoor_unit_serial, outdoor_unit_serial, brands:brand_id(name)")
    .in("id", validIds);

  if (prodErr) {
    return withCors(req, NextResponse.json({ error: prodErr.message }, { status: 500 }));
  }

  const map: Record<string, LinkedRepairProtocolSummary> = {};

  await Promise.all(
    (products ?? []).map(async (product) => {
      const pid = String((product as { id: string }).id);
      const brandsEmbed = (product as { brands?: { name?: string | null } | null }).brands;

      try {
        const protocol = await findRepairProtocolForSale(session.db, {
          saleProductId: pid,
          product: {
            indoor_unit_serial: (product.indoor_unit_serial as string | null) ?? null,
            outdoor_unit_serial: (product.outdoor_unit_serial as string | null) ?? null,
            brand_name: brandsEmbed?.name ?? null,
            model_code: (product.model_code as string | null) ?? null,
            name: (product.name as string | null) ?? null,
          },
        });
        if (protocol) {
          map[pid] = repairProtocolRowToSummary(protocol);
        }
      } catch {
        /* пропускаме единични грешки — не блокираме целия списък */
      }
    }),
  );

  return withCors(req, NextResponse.json({ data: map }));
}
