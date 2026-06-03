import { NextRequest, NextResponse } from "next/server";
import { corsPreflight, withCors } from "@/lib/http/cors";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withCloudinaryWebOptimization } from "@/lib/services/cloudinaryService";
import { isPostgrestMissingColumn } from "@/lib/admin/pgMissingColumn";
import { loadCatalogMountDefaults, resolvePublicPriceWithMount } from "@/lib/catalog/catalogMountPrice";
import { applyPublicCatalogFilter } from "@/lib/catalog/publicProductVisibility";

// Публичен endpoint за секцията „Топ продукти“ на главната страница.
// Връща картата на до 6 слота (позиции 1..6), стейтф със симетрия на
// данните, които очаква фронтенд компонентът ProductsSection.

const SELECT_WITH_FEATURED =
  "id,slug,name,price,price_with_mount,product_condition,is_featured,featured_position,featured_badge,rating,reviews_count,brand_id,type_id";
const SELECT_WITH_FEATURED_NO_CONDITION = SELECT_WITH_FEATURED.replace(",product_condition", "");

const SPECS_SELECT =
  "product_id,cooling_power_kw,heating_power_kw,energy_class_cool,refrigerant,wifi,noise_db";

type FeaturedProductRow = {
  id: string;
  slug: string;
  name: string;
  price: number | null;
  price_with_mount: number | null;
  product_condition?: string | null;
  is_featured?: boolean | null;
  featured_position: number;
  featured_badge: string | null;
  rating: number | null;
  reviews_count: number | null;
  brand_id: string | null;
  type_id: string | null;
};

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req);
}

export async function GET(req: NextRequest) {
  const supabase = createSupabaseServiceRoleClient();
  const isDebug = req.nextUrl.searchParams.get("debug") === "1";

  // 1) Извличаме всички продукти с присвоена featured_position.
  //    Ако миграция 0035 още не е приложена, връщаме празен масив.
  const loadFeatured = (selectCols: string) =>
    applyPublicCatalogFilter(
      supabase
        .from("products")
        .select(selectCols)
        .not("featured_position", "is", null)
        .eq("is_active", true),
    ).order("featured_position", { ascending: true });

  let { data: featuredRows, error } = await loadFeatured(SELECT_WITH_FEATURED);
  if (error && isPostgrestMissingColumn(error, "product_condition")) {
    ({ data: featuredRows, error } = await loadFeatured(SELECT_WITH_FEATURED_NO_CONDITION));
  }

  // Fallback: ако миграция 0035 не е приложена (липсва featured_position
  // или featured_badge), просто връщаме празен масив. Това НЕ е грешка —
  // нормално поведение преди администраторът да назначи топ продукти.
  if (
    error &&
    (isPostgrestMissingColumn(error, "featured_position") ||
      isPostgrestMissingColumn(error, "featured_badge"))
  ) {
    return withCors(
      req,
      NextResponse.json(
        isDebug
          ? { data: [], debug: { reason: "missing_column", error: error.message } }
          : { data: [] },
      ),
    );
  }

  // Fallback за по-нови / по-различни схеми: ако грешката е друга (напр.
  // RLS или нестандартна колона), вместо 500 връщаме празно + лог, за да
  // не чупим главната страница. Това е важно, защото секцията „Топ
  // продукти“ е незадължителна.
  if (error) {
    console.error("[featured-products] unexpected select error:", error);
    return withCors(
      req,
      NextResponse.json(
        isDebug
          ? { data: [], debug: { reason: "select_error", error: { message: error.message, code: (error as any).code, details: (error as any).details } } }
          : { data: [] },
      ),
    );
  }

  const rows = (featuredRows ?? []) as unknown as FeaturedProductRow[];
  if (rows.length === 0) {
    return withCors(
      req,
      NextResponse.json(
        isDebug ? { data: [], debug: { reason: "no_visible_rows", note: "Няма продукти със featured_position, които да са активни и в наличност." } } : { data: [] },
      ),
    );
  }

  const ids = rows.map((r) => r.id);
  const brandIds = Array.from(new Set(rows.map((r) => r.brand_id).filter(Boolean))) as string[];
  const typeIds = Array.from(new Set(rows.map((r) => r.type_id).filter(Boolean))) as string[];

  // 2) Зареждаме допълнителните детайли паралелно — за UI картичката ни
  //    трябват: основна снимка, марка, тип, и основните спецификации.
  const [brandsRes, typesRes, imagesRes, specsRes] = await Promise.all([
    brandIds.length > 0
      ? supabase.from("brands").select("id,slug,name").in("id", brandIds)
      : Promise.resolve({ data: [], error: null } as any),
    typeIds.length > 0
      ? supabase.from("product_types").select("id,name").in("id", typeIds)
      : Promise.resolve({ data: [], error: null } as any),
    supabase
      .from("product_images")
      .select("product_id,url,sort_order,is_main")
      .in("product_id", ids),
    supabase.from("product_specs").select(SPECS_SELECT).in("product_id", ids),
  ]);

  // Грешките в спомагателните заявки само се логват — секцията „Топ продукти“
  // НЕ трябва да чупи цялата начална страница. Просто ще се покажат картички
  // без съответната метаинформация (марка/тип/снимка/specs).
  if (brandsRes.error) console.error("[featured-products] brands lookup:", brandsRes.error);
  if (typesRes.error) console.error("[featured-products] types lookup:", typesRes.error);
  if (imagesRes.error) console.error("[featured-products] images lookup:", imagesRes.error);
  if ((specsRes as any).error) console.error("[featured-products] specs lookup:", (specsRes as any).error);

  const brandById = new Map<string, { id: string; slug: string; name: string }>(
    (brandsRes.data ?? []).map((b: any) => [b.id, b]),
  );
  const typeById = new Map<string, { id: string; name: string }>(
    (typesRes.data ?? []).map((t: any) => [t.id, t]),
  );

  // Основна снимка (is_main = true, иначе най-малък sort_order, иначе първата).
  const mainImageByProduct = new Map<string, string>();
  const imagesByProduct = new Map<string, Array<{ url: string; sort_order: number; is_main: boolean }>>();
  for (const irow of imagesRes.data ?? []) {
    const pid = (irow as any).product_id as string;
    const url = withCloudinaryWebOptimization((irow as any).url as string);
    const arr = imagesByProduct.get(pid) ?? [];
    arr.push({ url, sort_order: (irow as any).sort_order ?? 0, is_main: !!(irow as any).is_main });
    imagesByProduct.set(pid, arr);
  }
  for (const [pid, arr] of imagesByProduct.entries()) {
    const main = arr.find((x) => x.is_main);
    const sorted = [...arr].sort((a, b) => a.sort_order - b.sort_order);
    mainImageByProduct.set(pid, (main ?? sorted[0])?.url ?? "");
  }

  const specsByProduct = new Map<string, any>();
  for (const sr of (specsRes as any).data ?? []) {
    specsByProduct.set((sr as any).product_id as string, sr);
  }

  const mountDefaults = await loadCatalogMountDefaults(supabase);

  const data = rows.map((r) => {
    const spec = specsByProduct.get(r.id) ?? {};
    const cooling = Number(spec.cooling_power_kw ?? 0);
    const heating = Number(spec.heating_power_kw ?? 0);
    const power = cooling || heating || 0;
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      price: r.price,
      priceWithMount: resolvePublicPriceWithMount({
        price: r.price,
        productCondition: r.product_condition,
        storedPriceWithMount: r.price_with_mount,
        mountDefaults,
      }),
      position: r.featured_position,
      badge: r.featured_badge,
      rating: r.rating ?? null,
      reviewCount: r.reviews_count ?? 0,
      brand: r.brand_id ? brandById.get(r.brand_id) ?? null : null,
      type: r.type_id ? typeById.get(r.type_id) ?? null : null,
      image: mainImageByProduct.get(r.id) ?? "",
      specs: {
        coolingKw: cooling || null,
        heatingKw: heating || null,
        powerKw: power || null,
        energyClass: spec.energy_class_cool ?? null,
        wifi: spec.wifi ?? null,
        noiseDb: spec.noise_db ?? null,
      },
    };
  });

  return withCors(req, NextResponse.json({ data }));
}
