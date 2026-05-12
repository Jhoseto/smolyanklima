import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

/**
 * Преброяване на инстанции (продукти) със същия модел в каталога.
 *
 * GET /api/admin/products/model-stock-count?brandId=<uuid>&modelCode=<text>&excludeId=<uuid>
 *
 * Връща:
 *   { total: <int>, inStock: <int>, otherStatuses: <int> }
 *
 * Използване в UI: при попълване на марка + модел показваме live preview на
 * количеството, което моделът ще има в каталога след save-а. Сравнението на
 * model_code е case-insensitive (lower(trim(...))).
 *
 * ВАЖНО: реалното `stock_quantity` се поддържа от тригер в DB
 * (виж 0039_products_model_stock_quantity_auto.sql). Този endpoint е
 * САМО за preview към потребителя.
 */

const QuerySchema = z.object({
  brandId: z.string().uuid(),
  modelCode: z.string().min(1).max(120),
  /** UUID на текущо редактирания продукт — изключваме го от COUNT-а. */
  excludeId: z.string().uuid().optional(),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));
  }

  const supabase = await adminDb();
  const brandId = parsed.data.brandId;
  const modelKey = parsed.data.modelCode.trim().toLowerCase();
  if (!modelKey) {
    return withCors(req, NextResponse.json({ data: { total: 0, inStock: 0, otherStatuses: 0 } }));
  }

  let query = supabase
    .from("products")
    .select("id,stock_status,model_code", { count: "exact" })
    .eq("brand_id", brandId)
    .ilike("model_code", modelKey);
  if (parsed.data.excludeId) query = query.neq("id", parsed.data.excludeId);

  const { data, error } = await query;
  if (error) {
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  // Допълнителен safety филтър на ниво приложение: ilike може да е твърде
  // либерален при wildcard символи в model_code (макар да са рядкост).
  const rows = (data ?? []).filter(
    (r) => String((r as { model_code: string | null }).model_code ?? "").trim().toLowerCase() === modelKey,
  );
  const inStock = rows.filter((r) => (r as { stock_status: string }).stock_status === "in_stock").length;
  const total = rows.length;

  return withCors(
    req,
    NextResponse.json({
      data: {
        total,
        inStock,
        otherStatuses: Math.max(0, total - inStock),
      },
    }),
  );
}
