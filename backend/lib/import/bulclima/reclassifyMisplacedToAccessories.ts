import type { SupabaseClient } from "@supabase/supabase-js";
import type { BulclimaParsedProduct } from "./parseBulclimaHtml";
import { shouldMoveStoredProductToAccessories } from "./classifyBulclimaItem";
import { upsertBulclimaAccessory } from "./upsertBulclimaAccessory";

export type ReclassifyAccessoriesSummary = {
  scanned: number;
  moved: number;
  accessoriesCreated: number;
  accessoriesUpdated: number;
  deleted: number;
  skipped: number;
  errors: string[];
  dryRun: boolean;
  items: Array<{ productId: string; name: string; slug: string; action: string }>;
};

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  brand_id: string;
  description: string | null;
  price: number;
  model_code: string | null;
  brands: { name: string } | { name: string }[] | null;
  product_specs: Record<string, unknown> | Record<string, unknown>[] | null;
  product_images: Array<{ url: string; sort_order: number; is_main: boolean }> | null;
};

function brandNameFromRow(row: ProductRow): string | null {
  const b = row.brands;
  if (!b) return null;
  if (Array.isArray(b)) return b[0]?.name ?? null;
  return b.name ?? null;
}

function specsFromRow(row: ProductRow): BulclimaParsedProduct["specs"] {
  const raw = row.product_specs;
  const s = (Array.isArray(raw) ? raw[0] : raw) as Record<string, unknown> | null | undefined;
  if (!s) return {};
  return {
    btu: (s.btu as number | null) ?? null,
    coverage_m2: (s.coverage_m2 as number | null) ?? null,
    noise_db: (s.noise_db as number | null) ?? null,
    cooling_power_kw: (s.cooling_power_kw as number | null) ?? null,
    heating_power_kw: (s.heating_power_kw as number | null) ?? null,
    refrigerant: (s.refrigerant as string | null) ?? null,
    wifi: (s.wifi as boolean | null) ?? null,
    energy_class_cool: (s.energy_class_cool as string | null) ?? null,
    energy_class_heat: (s.energy_class_heat as string | null) ?? null,
    seer: (s.seer as number | null) ?? null,
    scop: (s.scop as number | null) ?? null,
  };
}

function toParsedProduct(row: ProductRow, imageUrls: string[]): BulclimaParsedProduct {
  return {
    sourceUrl: "",
    name: row.name,
    modelCode: row.model_code,
    brandName: brandNameFromRow(row),
    priceEur: Number(row.price),
    priceWithMountEur: null,
    description: row.description,
    imageUrls,
    categorySlug: null,
    typeHint: null,
    featureLabels: [],
    specs: specsFromRow(row),
  };
}

async function loadCandidateProducts(supabase: SupabaseClient): Promise<ProductRow[]> {
  const pageSize = 200;
  const rows: ProductRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("products")
      .select(
        `id, slug, name, brand_id, description, price, model_code,
        brands(name),
        product_specs(btu, coverage_m2, noise_db, cooling_power_kw, heating_power_kw, refrigerant, wifi, energy_class_cool, energy_class_heat, seer, scop),
        product_images(url, sort_order, is_main)`,
      )
      .order("name")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(error.message);
    const batch = (data ?? []) as ProductRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function reclassifyMisplacedProductsToAccessories(
  supabase: SupabaseClient,
  opts?: { dryRun?: boolean },
): Promise<ReclassifyAccessoriesSummary> {
  const dryRun = opts?.dryRun === true;
  const summary: ReclassifyAccessoriesSummary = {
    scanned: 0,
    moved: 0,
    accessoriesCreated: 0,
    accessoriesUpdated: 0,
    deleted: 0,
    skipped: 0,
    errors: [],
    dryRun,
    items: [],
  };

  const products = await loadCandidateProducts(supabase);
  summary.scanned = products.length;

  for (const row of products) {
    const specs = specsFromRow(row);
    if (!shouldMoveStoredProductToAccessories(row.name, row.slug, specs)) {
      summary.skipped++;
      continue;
    }

    const images = [...(row.product_images ?? [])].sort((a, b) => a.sort_order - b.sort_order);
    const imageUrls = images.map((i) => i.url).filter(Boolean);
    const parsed = toParsedProduct(row, imageUrls);
    const brandId = row.brand_id;

    if (dryRun) {
      summary.moved++;
      summary.items.push({
        productId: row.id,
        name: row.name,
        slug: row.slug,
        action: "would_move",
      });
      continue;
    }

    try {
      const upsertResult = await upsertBulclimaAccessory(supabase, brandId, parsed, { preferredSlug: row.slug });
      if (upsertResult === "created") summary.accessoriesCreated++;
      else if (upsertResult === "updated") summary.accessoriesUpdated++;

      const { error: delError } = await supabase.from("products").delete().eq("id", row.id);
      if (delError) throw new Error(delError.message);

      summary.moved++;
      summary.deleted++;
      summary.items.push({
        productId: row.id,
        name: row.name,
        slug: row.slug,
        action: upsertResult === "created" ? "moved_new_accessory" : "moved_merged_accessory",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push(`${row.slug}: ${msg}`);
    }
  }

  return summary;
}
