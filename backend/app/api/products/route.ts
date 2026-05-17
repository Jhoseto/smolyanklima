import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { stripImportSourceFromDescription } from "@/lib/import/stripImportSourceFromDescription";
import { withCloudinaryWebOptimization } from "@/lib/services/cloudinaryService";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { parseBtuCsvParam, resolveProductIdsForBtuList } from "@/lib/catalog/productBtu";
import { applyPublicCatalogFilter } from "@/lib/catalog/publicProductVisibility";

const QuerySchema = z.object({
  q: z.string().optional(),
  cat: z.string().optional(),
  b: z.string().optional(),
  e: z.string().optional(),
  f: z.string().optional(),
  min: z.coerce.number().optional(),
  max: z.coerce.number().optional(),
  cond: z.enum(["new", "used"]).optional(),
  /** Номинали BTU (хиляди), CSV: 7,9,12 */
  btu: z.string().optional(),
  s: z
    .enum(["recommended", "price-asc", "price-desc", "energy-class", "noise-asc", "rating-desc"])
    .optional(),
  page: z.coerce.number().int().min(1).optional(),
  perPage: z.coerce.number().int().min(1).max(100).optional(),
});

function splitCsv(value?: string) {
  if (!value) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function intersectIds(a: string[], b: string[]): string[] {
  const setB = new Set(b);
  return a.filter((id) => setB.has(id));
}

const CATEGORY_TYPE_FALLBACK: Record<string, string[]> = {
  wall: ["Стенен климатик", "Дизайнерски климатик"],
  multi: ["Мулти-сплит система"],
  cassette: ["Касетъчен климатик"],
  floor: ["Подов климатик"],
  ceiling: ["Таванен климатик"],
};

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  if (!parsed.success) {
    return withCors(req, NextResponse.json({ error: "Invalid query" }, { status: 400 }));
  }

  const { q, cat, b, e, f, min, max, cond, btu: btuCsv, s, page = 1, perPage = 24 } = parsed.data;
  const brandNames = splitCsv(b);
  const energyClasses = splitCsv(e);
  const featureTerms = splitCsv(f);
  const btuFilters = parseBtuCsvParam(btuCsv);

  const supabase = createSupabaseServiceRoleClient();

  /** `null` = no id restriction; non-null array = restrict to these ids; `empty` = impossible match */
  let idRestriction: string[] | null | "empty" = null;

  function mergeProductIds(ids: string[]): void {
    if (ids.length === 0) {
      idRestriction = "empty";
      return;
    }
    if (idRestriction === "empty") return;
    const prev = idRestriction;
    idRestriction = prev === null ? ids : intersectIds(prev, ids);
    if (idRestriction.length === 0) idRestriction = "empty";
  }

  // Search (FTS + ILIKE via RPC; fallback if migration not applied yet)
  if (q && q.trim()) {
    const term = q.trim();
    const { data: searchRows, error: rpcErr } = await supabase.rpc("search_product_ids", {
      search_query: term,
      result_limit: 5000,
    });
    let ids: string[] = [];
    if (rpcErr) {
      const { data: fb, error: fbErr } = await applyPublicCatalogFilter(
        supabase.from("products").select("id"),
      ).or(`name.ilike.%${term}%,description.ilike.%${term}%`);
      if (fbErr) return withCors(req, NextResponse.json({ error: fbErr.message }, { status: 500 }));
      ids = (fb ?? []).map((r: { id: string }) => r.id);
    } else {
      ids = (searchRows ?? []).map((r: { id: string }) => r.id).filter(Boolean);
    }
    mergeProductIds(ids);
  }

  // Category slug → product_type ids
  if (cat && cat !== "all") {
    const { data: catRow } = await supabase.from("categories").select("id").eq("slug", cat).maybeSingle();
    if (!catRow?.id) {
      mergeProductIds([]);
    } else {
      const { data: ctRows } = await supabase
        .from("category_types")
        .select("product_type")
        .eq("category_id", catRow.id);
      const relationTypeNames = (ctRows ?? []).map((r) => r.product_type).filter(Boolean);
      const fallbackTypeNames = CATEGORY_TYPE_FALLBACK[cat] ?? [];
      const typeNames = Array.from(new Set([...relationTypeNames, ...fallbackTypeNames]));
      if (typeNames.length === 0) {
        mergeProductIds([]);
      } else {
        const { data: types } = await supabase.from("product_types").select("id").in("name", typeNames);
        const typeIds = (types ?? []).map((t: { id: string }) => t.id);
        const { data: prows } = await applyPublicCatalogFilter(supabase.from("products").select("id")).in(
          "type_id",
          typeIds,
        );
        mergeProductIds((prows ?? []).map((p: { id: string }) => p.id));
      }
    }
  }

  // Brand names → brand_id → product ids
  if (brandNames.length > 0) {
    const { data: brows } = await supabase.from("brands").select("id").in("name", brandNames);
    const brandIds = (brows ?? []).map((r: { id: string }) => r.id);
    if (brandIds.length === 0) {
      mergeProductIds([]);
    } else {
      const { data: prows } = await applyPublicCatalogFilter(supabase.from("products").select("id")).in(
        "brand_id",
        brandIds,
      );
      mergeProductIds((prows ?? []).map((p: { id: string }) => p.id));
    }
  }

  if (btuFilters.length > 0) {
    const specIds = await resolveProductIdsForBtuList(supabase, btuFilters);
    if (specIds.length === 0) {
      mergeProductIds([]);
    } else {
      const { data: prows } = await applyPublicCatalogFilter(supabase.from("products").select("id")).in(
        "id",
        specIds,
      );
      mergeProductIds((prows ?? []).map((p: { id: string }) => p.id));
    }
  }

  // Energy classes via product_specs
  if (energyClasses.length > 0) {
    const { data: srows } = await supabase
      .from("product_specs")
      .select("product_id")
      .in("energy_class_cool", energyClasses);
    const ids = [...new Set((srows ?? []).map((r: { product_id: string }) => r.product_id).filter(Boolean))];
    mergeProductIds(ids);
  }

  // Features: AND — product must match every term (ilike on feature name)
  for (const term of featureTerms) {
    const { data: feats } = await supabase.from("features").select("id").ilike("name", `%${term}%`);
    const featIds = (feats ?? []).map((r: { id: string }) => r.id);
    if (featIds.length === 0) {
      mergeProductIds([]);
      break;
    }
    const { data: links } = await supabase.from("product_features").select("product_id").in("feature_id", featIds);
    const ids = [...new Set((links ?? []).map((r: { product_id: string }) => r.product_id))];
    mergeProductIds(ids);
  }

  if (idRestriction === "empty") {
    return withCors(
      req,
      NextResponse.json({
        data: [],
        meta: { page, perPage, total: 0 },
      }),
    );
  }

  // ===================================================================
  // ГРУПИРАНЕ НА КАТАЛОГА ПО МОДЕЛ (deduplication)
  // ---------------------------------------------------------------------
  // В per-instance архитектурата (миграция 0038) всеки физически уред е
  // отделен запис в `products`. Без групиране клиентът би видял 2-3
  // еднакви картички за същия модел.
  //
  // Стратегия:
  //  1. Lightweight fetch на ID-та + ключови sort-полета, прилагайки
  //     всички текущи филтри.
  //  2. Application-level groupBy по (brand_id, lower(model_code)) —
  //     един представител на модел (in_stock се предпочита пред on_order,
  //     при равни → най-малко продаден, при равни → най-стар по дата).
  //  3. Pagination се прави върху списъка с представители.
  //  4. Final fetch — пълните данни за paginated representatives.
  //
  //  Записи без `model_code` (legacy/per-record) остават неdedupнати —
  //  всеки запис е своят собствен „модел“.
  // ===================================================================
  const dedupSelect = "id,brand_id,model_code,stock_status,price,sold_quantity,created_at,product_condition,is_featured,rating,reviews_count";
  const buildDedupQuery = (includeCondition: boolean) => {
    let q = applyPublicCatalogFilter(
      (supabase.from("products") as any).select(
        includeCondition ? dedupSelect : dedupSelect.replace(",product_condition", ""),
      ),
    );
    if (idRestriction !== null && idRestriction !== "empty") q = q.in("id", idRestriction);
    if (typeof min === "number") q = q.gte("price", min);
    if (typeof max === "number") q = q.lte("price", max);
    if (includeCondition && cond) q = q.eq("product_condition", cond);
    // Sort: in_stock пред on_order; sold_quantity ASC (предпочитаме нови
    // непродадени); created_at ASC (best stable representative).
    switch (s) {
      case "price-asc":
        q = q.order("price", { ascending: true });
        break;
      case "price-desc":
        q = q.order("price", { ascending: false });
        break;
      case "rating-desc":
        q = q.order("rating", { ascending: false }).order("reviews_count", { ascending: false });
        break;
      case "energy-class":
      case "noise-asc":
        // Sort по specs се прави по-късно — тук само стабилен fallback.
        q = q.order("is_featured", { ascending: false }).order("rating", { ascending: false });
        break;
      default:
        q = q
          .order("reviews_count", { ascending: false })
          .order("rating", { ascending: false })
          .order("is_featured", { ascending: false });
    }
    // Tie-break: предпочитаме in_stock пред on_order, най-малко продаден,
    // най-стар по дата (стабилен представител на модела).
    q = q.order("stock_status", { ascending: true });
    q = q.order("sold_quantity", { ascending: true, nullsFirst: true });
    q = q.order("created_at", { ascending: true });
    return q.limit(2000); // safety upper bound — магазинът няма столько публични артикули.
  };

  let dedupRes: any = await buildDedupQuery(true);
  if (
    dedupRes.error &&
    (String(dedupRes.error.code ?? "") === "42703" ||
      /product_condition|model_code|sold_quantity/.test(String(dedupRes.error.message ?? "")))
  ) {
    // Fallback за DB без миграция 0038 (липсва model_code) или 0007 (product_condition).
    dedupRes = await buildDedupQuery(false);
    if (dedupRes.error && /model_code/.test(String(dedupRes.error.message ?? ""))) {
      // Като последна резерва — само ID и stock_status, без dedup (legacy DB).
      dedupRes = await applyPublicCatalogFilter(
        (supabase.from("products") as any).select("id,stock_status,price"),
      ).limit(2000);
    }
  }
  if (dedupRes.error) {
    return withCors(req, NextResponse.json({ error: dedupRes.error.message }, { status: 500 }));
  }

  const dedupSeen = new Set<string>();
  const representativeIds: string[] = [];
  for (const row of (dedupRes.data ?? []) as Array<Record<string, unknown>>) {
    const brand = String(row.brand_id ?? "");
    const model = String(row.model_code ?? "").trim().toLowerCase();
    const key = brand && model ? `${brand}:${model}` : `__instance:${row.id}`;
    if (dedupSeen.has(key)) continue;
    dedupSeen.add(key);
    representativeIds.push(String(row.id));
  }

  const totalRepresentatives = representativeIds.length;
  if (totalRepresentatives === 0) {
    return withCors(
      req,
      NextResponse.json({ data: [], meta: { page, perPage, total: 0 } }),
    );
  }

  const from = (page - 1) * perPage;
  const to = from + perPage - 1;
  const pageRepresentativeIds = representativeIds.slice(from, to + 1);
  // Подменяме главната ID-рестрикция със страничната група представители —
  // оттук нататък целият код работи само върху тях.
  idRestriction = pageRepresentativeIds.length > 0 ? pageRepresentativeIds : "empty";

  const buildQuery = (includeCondition: boolean) => {
    const selectCols = includeCondition
      ? `
      id, slug, name, description, price, price_with_mount, product_condition,
      is_featured, rating, reviews_count,
      meta_title, meta_description,
      brand_id, type_id
    `
      : `
      id, slug, name, description, price, price_with_mount,
      is_featured, rating, reviews_count,
      meta_title, meta_description,
      brand_id, type_id
    `;
    let query = applyPublicCatalogFilter(
      (supabase.from("products") as any).select(selectCols, { count: "exact" }),
    );
    if (idRestriction !== null && idRestriction !== "empty") query = query.in("id", idRestriction);
    if (typeof min === "number") query = query.gte("price", min);
    if (typeof max === "number") query = query.lte("price", max);
    if (includeCondition && cond) query = query.eq("product_condition", cond);

    switch (s) {
      case "price-asc":
        query = query.order("price", { ascending: true });
        break;
      case "price-desc":
        query = query.order("price", { ascending: false });
        break;
      case "rating-desc":
        query = query.order("rating", { ascending: false });
        break;
      case "energy-class":
        query = query.order("id", { ascending: true });
        break;
      case "noise-asc":
        query = query.order("id", { ascending: true });
        break;
      default:
        query = query
          .order("reviews_count", { ascending: false })
          .order("rating", { ascending: false })
          .order("is_featured", { ascending: false });
    }
    return query;
  };

  // Final fetch — само за paginated представителите (idRestriction вече
  // е заместен с pageRepresentativeIds). Не ползваме `.range()`, защото
  // ограничението по ID е по-стриктно.
  let { data, error } = await buildQuery(true);
  const isMissingConditionColumn =
    !!error &&
    (String((error as any).code ?? "") === "42703" ||
      String((error as any).message ?? "").includes("product_condition"));
  if (isMissingConditionColumn) {
    ({ data, error } = await buildQuery(false));
  }

  if (error) {
    return withCors(req, NextResponse.json({ error: error.message }, { status: 500 }));
  }

  // Total count е броят УНИКАЛНИ модели след dedup-а (не raw COUNT
  // на инстанциите), за да съответства на pagination логиката.
  const count = totalRepresentatives;

  // Stable re-order: PostgreSQL не гарантира ред при `.in("id", ...)`,
  // затова сортираме връщаните редове според pageRepresentativeIds.
  const orderIdx = new Map(pageRepresentativeIds.map((id, i) => [id, i]));
  let rows = ((data ?? []) as Array<Record<string, unknown>>).slice().sort((a, b) => {
    const ai = orderIdx.get(String(a.id)) ?? 999;
    const bi = orderIdx.get(String(b.id)) ?? 999;
    return ai - bi;
  });

  // Client-visible sort for specs-backed fields (same-page only; total count still correct)
  if ((s === "noise-asc" || s === "energy-class") && rows.length > 1) {
    const pids = rows.map((r) => r.id as string);
    const { data: specRows } = await supabase
      .from("product_specs")
      .select("product_id,noise_db,energy_class_cool")
      .in("product_id", pids);
    const specByPid = new Map((specRows ?? []).map((r: any) => [r.product_id as string, r]));
    rows = [...rows].sort((a, b) => {
      const sa = specByPid.get(a.id as string);
      const sb = specByPid.get(b.id as string);
      if (s === "noise-asc") {
        const na = Number(sa?.noise_db ?? 999);
        const nb = Number(sb?.noise_db ?? 999);
        return na - nb;
      }
      const ea = String(sa?.energy_class_cool ?? "");
      const eb = String(sb?.energy_class_cool ?? "");
      return eb.localeCompare(ea);
    });
  }

  const brandIds = Array.from(new Set(rows.map((r) => r.brand_id).filter(Boolean))) as string[];
  const typeIds = Array.from(new Set(rows.map((r) => r.type_id).filter(Boolean))) as string[];
  const productIds = rows.map((r) => r.id as string);

  const SPECS_LIST_SELECT_WITH_DIMENSIONS =
    "product_id,coverage_m2,noise_db,cooling_power_kw,heating_power_kw,refrigerant,wifi,energy_class_cool,energy_class_heat,seer,scop,warranty_months,weight_indoor_kg,weight_outdoor_kg,dim_indoor_length_mm,dim_indoor_width_mm,dim_indoor_height_mm,dim_outdoor_length_mm,dim_outdoor_width_mm,dim_outdoor_height_mm";
  const SPECS_LIST_SELECT_BASE =
    "product_id,coverage_m2,noise_db,cooling_power_kw,heating_power_kw,refrigerant,wifi,energy_class_cool,energy_class_heat,seer,scop,warranty_months";

  const fetchSpecsForProducts = async () => {
    if (productIds.length === 0) return { data: [], error: null } as { data: unknown[]; error: { message?: string; code?: string } | null };
    let res = await supabase
      .from("product_specs")
      .select(SPECS_LIST_SELECT_WITH_DIMENSIONS)
      .in("product_id", productIds);
    if (
      res.error &&
      (String((res.error as any).code ?? "") === "42703" ||
        /weight_(indoor|outdoor)_kg|dim_(indoor|outdoor)_(length|width|height)_mm/.test(
          String((res.error as any).message ?? ""),
        ))
    ) {
      res = (await supabase
        .from("product_specs")
        .select(SPECS_LIST_SELECT_BASE)
        .in("product_id", productIds)) as typeof res;
    }
    return res as { data: unknown[]; error: { message?: string; code?: string } | null };
  };

  const [brandsRes, typesRes, specsRes, imagesRes, pfRes] = await Promise.all([
    brandIds.length > 0 ? supabase.from("brands").select("id,slug,name").in("id", brandIds) : Promise.resolve({ data: [], error: null } as any),
    typeIds.length > 0 ? supabase.from("product_types").select("id,name").in("id", typeIds) : Promise.resolve({ data: [], error: null } as any),
    fetchSpecsForProducts(),
    productIds.length > 0 ? supabase.from("product_images").select("product_id,url,sort_order,is_main").in("product_id", productIds) : Promise.resolve({ data: [], error: null } as any),
    productIds.length > 0 ? supabase.from("product_features").select("product_id,feature_id").in("product_id", productIds) : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (brandsRes.error) return withCors(req, NextResponse.json({ error: brandsRes.error.message }, { status: 500 }));
  if (typesRes.error) return withCors(req, NextResponse.json({ error: typesRes.error.message }, { status: 500 }));
  if (specsRes.error) return withCors(req, NextResponse.json({ error: specsRes.error.message }, { status: 500 }));
  if (imagesRes.error) return withCors(req, NextResponse.json({ error: imagesRes.error.message }, { status: 500 }));
  if (pfRes.error) return withCors(req, NextResponse.json({ error: pfRes.error.message }, { status: 500 }));

  const brandById = new Map((brandsRes.data ?? []).map((b: any) => [b.id, b]));
  const typeById = new Map((typesRes.data ?? []).map((t: any) => [t.id, t]));
  const specsByProduct = new Map<string, any[]>();
  for (const srow of specsRes.data ?? []) {
    const pid = (srow as any).product_id as string;
    const arr = specsByProduct.get(pid) ?? [];
    arr.push({ ...(srow as Record<string, unknown>), product_id: undefined });
    specsByProduct.set(pid, arr);
  }
  const imagesByProduct = new Map<string, any[]>();
  for (const irow of imagesRes.data ?? []) {
    const pid = (irow as any).product_id as string;
    const arr = imagesByProduct.get(pid) ?? [];
    arr.push({
      url: withCloudinaryWebOptimization((irow as any).url),
      sort_order: (irow as any).sort_order,
      is_main: (irow as any).is_main,
    });
    imagesByProduct.set(pid, arr);
  }

  const featureIds = Array.from(new Set((pfRes.data ?? []).map((r: any) => r.feature_id).filter(Boolean)));
  const featRes =
    featureIds.length > 0 ? await supabase.from("features").select("id,slug,name").in("id", featureIds) : ({ data: [], error: null } as any);
  if (featRes.error) return withCors(req, NextResponse.json({ error: featRes.error.message }, { status: 500 }));
  const featById = new Map((featRes.data ?? []).map((f: any) => [f.id, f as any]));
  const featsByProduct = new Map<string, any[]>();
  for (const link of pfRes.data ?? []) {
    const pid = (link as any).product_id as string;
    const f = featById.get((link as any).feature_id) as any;
    if (!f) continue;
    const arr = featsByProduct.get(pid) ?? [];
    arr.push({ features: { slug: f.slug, name: f.name } });
    featsByProduct.set(pid, arr);
  }

  const stitched = rows.map((r) => ({
    ...r,
    description: stripImportSourceFromDescription(r.description as string | null | undefined),
    brands: brandById.get(r.brand_id as string) ?? null,
    product_types: typeById.get(r.type_id as string) ?? null,
    product_specs: specsByProduct.get(r.id as string) ?? [],
    product_images: imagesByProduct.get(r.id as string) ?? [],
    product_features: featsByProduct.get(r.id as string) ?? [],
  }));

  return withCors(
    req,
    NextResponse.json({
      data: stitched,
      meta: { page, perPage, total: count ?? 0 },
    }),
  );
}
