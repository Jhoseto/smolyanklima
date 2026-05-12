import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

/**
 * Извлича готовите Cloudinary снимки за продукт със същата (марка, модел).
 *
 * GET /api/admin/products/photos-for-model
 *      ?brandId=<uuid>&modelCode=<text>&excludeId=<uuid>
 *
 * Връща:
 *   {
 *     data: {
 *       source_product_id: <uuid> | null,
 *       source_product_name: <string> | null,
 *       images: Array<{ url, sort_order, is_main }>,
 *     }
 *   }
 *
 * Семантика:
 *  - Търси първия друг продукт със същата (brand_id, lower(model_code)),
 *    подреждайки по `created_at ASC` за стабилност.
 *  - Връща `product_images` от него (вече оптимизирани в Cloudinary).
 *  - Ако няма съвпадение → връща празен списък.
 *  - Целта е UI да предложи „линкни тези снимки“ вместо повторно качване.
 */

const QuerySchema = z.object({
  brandId: z.string().uuid(),
  modelCode: z.string().min(1).max(120),
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
  const modelKey = parsed.data.modelCode.trim().toLowerCase();
  if (!modelKey) {
    return withCors(
      req,
      NextResponse.json({ data: { source_product_id: null, source_product_name: null, images: [] } }),
    );
  }

  // 1) Намери първия продукт със същия (brand, model_code), който има поне една
  //    снимка. Sortираме по created_at ASC за стабилно поведение (винаги
  //    предлагаме същия източник на снимки).
  let candidatesQuery = supabase
    .from("products")
    .select("id,name,model_code,created_at")
    .eq("brand_id", parsed.data.brandId)
    .ilike("model_code", modelKey)
    .order("created_at", { ascending: true })
    .limit(20);
  if (parsed.data.excludeId) candidatesQuery = candidatesQuery.neq("id", parsed.data.excludeId);

  const { data: candidates, error: cErr } = await candidatesQuery;
  if (cErr) {
    return withCors(req, NextResponse.json({ error: cErr.message }, { status: 500 }));
  }

  // Application-level точно сравнение на model_code (защитава срещу ilike
  // wildcard символи). Iterираме по реда, за да върнем най-стария продукт
  // с готов набор снимки.
  const exact = (candidates ?? []).filter(
    (c) => String((c as { model_code: string | null }).model_code ?? "").trim().toLowerCase() === modelKey,
  );

  for (const c of exact) {
    const { data: imgs, error: iErr } = await supabase
      .from("product_images")
      .select("url,sort_order,is_main")
      .eq("product_id", (c as { id: string }).id)
      .order("sort_order", { ascending: true });
    if (iErr) continue;
    if ((imgs ?? []).length > 0) {
      return withCors(
        req,
        NextResponse.json({
          data: {
            source_product_id: (c as { id: string }).id,
            source_product_name: ((c as { name: string }).name) ?? null,
            images: (imgs ?? []).map((row) => ({
              url: (row as { url: string }).url,
              sort_order: (row as { sort_order: number | null }).sort_order ?? 0,
              is_main: Boolean((row as { is_main: boolean | null }).is_main),
            })),
          },
        }),
      );
    }
  }

  // Няма подходящ съществуващ модел със снимки.
  return withCors(
    req,
    NextResponse.json({ data: { source_product_id: null, source_product_name: null, images: [] } }),
  );
}
