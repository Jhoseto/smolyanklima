import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyBg } from "../slugify";
import { replaceProductImages, upsertProductSpecs, type ImageInput, type SpecsInput } from "@/lib/admin/syncProductChildren";
import {
  collectBulclimaProductUrls,
  fetchBulclimaHtml,
  parseBulclimaProductPage,
  type BulclimaParsedProduct,
} from "./parseBulclimaHtml";
import { emitBulclimaProgress, type BulclimaSyncProgressHandler } from "./bulclimaSyncProgress";

export type { BulclimaSyncProgressEvent } from "./bulclimaSyncProgress";

export type BulclimaSyncSummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  productUrls: number;
};

const FEATURE_KEYWORDS: Array<{ slug: string; patterns: RegExp[] }> = [
  { slug: "wifi", patterns: [/wi-?fi/i, /безжично/i, /интернет/i] },
  { slug: "inverter", patterns: [/инвертор/i] },
  { slug: "night_mode", patterns: [/нощен/i, /тих режим/i, /сън/i] },
  { slug: "self_cleaning", patterns: [/самопочистване/i] },
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
  const [brands, types, categories, features, supplier] = await Promise.all([
    supabase.from("brands").select("id,name").eq("is_active", true),
    supabase.from("product_types").select("id,name"),
    supabase.from("categories").select("id,slug"),
    supabase.from("features").select("id,slug"),
    supabase
      .from("contacts")
      .select("id,full_name")
      .eq("contact_kind", "supplier")
      .ilike("full_name", "%булклима%")
      .limit(1)
      .maybeSingle(),
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
    supplierId: (supplier.data as { id?: string } | null)?.id ?? null,
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
  item: BulclimaParsedProduct,
): Promise<"created" | "updated" | "skipped"> {
  if (!item.brandName) return "skipped";

  const brandId = await ensureBrand(supabase, refs.brandByName, item.brandName);
  if (!brandId) return "skipped";

  const typeId = resolveTypeId(refs, item.typeHint);
  const categoryId = item.categorySlug ? (refs.categoryBySlug.get(item.categorySlug) ?? null) : null;

  const existing = await findExistingProduct(supabase, brandId, item.modelCode, item.name);
  const baseSlug = slugifyBg(item.modelCode ?? item.name);
  const slug = existing?.id ? undefined : await uniqueSlug(supabase, baseSlug);

  const productRow: Record<string, unknown> = {
    name: item.name,
    brand_id: brandId,
    type_id: typeId,
    category_id: categoryId,
    description: item.description,
    price: item.priceEur,
    price_with_mount: item.priceWithMountEur ?? item.priceEur + 200,
    model_code: item.modelCode,
    product_condition: "new",
    stock_status: "on_order",
    stock_quantity: 0,
    sold_quantity: 0,
    supplier_id: refs.supplierId,
    is_active: true,
    is_featured: false,
    product_region: "europe",
    stock_location: "warehouse",
    meta_title: item.name.slice(0, 200),
    meta_description: (item.description ?? item.name).slice(0, 160),
  };

  if (!existing) {
    productRow.slug = slug;
    productRow.show_in_public_catalog = false;
    const { data, error } = await supabase.from("products").insert(productRow).select("id").single();
    if (error || !data?.id) throw new Error(error?.message ?? "insert failed");
    await syncChildren(supabase, data.id as string, item, refs);
    return "created";
  }

  const updateRow = { ...productRow };
  delete updateRow.show_in_public_catalog;
  const { error } = await supabase.from("products").update(updateRow).eq("id", existing.id);
  if (error) throw new Error(error.message);
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

  const featureIds = resolveFeatureIds(refs, item.featureLabels, item.description ?? item.name);
  if (featureIds.length) {
    await supabase.from("product_features").delete().eq("product_id", productId);
    await supabase.from("product_features").insert(
      featureIds.map((feature_id) => ({ product_id: productId, feature_id })),
    );
  }
}

export async function runBulclimaCatalogSync(
  supabase: SupabaseClient,
  opts?: { limit?: number; onProgress?: BulclimaSyncProgressHandler },
): Promise<BulclimaSyncSummary> {
  if (process.env.BULCLIMA_TLS_INSECURE === "1") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const onProgress = opts?.onProgress;
  const summary: BulclimaSyncSummary = { created: 0, updated: 0, skipped: 0, errors: [], productUrls: 0 };

  emitBulclimaProgress(onProgress, { phase: "start", message: "Старт на синхронизация с bulclima.com…" });

  await supabase
    .from("product_catalog_settings")
    .upsert({ id: 1, bulclima_last_sync_status: "running", bulclima_last_sync_summary: null }, { onConflict: "id" });

  emitBulclimaProgress(onProgress, { phase: "crawl", message: "Зареждане на референции (марки, категории)…" });
  const refs = await loadRefs(supabase);

  emitBulclimaProgress(onProgress, { phase: "crawl", message: "Обхождане на каталога bulclima.com…" });
  const urls = await collectBulclimaProductUrls(opts?.limit, (message) => {
    emitBulclimaProgress(onProgress, { phase: "crawl", message });
  });
  summary.productUrls = urls.length;
  emitBulclimaProgress(onProgress, {
    phase: "import",
    message: `Намерени ${urls.length} продукта — започва импорт…`,
    current: 0,
    total: urls.length,
  });

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]!;
    const current = i + 1;
    try {
      emitBulclimaProgress(onProgress, {
        phase: "import",
        message: `Зареждане ${current}/${urls.length}: ${url}`,
        current,
        total: urls.length,
        url,
      });
      const html = await fetchBulclimaHtml(url);
      const parsed = parseBulclimaProductPage(html, url);
      if (!parsed) {
        summary.skipped++;
        emitBulclimaProgress(onProgress, {
          phase: "import",
          message: `Пропуснат (няма цена/име): ${url}`,
          current,
          total: urls.length,
          url,
          result: "skipped",
        });
        continue;
      }
      const result = await upsertOne(supabase, refs, parsed);
      summary[result]++;
      emitBulclimaProgress(onProgress, {
        phase: "import",
        message: `${result === "created" ? "Нов" : result === "updated" ? "Обновен" : "Пропуснат"}: ${parsed.name} · ${parsed.imageUrls.length} снимки`,
        current,
        total: urls.length,
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
        total: urls.length,
        url,
      });
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  const status =
    summary.errors.length && summary.created + summary.updated === 0 ? "error" : "ok";

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
    message: `Готово: ${summary.created} нови, ${summary.updated} обновени, ${summary.skipped} пропуснати, ${summary.errors.length} грешки`,
    current: urls.length,
    total: urls.length,
  });

  return summary;
}
