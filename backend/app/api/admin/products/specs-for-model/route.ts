import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { adminDb } from "@/lib/admin/db";

/**
 * Извлича product_specs от друг продукт със същата (марка, модел).
 *
 * GET /api/admin/products/specs-for-model
 *      ?brandId=<uuid>&modelCode=<text>&excludeId=<uuid>
 */

const QuerySchema = z.object({
  brandId: z.string().uuid(),
  modelCode: z.string().min(1).max(120),
  excludeId: z.string().uuid().optional(),
});

type DbSpecsRow = {
  coverage_m2?: number | null;
  noise_db?: number | null;
  cooling_power_kw?: number | null;
  heating_power_kw?: number | null;
  refrigerant?: string | null;
  wifi?: boolean | null;
  energy_class_cool?: string | null;
  energy_class_heat?: string | null;
  seer?: number | null;
  scop?: number | null;
  warranty_months?: number | null;
  weight_indoor_kg?: number | null;
  weight_outdoor_kg?: number | null;
  dim_indoor_length_mm?: number | null;
  dim_indoor_width_mm?: number | null;
  dim_indoor_height_mm?: number | null;
  dim_outdoor_length_mm?: number | null;
  dim_outdoor_width_mm?: number | null;
  dim_outdoor_height_mm?: number | null;
};

function hasMinimumSpecs(specs: DbSpecsRow): boolean {
  const filled = [
    specs.cooling_power_kw,
    specs.energy_class_cool,
    specs.refrigerant,
  ].filter((v) => v != null && v !== "").length;
  return filled >= 2;
}

function mapSpecsToModelSpecs(specs: DbSpecsRow) {
  return {
    coverage_m2: specs.coverage_m2 ?? null,
    noise_db: specs.noise_db ?? null,
    cooling_power_kw: specs.cooling_power_kw ?? null,
    heating_power_kw: specs.heating_power_kw ?? null,
    energy_class_cool: specs.energy_class_cool ?? null,
    energy_class_heat: specs.energy_class_heat ?? null,
    seer: specs.seer ?? null,
    scop: specs.scop ?? null,
    warranty_months: specs.warranty_months ?? null,
    wifi: specs.wifi ?? null,
    weight_indoor_kg: specs.weight_indoor_kg ?? null,
    weight_outdoor_kg: specs.weight_outdoor_kg ?? null,
    dim_indoor_length_mm: specs.dim_indoor_length_mm ?? null,
    dim_indoor_width_mm: specs.dim_indoor_width_mm ?? null,
    dim_indoor_height_mm: specs.dim_indoor_height_mm ?? null,
    dim_outdoor_length_mm: specs.dim_outdoor_length_mm ?? null,
    dim_outdoor_width_mm: specs.dim_outdoor_width_mm ?? null,
    dim_outdoor_height_mm: specs.dim_outdoor_height_mm ?? null,
  };
}

const EMPTY_RESPONSE = {
  source: null,
  source_product_id: null,
  source_product_name: null,
  confidence: null,
  model_specs: null,
  refrigerant: null,
};

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  try {
    const params = Object.fromEntries(req.nextUrl.searchParams.entries());
    const parsed = QuerySchema.safeParse(params);
    if (!parsed.success) {
      return withCors(req, NextResponse.json({ error: "Невалидни параметри" }, { status: 400 }));
    }

    const supabase = await adminDb();
    const modelKey = parsed.data.modelCode.trim().toLowerCase();
    if (!modelKey) {
      return withCors(req, NextResponse.json({ data: EMPTY_RESPONSE }));
    }

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
      // eslint-disable-next-line no-console
      console.error("[specs-for-model] products query failed:", cErr.message);
      return withCors(req, NextResponse.json({ error: cErr.message }, { status: 500 }));
    }

    const exact = (candidates ?? []).filter(
      (c) => String((c as { model_code: string | null }).model_code ?? "").trim().toLowerCase() === modelKey,
    );

    for (const c of exact) {
      const productId = (c as { id: string }).id;
      const { data: specsRow, error: sErr } = await supabase
        .from("product_specs")
        .select("*")
        .eq("product_id", productId)
        .maybeSingle();
      if (sErr) {
        // eslint-disable-next-line no-console
        console.error("[specs-for-model] specs query failed:", sErr.message, { productId });
        continue;
      }
      if (!specsRow) continue;

      const specs = specsRow as DbSpecsRow;
      if (!hasMinimumSpecs(specs)) continue;

      return withCors(
        req,
        NextResponse.json({
          data: {
            source: "db" as const,
            source_product_id: productId,
            source_product_name: ((c as { name: string }).name) ?? null,
            confidence: "high" as const,
            model_specs: mapSpecsToModelSpecs(specs),
            refrigerant: specs.refrigerant ?? null,
          },
        }),
      );
    }

    return withCors(req, NextResponse.json({ data: EMPTY_RESPONSE }));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error("[specs-for-model] unhandled:", msg);
    const status = msg === "NOT_AUTHENTICATED" || msg === "NOT_ADMIN" ? 401 : 500;
    return withCors(req, NextResponse.json({ error: msg }, { status }));
  }
}
