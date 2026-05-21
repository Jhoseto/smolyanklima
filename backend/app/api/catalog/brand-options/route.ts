import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { fetchPublicCatalogRepresentatives } from "@/lib/catalog/publicCatalogDedup";

/**
 * Връща списък от активни марки от базата (`brands.is_active = true`),
 * заедно с броя продукти от всяка марка, видими в публичния каталог.
 * Така филтърът по марка в каталога ползва точно това, което админът е
 * добавил в БД — без hardcoded списъци на фронтенда.
 *
 * По избор `cond=new` / `cond=used` ограничава броячите до съответното
 * състояние; самият списък марки остава пълен.
 *
 * Параметърът `onlyWithProducts=true` стеснява списъка САМО до марки с
 * поне един публичен продукт (полезно за активни „живи“ филтри).
 *
 * Отговор:
 *   { data: [{ name: "Daikin", productCount: 12 }, ...] }
 *
 * Списъкът е сортиран по български алфавит.
 */

const QuerySchema = z.object({
  cond: z.enum(["new", "used"]).optional(),
  onlyWithProducts: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
});

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid query" }, { status: 400 }));
  }
  const { cond, onlyWithProducts } = parsed.data;
  const supabase = createSupabaseServiceRoleClient();

  // 1) Всички активни марки в БД.
  const { data: brandRows, error: bErr } = await supabase
    .from("brands")
    .select("id,name,is_active")
    .eq("is_active", true)
    .order("name", { ascending: true });
  if (bErr) {
    return withCors(req, NextResponse.json({ error: bErr.message }, { status: 500 }));
  }
  const brands = (brandRows ?? []) as Array<{ id: string; name: string }>;
  if (brands.length === 0) {
    return withCors(req, NextResponse.json({ data: [] }));
  }

  // 2) Брояч на публично-видими продукти по марка.
  const buildProductsQuery = (includeCondition: boolean) => {
    let q = applyPublicCatalogFilter(supabase.from("products").select("brand_id"));
    if (includeCondition && cond) q = q.eq("product_condition", cond);
    return q;
  };

  let { data: rows, error } = await buildProductsQuery(true);
  const isMissingConditionColumn =
    !!error &&
    (String((error as any).code ?? "") === "42703" ||
      String((error as any).message ?? "").includes("product_condition"));
  if (isMissingConditionColumn) {
    ({ data: rows, error } = await buildProductsQuery(false));
  }
  if (error) {
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  const counts = new Map<string, number>();
  for (const r of rows ?? []) {
    const bid = (r as { brand_id?: string | null }).brand_id;
    if (!bid) continue;
    counts.set(bid, (counts.get(bid) ?? 0) + 1);
  }

  let result = brands
    .map((b) => ({ name: b.name, productCount: counts.get(b.id) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name, "bg"));

  if (onlyWithProducts) {
    result = result.filter((b) => b.productCount > 0);
  }

  const res = withCors(req, NextResponse.json({ data: result }));
  res.headers.set("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
  return res;
}
