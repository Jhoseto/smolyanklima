/**
 * GET /api/admin/products/[id]/repair-protocol
 * Последен сервизен протокол, свързан с бройката (product_id или серийни №).
 */

import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminSession, requireRole } from "@/lib/admin/db";
import { findRepairProtocolForSale } from "@/lib/admin/matchRepairProtocolProduct";
import {
  repairProtocolRowToSummary,
  type LinkedRepairProtocolSummary,
} from "@/lib/admin/productServiceProtocol";

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

  const { data: product, error: prodErr } = await session.db
    .from("products")
    .select("id, name, model_code, indoor_unit_serial, outdoor_unit_serial, brands:brand_id(name)")
    .eq("id", id)
    .maybeSingle();

  if (prodErr) {
    return withCors(req, NextResponse.json({ error: prodErr.message }, { status: 500 }));
  }
  if (!product) {
    return withCors(req, NextResponse.json({ error: "Продуктът не е намерен" }, { status: 404 }));
  }

  const brandsEmbed = (product as { brands?: { name?: string | null } | null }).brands;

  let protocol: Record<string, unknown> | null = null;
  try {
    protocol = await findRepairProtocolForSale(session.db, {
      saleProductId: id,
      product: {
        indoor_unit_serial: (product.indoor_unit_serial as string | null) ?? null,
        outdoor_unit_serial: (product.outdoor_unit_serial as string | null) ?? null,
        brand_name: brandsEmbed?.name ?? null,
        model_code: (product.model_code as string | null) ?? null,
        name: (product.name as string | null) ?? null,
      },
    });
  } catch (e: unknown) {
    return withCors(
      req,
      NextResponse.json(
        { error: e instanceof Error ? e.message : "Грешка при търсене на протокол" },
        { status: 500 },
      ),
    );
  }

  if (!protocol) {
    return withCors(req, NextResponse.json({ data: { protocol: null } }));
  }

  const summary: LinkedRepairProtocolSummary = repairProtocolRowToSummary(protocol);

  return withCors(req, NextResponse.json({ data: { protocol: summary } }));
}
