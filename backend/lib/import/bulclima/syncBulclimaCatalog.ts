import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyBg } from "../slugify";
import { stripImportSourceFromDescription } from "../stripImportSourceFromDescription";
import { replaceProductImages, upsertProductSpecs, type ImageInput, type SpecsInput } from "@/lib/admin/syncProductChildren";
import {
  collectBulclimaProductUrls,
  fetchBulclimaHtml,
  parseBulclimaProductPage,
  type BulclimaParsedProduct,
} from "./parseBulclimaHtml";
import { classifyBulclimaCatalogItem } from "./classifyBulclimaItem";
import { applyBulclimaSupplierToProduct, backfillBulclimaSupplierOnProducts } from "./applyBulclimaSupplier";
import { ensureBulclimaSupplierId } from "./ensureBulclimaSupplier";
import { upsertBulclimaAccessory } from "./upsertBulclimaAccessory";
import { emitBulclimaProgress, type BulclimaSyncProgressHandler } from "./bulclimaSyncProgress";

export type { BulclimaSyncProgressEvent } from "./bulclimaSyncProgress";

export type BulclimaSyncSummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  productUrls: number;
  accessoriesCreated: number;
  accessoriesUpdated: number;
  /** UUID на доставчик „Булклима“ (null = не е намерен/създаден). */
  supplierId: string | null;
  /** Колко климатици получиха supplier_id при backfill след sync. */
  supplierBackfilled: number;
};

const FEATURE_KEYWORDS: Array<{ slug: string; patterns: RegExp[]; exclude?: RegExp[] }> = [
  // Exclude "(опция)" entries — they are optional adapters, not built-in
  {
    slug: "wifi",
    patterns: [/wi-?fi/i, /безжично\s+lan/i, /вграден\s+wi/i],
    exclude: [/опция/i, /adapter/i, /адаптер/i],
  },
  {
    slug: "inverter",
    patterns: [
      /инвертор/i,
      /инвepт/i,   // mixed homoglyph: "инвepтopeн" (Kaisai featureLabels with Latin е/р)
      /all\s+dc/i, // "All DC модели" — DC inverter motor
      /dc\s+мотор/i,
    ],
  },
  { slug: "night_mode", patterns: [/нощен/i, /тих режим/i, /сън/i, /sleep/i] },
  { slug: "self_cleaning", patterns: [/самопочистване/i, /heat\s+clean/i] },
  { slug: "ionizer", patterns: [/йон/i, /дезодориращ/i] },
  { slug: "turbo", patterns: [/мощен режим/i, /powerful/i, /турбо/i] },
];

type RefMaps = {
  brandByName: Map<string, string>;
  typeByName: Map<string, string>;
  categoryBySlug: Map<string, string>;
  featureBySlug: Map<string, string>;
  supplierId: string | null;
  defaultTypeId: string;
};

async function loadRefs(supabase: SupabaseClient): Promise<RefMaps> {
  const [brands, types, categories, features, supplierId] = await Promise.all([
    supabase.from("brands").select("id,name").eq("is_active", true),
    supabase.from("product_types").select("id,name"),
    supabase.from("categories").select("id,slug"),
    supabase.from("features").select("id,slug"),
    ensureBulclimaSupplierId(supabase),
  ]);

  const brandByName = new Map<string, string>();
  for (const b of brands.data ?? []) {
    brandByName.set(String(b.name).toLowerCase(), b.id as string);
  }

  const typeByName = new Map<string, string>();
  let defaultTypeId = "";
  for (const t of types.data ?? []) {
    typeByName.set(String(t.name).toLowerCase(), t.id as string);
    if (!defaultTypeId) defaultTypeId = t.id as string;
    if (/стен/i.test(String(t.name))) defaultTypeId = t.id as string;
  }
  if (!defaultTypeId && types.data?.[0]) defaultTypeId = types.data[0].id as string;

  const categoryBySlug = new Map<string, string>();
  for (const c of categories.data ?? []) {
    categoryBySlug.set(String(c.slug), c.id as string);
  }

  const featureBySlug = new Map<string, string>();
  for (const f of features.data ?? []) {
    featureBySlug.set(String(f.slug), f.id as string);
  }

  return {
    brandByName,
    typeByName,
    categoryBySlug,
    featureBySlug,
    supplierId,
    defaultTypeId,
  };
}

async function ensureBrand(supabase: SupabaseClient, brandByName: Map<string, string>, name: string): Promise<string | null> {
  const key = name.toLowerCase();
  const existing = brandByName.get(key);
  if (existing) return existing;

  const slug = slugifyBg(name);
  const { data, error } = await supabase
    .from("brands")
    .insert({ slug, name, color: "#6B7280", is_active: true })
    .select("id")
    .single();
  if (error) {
    const { data: fb } = await supabase.from("brands").select("id").eq("slug", slug).maybeSingle();
    if (fb?.id) {
      brandByName.set(key, fb.id as string);
      return fb.id as string;
    }
    return null;
  }
  brandByName.set(key, data.id as string);
  return data.id as string;
}

function resolveTypeId(refs: RefMaps, hint: string | null): string {
  if (hint) {
    for (const [name, id] of refs.typeByName) {
      if (name.includes(hint.toLowerCase()) || hint.toLowerCase().includes(name)) return id;
    }
  }
  return refs.defaultTypeId;
}

function resolveFeatureIds(refs: RefMaps, labels: string[], name: string, description: string | null): string[] {
  const ids = new Set<string>();
  // Always include name so "Инверторен климатик …" is matched regardless of description presence.
  const hay = `${name} ${description ?? ""} ${labels.join(" ")}`.toLowerCase();
  for (const { slug, patterns, exclude } of FEATURE_KEYWORDS) {
    if (patterns.some((p) => p.test(hay))) {
      // Skip if any exclusion pattern also matches (e.g. wifi "(опция)")
      if (exclude?.some((ex) => ex.test(hay))) continue;
      const id = refs.featureBySlug.get(slug);
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

async function uniqueSlug(supabase: SupabaseClient, base: string): Promise<string> {
  let slug = base || "product";
  let n = 0;
  while (n < 50) {
    const candidate = n === 0 ? slug : `${slug}-${n}`;
    const { data } = await supabase.from("products").select("id").eq("slug", candidate).maybeSingle();
    if (!data) return candidate;
    n++;
  }
  return `${slug}-${Date.now()}`;
}

async function findExistingProduct(
  supabase: SupabaseClient,
  brandId: string,
  modelCode: string | null,
  name: string,
): Promise<{ id: string; show_in_public_catalog: boolean | null } | null> {
  if (modelCode) {
    const { data } = await supabase
      .from("products")
      .select("id,show_in_public_catalog")
      .eq("brand_id", brandId)
      .ilike("model_code", modelCode)
      .limit(1)
      .maybeSingle();
    if (data?.id) return data as { id: string; show_in_public_catalog: boolean | null };
  }
  const { data } = await supabase.from("products").select("id,show_in_public_catalog").eq("brand_id", brandId).eq("name", name).maybeSingle();
  return (data as { id: string; show_in_public_catalog: boolean | null } | null) ?? null;
}

async function upsertOne(
  supabase: SupabaseClient,
  refs: RefMaps,
  item: BulclimaParsedProduct,
  syncedProductIds: string[],
): Promise<"created" | "updated" | "skipped"> {
  if (!item.brandName) return "skipped";

  const brandId = await ensureBrand(supabase, refs.brandByName, item.brandName);
  if (!brandId) return "skipped";

  const typeId = resolveTypeId(refs, item.typeHint);
  const categoryId = item.categorySlug ? (refs.categoryBySlug.get(item.categorySlug) ?? null) : null;

  const existing = await findExistingProduct(supabase, brandId, item.modelCode, item.name);
  const baseSlug = slugifyBg(item.modelCode ?? item.name);
  const slug = existing?.id ? undefined : await uniqueSlug(supabase, baseSlug);

  const description = stripImportSourceFromDescription(item.description);

  const productRow: Record<string, unknown> = {
    name: item.name,
    brand_id: brandId,
    type_id: typeId,
    category_id: categoryId,
    description,
    price: item.priceEur,
    price_with_mount: item.priceWithMountEur ?? item.priceEur + 200,
    model_code: item.modelCode,
    source_url: item.sourceUrl || null,
    product_condition: "new",
    stock_status: "on_order",
    stock_quantity: 0,
    sold_quantity: 0,
    is_active: true,
    is_featured: false,
    product_region: "europe",
    stock_location: "warehouse",
    meta_title: item.name.slice(0, 200),
    meta_description: (description ?? item.name).slice(0, 160),
  };

  if (refs.supplierId) {
    productRow.supplier_id = refs.supplierId;
  }

  if (!existing) {
    productRow.slug = slug;
    productRow.show_in_public_catalog = false;
    const { data, error } = await supabase.from("products").insert(productRow).select("id").single();
    if (error || !data?.id) throw new Error(error?.message ?? "insert failed");
    const productId = data.id as string;
    if (refs.supplierId) await applyBulclimaSupplierToProduct(supabase, productId, refs.supplierId);
    syncedProductIds.push(productId);
    await syncChildren(supabase, productId, item, refs);
    return "created";
  }

  const updateRow = { ...productRow };
  delete updateRow.show_in_public_catalog;
  const { error } = await supabase.from("products").update(updateRow).eq("id", existing.id);
  if (error) throw new Error(error.message);
  if (refs.supplierId) await applyBulclimaSupplierToProduct(supabase, existing.id, refs.supplierId);
  syncedProductIds.push(existing.id);
  await syncChildren(supabase, existing.id, item, refs);
  return "updated";
}

async function syncChildren(
  supabase: SupabaseClient,
  productId: string,
  item: BulclimaParsedProduct,
  refs: RefMaps,
): Promise<void> {
  const specs: SpecsInput = { ...item.specs };
  await upsertProductSpecs(supabase, productId, specs);

  if (item.imageUrls.length) {
    const images: ImageInput[] = item.imageUrls.map((url, i) => ({
      url,
      sort_order: i,
      is_main: i === 0,
    }));
    await replaceProductImages(supabase, productId, images);
  }

  const featureIds = resolveFeatureIds(refs, item.featureLabels, item.name, item.description);
  if (featureIds.length) {
    await supabase.from("product_features").delete().eq("product_id", productId);
    await supabase.from("product_features").insert(
      featureIds.map((feature_id) => ({ product_id: productId, feature_id })),
    );
  }
}

export async function runBulclimaCatalogSync(
  supabase: SupabaseClient,
  opts?: {
    limit?: number;
    listingUrls?: readonly string[];
    onProgress?: BulclimaSyncProgressHandler;
  },
): Promise<BulclimaSyncSummary> {
  if (process.env.BULCLIMA_TLS_INSECURE === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const onProgress = opts?.onProgress;
  const summary: BulclimaSyncSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    productUrls: 0,
    accessoriesCreated: 0,
    accessoriesUpdated: 0,
    supplierId: null,
    supplierBackfilled: 0,
  };
  const syncedClimateProductIds: string[] = [];

  emitBulclimaProgress(onProgress, { phase: "start", message: "Старт на синхронизация с bulclima.com…" });

  await supabase
    .from("product_catalog_settings")
    .upsert({ id: 1, bulclima_last_sync_status: "running", bulclima_last_sync_summary: null }, { onConflict: "id" });

  emitBulclimaProgress(onProgress, { phase: "crawl", message: "Зареждане на референции (марки, категории)…" });
  const refs = await loadRefs(supabase);
  summary.supplierId = refs.supplierId;
  if (!refs.supplierId) {
    summary.errors.push(
      "Липсва доставчик „Булклима“ в контакти — продуктите няма да получат supplier_id. Пуснете seed 0001_supplier_contacts.sql или създайте доставчик ръчно.",
    );
    emitBulclimaProgress(onProgress, {
      phase: "crawl",
      message: "Внимание: не е намерен доставчик Булклима в контакти.",
    });
  } else {
    emitBulclimaProgress(onProgress, { phase: "crawl", message: "Доставчик: Булклима (автоматично при импорт)." });
  }

  emitBulclimaProgress(onProgress, { phase: "crawl", message: "Обхождане на каталога bulclima.com…" });
  const entries = await collectBulclimaProductUrls(
    { limit: opts?.limit, listingUrls: opts?.listingUrls },
    (message) => {
      emitBulclimaProgress(onProgress, { phase: "crawl", message });
    },
  );
  summary.productUrls = entries.length;
  emitBulclimaProgress(onProgress, {
    phase: "import",
    message: `Намерени ${entries.length} продукта — започва импорт…`,
    current: 0,
    total: entries.length,
  });

  for (let i = 0; i < entries.length; i++) {
    const { url, listingCategoryPath } = entries[i]!;
    const current = i + 1;
    try {
      emitBulclimaProgress(onProgress, {
        phase: "import",
        message: `Зареждане ${current}/${entries.length}: ${url}`,
        current,
        total: entries.length,
        url,
      });
      const html = await fetchBulclimaHtml(url);
      const parsed = parseBulclimaProductPage(html, url, listingCategoryPath);
      if (!parsed) {
        summary.skipped++;
        emitBulclimaProgress(onProgress, {
          phase: "import",
          message: `Пропуснат (няма име/непознат HTML): ${url}`,
          current,
          total: entries.length,
          url,
          result: "skipped",
        });
        continue;
      }
      const catalogKind = classifyBulclimaCatalogItem(parsed, url);
      let result: "created" | "updated" | "skipped";
      let kindLabel: string;

      if (catalogKind === "accessory") {
        kindLabel = "аксесоар";
        let brandId: string | null = null;
        let brandSkipped = false;
        if (parsed.brandName) {
          brandId = await ensureBrand(supabase, refs.brandByName, parsed.brandName);
          if (!brandId) {
            brandSkipped = true;
            kindLabel = "аксесоар (марка?)";
          }
        }
        if (brandSkipped) {
          result = "skipped";
        } else {
          result = await upsertBulclimaAccessory(supabase, brandId, parsed, { supplierId: refs.supplierId });
          if (result === "created") summary.accessoriesCreated++;
          else if (result === "updated") summary.accessoriesUpdated++;
        }
      } else {
        result = await upsertOne(supabase, refs, parsed, syncedClimateProductIds);
        summary[result]++;
        kindLabel = "климатик";
      }

      if (result === "skipped" && catalogKind === "accessory") summary.skipped++;

      emitBulclimaProgress(onProgress, {
        phase: "import",
        message: `${result === "created" ? "Нов" : result === "updated" ? "Обновен" : "Пропуснат"} (${kindLabel}): ${parsed.name} · ${parsed.imageUrls.length} снимки`,
        current,
        total: entries.length,
        url,
        productName: parsed.name,
        result,
        imageCount: parsed.imageUrls.length,
      });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      summary.errors.push(`${url}: ${errMsg}`);
      emitBulclimaProgress(onProgress, {
        phase: "import",
        message: `Грешка: ${url} — ${errMsg}`,
        current,
        total: entries.length,
        url,
      });
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  if (refs.supplierId && syncedClimateProductIds.length) {
    try {
      summary.supplierBackfilled = await backfillBulclimaSupplierOnProducts(
        supabase,
        refs.supplierId,
        syncedClimateProductIds,
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      summary.errors.push(`Доставчик (backfill): ${msg}`);
    }
  }

  const status =
    summary.errors.length &&
    summary.created + summary.updated + summary.accessoriesCreated + summary.accessoriesUpdated === 0
      ? "error"
      : "ok";

  await supabase.from("product_catalog_settings").upsert(
    {
      id: 1,
      bulclima_last_sync_at: new Date().toISOString(),
      bulclima_last_sync_status: status,
      bulclima_last_sync_summary: summary,
    },
    { onConflict: "id" },
  );

  emitBulclimaProgress(onProgress, {
    phase: "done",
    message: `Готово: ${summary.created} климатици (нови), ${summary.updated} (обновени); ${summary.accessoriesCreated} аксесоара (нови), ${summary.accessoriesUpdated} (обновени); ${summary.skipped} пропуснати; доставчик: ${summary.supplierId ? "Булклима" : "липсва"}${summary.supplierBackfilled ? ` (+${summary.supplierBackfilled} попълнени)` : ""}; ${summary.errors.length} грешки`,
    current: entries.length,
    total: entries.length,
  });

  return summary;
}
