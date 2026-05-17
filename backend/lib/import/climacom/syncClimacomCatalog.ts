import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyBg } from "../slugify";
import { replaceProductImages, upsertProductSpecs, type ImageInput, type SpecsInput } from "@/lib/admin/syncProductChildren";
import { collectClimacomCatalogProducts } from "./collectClimacomProducts";
import {
  fetchClimacomHtml,
  parseClimacomProduct,
  type ClimacomParsedProduct,
} from "./parseClimacomProduct";
import { classifyClimacomCatalogItem } from "./classifyClimacomItem";
import { applyKlimakomSupplierToProduct, backfillKlimakomSupplierOnProducts } from "./applyKlimakomSupplier";
import { ensureKlimakomSupplierId } from "./ensureKlimakomSupplier";
import { upsertClimacomAccessory } from "./upsertClimacomAccessory";
import { emitClimacomProgress, type ClimacomSyncProgressHandler } from "./climacomSyncProgress";

export type { ClimacomSyncProgressEvent } from "./climacomSyncProgress";

export type ClimacomSyncSummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  productCount: number;
  accessoriesCreated: number;
  accessoriesUpdated: number;
  supplierId: string | null;
  supplierBackfilled: number;
};

const FEATURE_KEYWORDS: Array<{ slug: string; patterns: RegExp[] }> = [
  { slug: "wifi", patterns: [/wi-?fi/i, /melcloud/i, /безжично/i] },
  { slug: "inverter", patterns: [/инвертор/i, /inverter/i] },
  { slug: "night_mode", patterns: [/нощен/i, /тих режим/i] },
  { slug: "self_cleaning", patterns: [/самопочистване/i] },
  { slug: "ionizer", patterns: [/plasma quad/i, /йон/i, /филтър/i] },
];

type RefMaps = {
  brandByName: Map<string, string>;
  typeByName: Map<string, string>;
  featureBySlug: Map<string, string>;
  supplierId: string | null;
  defaultTypeId: string;
  multisplitTypeId: string;
};

async function loadRefs(supabase: SupabaseClient): Promise<RefMaps> {
  const [brands, types, features, supplierId] = await Promise.all([
    supabase.from("brands").select("id,name").eq("is_active", true),
    supabase.from("product_types").select("id,name"),
    supabase.from("features").select("id,slug"),
    ensureKlimakomSupplierId(supabase),
  ]);

  const brandByName = new Map<string, string>();
  for (const b of brands.data ?? []) {
    brandByName.set(String(b.name).toLowerCase(), b.id as string);
  }

  const typeByName = new Map<string, string>();
  let defaultTypeId = "";
  let multisplitTypeId = "";
  for (const t of types.data ?? []) {
    const name = String(t.name);
    typeByName.set(name.toLowerCase(), t.id as string);
    if (!defaultTypeId) defaultTypeId = t.id as string;
    if (/стен/i.test(name)) defaultTypeId = t.id as string;
    if (/мульти|multi/i.test(name)) multisplitTypeId = t.id as string;
  }
  if (!defaultTypeId && types.data?.[0]) defaultTypeId = types.data[0].id as string;
  if (!multisplitTypeId) multisplitTypeId = defaultTypeId;

  const featureBySlug = new Map<string, string>();
  for (const f of features.data ?? []) {
    featureBySlug.set(String(f.slug), f.id as string);
  }

  return { brandByName, typeByName, featureBySlug, supplierId, defaultTypeId, multisplitTypeId };
}

async function ensureBrand(supabase: SupabaseClient, brandByName: Map<string, string>, name: string): Promise<string | null> {
  const key = name.toLowerCase();
  const existing = brandByName.get(key);
  if (existing) return existing;

  const slug = slugifyBg(name);
  const { data, error } = await supabase
    .from("brands")
    .insert({ slug, name, color: "#E60012", is_active: true })
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
    if (/мульти|multi/i.test(hint)) return refs.multisplitTypeId;
  }
  return refs.defaultTypeId;
}

function resolveFeatureIds(refs: RefMaps, labels: string[], htmlHay: string): string[] {
  const ids = new Set<string>();
  const hay = `${htmlHay} ${labels.join(" ")}`.toLowerCase();
  for (const { slug, patterns } of FEATURE_KEYWORDS) {
    if (patterns.some((p) => p.test(hay))) {
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
  item: ClimacomParsedProduct,
  syncedProductIds: string[],
): Promise<"created" | "updated" | "skipped"> {
  if (!item.brandName) return "skipped";

  const brandId = await ensureBrand(supabase, refs.brandByName, item.brandName);
  if (!brandId) return "skipped";

  const typeId = resolveTypeId(refs, item.typeHint);
  const existing = await findExistingProduct(supabase, brandId, item.modelCode, item.name);
  const baseSlug = slugifyBg(item.modelCode ?? item.name);
  const slug = existing?.id ? undefined : await uniqueSlug(supabase, baseSlug);

  const productRow: Record<string, unknown> = {
    name: item.name,
    brand_id: brandId,
    type_id: typeId,
    description: item.description,
    price: item.priceEur,
    price_with_mount: item.priceWithMountEur,
    model_code: item.modelCode,
    product_condition: "new",
    stock_status: "on_order",
    stock_quantity: 0,
    sold_quantity: 0,
    is_active: true,
    is_featured: false,
    product_region: "europe",
    stock_location: "warehouse",
    meta_title: item.name.slice(0, 200),
    meta_description: (item.description ?? item.name).slice(0, 160),
  };

  if (refs.supplierId) productRow.supplier_id = refs.supplierId;

  if (!existing) {
    productRow.slug = slug;
    productRow.show_in_public_catalog = false;
    const { data, error } = await supabase.from("products").insert(productRow).select("id").single();
    if (error || !data?.id) throw new Error(error?.message ?? "insert failed");
    const productId = data.id as string;
    if (refs.supplierId) await applyKlimakomSupplierToProduct(supabase, productId, refs.supplierId);
    syncedProductIds.push(productId);
    await syncChildren(supabase, productId, item, refs);
    return "created";
  }

  const updateRow = { ...productRow };
  const { error } = await supabase.from("products").update(updateRow).eq("id", existing.id);
  if (error) throw new Error(error.message);
  if (refs.supplierId) await applyKlimakomSupplierToProduct(supabase, existing.id, refs.supplierId);
  syncedProductIds.push(existing.id);
  await syncChildren(supabase, existing.id, item, refs);
  return "updated";
}

async function syncChildren(
  supabase: SupabaseClient,
  productId: string,
  item: ClimacomParsedProduct,
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

  const featureIds = resolveFeatureIds(refs, item.featureLabels, item.description ?? item.name);
  if (featureIds.length) {
    await supabase.from("product_features").delete().eq("product_id", productId);
    await supabase.from("product_features").insert(
      featureIds.map((feature_id) => ({ product_id: productId, feature_id })),
    );
  }
}

export async function runClimacomCatalogSync(
  supabase: SupabaseClient,
  opts?: { limit?: number; onProgress?: ClimacomSyncProgressHandler },
): Promise<ClimacomSyncSummary> {
  if (process.env.CLIMACOM_TLS_INSECURE === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const onProgress = opts?.onProgress;
  const summary: ClimacomSyncSummary = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    productCount: 0,
    accessoriesCreated: 0,
    accessoriesUpdated: 0,
    supplierId: null,
    supplierBackfilled: 0,
  };
  const syncedClimateProductIds: string[] = [];

  emitClimacomProgress(onProgress, { phase: "start", message: "Старт на синхронизация с climacom.com…" });

  await supabase
    .from("product_catalog_settings")
    .upsert({ id: 1, climacom_last_sync_status: "running", climacom_last_sync_summary: null }, { onConflict: "id" });

  emitClimacomProgress(onProgress, { phase: "crawl", message: "Зареждане на референции…" });
  const refs = await loadRefs(supabase);
  summary.supplierId = refs.supplierId;

  if (!refs.supplierId) {
    summary.errors.push(
      "Липсва доставчик „КЛИМАКОМ“ в контакти — продуктите няма да получат supplier_id.",
    );
    emitClimacomProgress(onProgress, { phase: "crawl", message: "Внимание: не е намерен доставчик КЛИМАКОМ." });
  } else {
    emitClimacomProgress(onProgress, { phase: "crawl", message: "Доставчик: КЛИМАКОМ (автоматично)." });
  }

  emitClimacomProgress(onProgress, {
    phase: "crawl",
    message: "Зареждане на продукти от WooCommerce API (стенни, мултисплит, Wi‑Fi)…",
  });

  const wcProducts = await collectClimacomCatalogProducts({
    limit: opts?.limit,
    onProgress: (message) => emitClimacomProgress(onProgress, { phase: "crawl", message }),
  });

  summary.productCount = wcProducts.length;
  emitClimacomProgress(onProgress, {
    phase: "import",
    message: `Намерени ${wcProducts.length} артикула — започва импорт…`,
    current: 0,
    total: wcProducts.length,
  });

  for (let i = 0; i < wcProducts.length; i++) {
    const wc = wcProducts[i]!;
    const current = i + 1;
    const url = wc.permalink;
    try {
      emitClimacomProgress(onProgress, {
        phase: "import",
        message: `Зареждане ${current}/${wcProducts.length}: ${wc.name}`,
        current,
        total: wcProducts.length,
        url,
      });

      const html = await fetchClimacomHtml(url);
      const parsed = await parseClimacomProduct(wc, html);
      if (!parsed) {
        summary.skipped++;
        emitClimacomProgress(onProgress, {
          phase: "import",
          message: `Пропуснат (няма цена): ${wc.name}`,
          current,
          total: wcProducts.length,
          url,
          result: "skipped",
        });
        continue;
      }

      const catalogKind = classifyClimacomCatalogItem(parsed);
      let result: "created" | "updated" | "skipped";
      let kindLabel: string;

      if (catalogKind === "accessory") {
        kindLabel = "аксесоар";
        const brandId = parsed.brandName
          ? await ensureBrand(supabase, refs.brandByName, parsed.brandName)
          : null;
        if (!brandId && parsed.brandName) {
          result = "skipped";
          kindLabel = "аксесоар (марка?)";
        } else {
          result = await upsertClimacomAccessory(supabase, brandId, parsed);
          if (result === "created") summary.accessoriesCreated++;
          else if (result === "updated") summary.accessoriesUpdated++;
        }
      } else {
        result = await upsertOne(supabase, refs, parsed, syncedClimateProductIds);
        summary[result]++;
        kindLabel = "климатик";
      }

      if (result === "skipped" && catalogKind === "accessory") summary.skipped++;

      emitClimacomProgress(onProgress, {
        phase: "import",
        message: `${result === "created" ? "Нов" : result === "updated" ? "Обновен" : "Пропуснат"} (${kindLabel}): ${parsed.name}`,
        current,
        total: wcProducts.length,
        url,
        productName: parsed.name,
        result,
        imageCount: parsed.imageUrls.length,
      });
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e);
      summary.errors.push(`${url}: ${errMsg}`);
      emitClimacomProgress(onProgress, {
        phase: "import",
        message: `Грешка: ${wc.name} — ${errMsg}`,
        current,
        total: wcProducts.length,
        url,
      });
    }
    await new Promise((r) => setTimeout(r, 450));
  }

  if (refs.supplierId && syncedClimateProductIds.length) {
    try {
      summary.supplierBackfilled = await backfillKlimakomSupplierOnProducts(
        supabase,
        refs.supplierId,
        syncedClimateProductIds,
      );
    } catch (e: unknown) {
      summary.errors.push(`Доставчик (backfill): ${e instanceof Error ? e.message : String(e)}`);
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
      climacom_last_sync_at: new Date().toISOString(),
      climacom_last_sync_status: status,
      climacom_last_sync_summary: summary,
    },
    { onConflict: "id" },
  );

  emitClimacomProgress(onProgress, {
    phase: "done",
    message: `Готово: ${summary.created} климатици (нови), ${summary.updated} (обновени); ${summary.accessoriesCreated} аксесоара (нови), ${summary.accessoriesUpdated} (обновени); ${summary.skipped} пропуснати; доставчик: ${summary.supplierId ? "КЛИМАКОМ" : "липсва"}; ${summary.errors.length} грешки`,
    current: wcProducts.length,
    total: wcProducts.length,
  });

  return summary;
}
