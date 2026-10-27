import type { SupabaseClient } from "@supabase/supabase-js";
import { replaceProductFeatures, replaceProductImages, upsertProductSpecs } from "@/lib/admin/syncProductChildren";
import { slugifyBg } from "../slugify";
import { collectTempexProductUrls, TEMPEX_CATEGORIES } from "./collectTempexProducts";
import { ensureTempexSupplierId } from "./ensureTempexSupplier";
import { fetchTempexProduct, TempexNoPublishedPriceError, type TempexParsedProduct } from "./parseTempexProduct";
import { acquireTempexSyncLock, writeTempexSyncStatus } from "./tempexSyncStatus";
import { fetchTempexHtml, TempexRateLimitError } from "./tempexHttp";
import { reconcileTempexAvailability, restoredTempexAvailability } from "./tempexAvailability";

export type TempexSyncProgressEvent = {
  phase: "start" | "crawl" | "import" | "done" | "error"; message: string;
  discovered?: number; current?: number; total?: number; created?: number; updated?: number; skipped?: number;
  url?: string; productName?: string; result?: "created" | "updated" | "skipped"; imageCount?: number;
};
export type TempexSyncSummary = {
  created: number; updated: number; skipped: number; errors: string[]; productUrls: number;
  supplierId: string | null; categories: Record<string, number>; status: "ok" | "partial" | "error";
  excluded: Array<{ url: string; name: string; reason: string }>;
  deactivated: number;
};

export async function loadTempexCatalogRefs(db: SupabaseClient) {
  const [brands, types, categories, features] = await Promise.all([
    db.from("brands").select("id,name,slug"), db.from("product_types").select("id,name"),
    db.from("categories").select("id,slug"), db.from("features").select("id,slug"),
  ]);
  for (const result of [brands, types, categories, features]) if (result.error) throw new Error(result.error.message);
  const typeBySlug = new Map<string, string>();
  const categoryBySlug = new Map((categories.data ?? []).map((row) => [String(row.slug), String(row.id)]));
  for (const category of TEMPEX_CATEGORIES) {
    if (!categoryBySlug.has(category.slug)) throw new Error(`Липсва категория ${category.label} в каталога.`);
    let type = types.data?.find((row) => String(row.name).toLowerCase().includes(category.type.toLowerCase()));
    if (!type) {
      const created = await db.from("product_types").upsert({ name: category.type }, { onConflict: "name" }).select("id,name").single();
      if (created.error || !created.data) throw new Error(created.error?.message ?? `Липсва тип ${category.type}`);
      type = created.data;
    }
    typeBySlug.set(category.slug, String(type!.id));
  }
  return {
    brandByName: new Map((brands.data ?? []).map((row) => [String(row.name).toLowerCase(), String(row.id)])),
    categoryBySlug, typeBySlug,
    featureBySlug: new Map((features.data ?? []).map((row) => [String(row.slug), String(row.id)])),
  };
}

type Refs = Awaited<ReturnType<typeof loadTempexCatalogRefs>>;

async function newTempexSlug(db: SupabaseClient, item: TempexParsedProduct): Promise<string> {
  const base = slugifyBg(item.name);
  for (let index = 0; index < 50; index++) {
    // A catalog template may have become an actual purchased unit. Keep its slug and create a new template.
    const slug = `${base}${index ? `-catalog-${index}` : ""}-tempex-${item.sourceId}`;
    const { data, error } = await db.from("products").select("id").eq("slug", slug).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return slug;
  }
  throw new Error(`Не може да се създаде уникален адрес за ${item.name}`);
}

export async function upsertTempexCatalogProduct(db: SupabaseClient, refs: Refs, supplierId: string, item: TempexParsedProduct): Promise<"created" | "updated"> {
  let brandId = refs.brandByName.get(item.brandName.toLowerCase());
  if (!brandId) {
    const brand = await db.from("brands").upsert({ name: item.brandName, slug: slugifyBg(item.brandName), color: "#1E3A5F", is_active: true }, { onConflict: "slug" }).select("id").single();
    if (brand.error || !brand.data) throw new Error(brand.error?.message ?? "Липсва марка");
    brandId = String(brand.data.id);
    refs.brandByName.set(item.brandName.toLowerCase(), brandId);
  }
  // Match only this supplier's catalog rows. Never adopt another supplier's price or a purchased stock instance.
  const existing = await db.from("products").select("id,is_active,internal_note").or(`source_url.eq.${item.sourceUrl},slug.like.%-tempex-${item.sourceId}`)
    .eq("supplier_id", supplierId).eq("product_condition", "new").is("supplier_order_work_item_id", null)
    .is("indoor_unit_serial", null).is("outdoor_unit_serial", null).is("purchased_at", null).eq("stock_quantity", 0).eq("sold_quantity", 0)
    .limit(2);
  if (existing.error) throw new Error(existing.error.message);
  if ((existing.data?.length ?? 0) > 1) throw new Error(`Дублирани Tempex шаблони за ${item.sourceUrl}`);
  const id = existing.data?.[0]?.id as string | undefined;
  const row = {
    ...(existing.data?.[0] ? restoredTempexAvailability(existing.data[0]) : {}),
    name: item.name, brand_id: brandId, type_id: refs.typeBySlug.get(item.categorySlug), category_id: refs.categoryBySlug.get(item.categorySlug),
    supplier_id: supplierId, model_code: item.modelCode, source_url: item.sourceUrl, description: item.description,
    price: item.priceEur,
    meta_title: item.name.slice(0, 200), meta_description: item.name.slice(0, 160),
  };
  let productId = id;
  if (id) {
    const { data, error } = await db.from("products").update(row).eq("id", id)
      .eq("supplier_id", supplierId).eq("product_condition", "new").eq("stock_quantity", 0).eq("sold_quantity", 0)
      .is("supplier_order_work_item_id", null).is("purchased_at", null).is("indoor_unit_serial", null).is("outdoor_unit_serial", null)
      .select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Продуктът е променен по време на синхронизацията и не е презаписан: ${item.name}`);
  } else {
    const slug = await newTempexSlug(db, item);
    const inserted = await db.from("products").insert({
      ...row, price_with_mount: null, slug,
      product_condition: "new", stock_status: "on_order", stock_quantity: 0, sold_quantity: 0,
      is_active: true, is_featured: false, show_in_public_catalog: false, product_region: "europe", stock_location: "warehouse",
    }).select("id").single();
    if (inserted.error || !inserted.data) throw new Error(inserted.error?.message ?? "Неуспешно записване");
    productId = String(inserted.data.id);
  }
  const specs = await upsertProductSpecs(db, productId!, item.specs);
  if (specs.error) throw new Error(specs.error.message);
  const images = await replaceProductImages(db, productId!, item.imageUrls.map((url, index) => ({ url, sort_order: index, is_main: index === 0 })));
  if (images.error) throw new Error(images.error.message);
  const features = await replaceProductFeatures(db, productId!, item.featureSlugs.map((slug) => refs.featureBySlug.get(slug)).filter((value): value is string => Boolean(value)));
  if (features.error) throw new Error(features.error.message);
  return id ? "updated" : "created";
}

export async function runTempexCatalogSync(
  db: SupabaseClient,
  opts?: { limit?: number; onProgress?: (event: TempexSyncProgressEvent) => void; fetchHtml?: typeof fetchTempexHtml },
): Promise<TempexSyncSummary> {
  const release = await acquireTempexSyncLock(db);
  const started = Date.now();
  const summary: TempexSyncSummary = { created: 0, updated: 0, skipped: 0, errors: [], productUrls: 0, supplierId: null, categories: {}, status: "ok", excluded: [], deactivated: 0 };
  const emit = (event: TempexSyncProgressEvent) => opts?.onProgress?.({ ...event, created: summary.created, updated: summary.updated, skipped: summary.skipped });
  try {
    await writeTempexSyncStatus(db, { at: new Date().toISOString(), status: "running", summary: null });
    emit({ phase: "start", message: "Старт на синхронизация с tempex.bg…" });
    // Finish discovery before any product writes. A failed listing must not silently produce a partial catalog.
    const entries = await collectTempexProductUrls(opts?.limit, (message, discovered) => emit({ phase: "crawl", message, discovered }), opts?.fetchHtml);
    summary.productUrls = entries.length;
    const refs = await loadTempexCatalogRefs(db);
    const supplierId = await ensureTempexSupplierId(db);
    summary.supplierId = supplierId;
    let next = 0;
    let completed = 0;
    let stopped: unknown;
    const availableUrls = new Set<string>();
    const worker = async () => {
      while (next < entries.length) {
        if (stopped) return;
        // Stop before the lease can expire; a subsequent run can safely resume by source URL.
        if (Date.now() - started > 25 * 60_000) throw new Error("Достигнато е времето за синхронизация. Стартирайте отново за оставащите продукти.");
        const entry = entries[next++]!;
        let event: Partial<TempexSyncProgressEvent> = {};
        try {
          emit({ phase: "import", message: `Зареждане: ${entry.url}`, current: completed, total: entries.length, url: entry.url });
          const item = await fetchTempexProduct(entry, opts?.fetchHtml);
          const result = await upsertTempexCatalogProduct(db, refs, supplierId, item);
          summary[result]++;
          availableUrls.add(item.sourceUrl);
          summary.categories[item.categorySlug] = (summary.categories[item.categorySlug] ?? 0) + 1;
          event = { result, productName: item.name, imageCount: item.imageUrls.length, message: `${result === "created" ? "Нов" : "Обновен"}: ${item.name} · ${item.imageUrls.length} снимки` };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (error instanceof TempexNoPublishedPriceError) {
            summary.skipped++;
            summary.excluded.push({ url: entry.url, name: error.productName, reason: message });
            event = { result: "skipped", message: `Пропуснат без публикувана цена: ${error.productName}` };
          } else {
            summary.errors.push(`${entry.url}: ${message}`);
            if (error instanceof TempexRateLimitError) stopped = error;
            event = { message: `Грешка: ${entry.url} — ${message}` };
          }
        }
        completed++;
        emit({ phase: "import", message: event.message!, ...event, current: completed, total: entries.length, discovered: entries.length, url: entry.url });
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    };
    const workers = await Promise.allSettled(Array.from({ length: Math.min(3, entries.length) }, worker));
    const failedWorker = workers.find((result) => result.status === "rejected");
    if (failedWorker?.status === "rejected") throw failedWorker.reason;
    if (stopped) throw stopped;
    if (!opts?.limit && !summary.errors.length) {
      summary.deactivated = await reconcileTempexAvailability(db, supplierId, availableUrls);
    }
    summary.status = summary.errors.length ? (summary.created + summary.updated > 0 ? "partial" : "error") : "ok";
    await writeTempexSyncStatus(db, { at: new Date().toISOString(), status: summary.status, summary });
    emit({ phase: "done", message: `Tempex: ${summary.created} нови, ${summary.updated} обновени, ${summary.errors.length} грешки.`, current: completed, total: entries.length, discovered: entries.length });
    return summary;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeTempexSyncStatus(db, { at: new Date().toISOString(), status: "error", summary: { ...summary, error: message } });
    throw error;
  } finally {
    await release();
  }
}
