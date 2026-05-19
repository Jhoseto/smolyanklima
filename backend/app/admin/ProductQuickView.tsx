"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Check, ExternalLink, Ruler, ShieldCheck, Star, Volume2, Weight, Wifi, Wind, X, Zap } from "lucide-react";
import { publicProductPageUrl } from "@/lib/publicCatalogUrl";
import { CatalogProductImage } from "@/app/admin/components/CatalogProductImage";

type ProductQuickViewData = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  price: number;
  price_with_mount?: number | null;
  old_price?: number | null;
  product_condition?: "new" | "used";
  stock_status?: "in_stock" | "out_of_stock" | "on_order";
  stock_quantity?: number | null;
  rating?: number | null;
  reviews_count?: number | null;
  brands?: { name?: string | null } | null;
  product_types?: { name?: string | null } | null;
  product_specs?: {
    coverage_m2?: number | string | null;
    noise_db?: number | string | null;
    cooling_power_kw?: number | string | null;
    heating_power_kw?: number | string | null;
    refrigerant?: string | null;
    wifi?: boolean | null;
    energy_class_cool?: string | null;
    energy_class_heat?: string | null;
    seer?: number | string | null;
    scop?: number | string | null;
    warranty_months?: number | string | null;
    weight_indoor_kg?: number | string | null;
    weight_outdoor_kg?: number | string | null;
    dim_indoor_length_mm?: number | string | null;
    dim_indoor_width_mm?: number | string | null;
    dim_indoor_height_mm?: number | string | null;
    dim_outdoor_length_mm?: number | string | null;
    dim_outdoor_width_mm?: number | string | null;
    dim_outdoor_height_mm?: number | string | null;
  } | null;
  product_images?: Array<{ url: string; sort_order?: number | null; is_main?: boolean | null }>;
};

const quickViewButtonClass = (className: string) =>
  `min-w-0 max-w-full text-left font-bold text-slate-900 underline-offset-4 transition-colors hover:text-brand-blue-700 hover:underline focus:outline-none focus:ring-2 focus:ring-brand-blue-200 rounded ${className}`;

export function CatalogItemQuickViewButton({
  catalogItem = "product",
  itemId,
  itemName,
  className = "",
}: {
  catalogItem?: "product" | "accessory";
  itemId?: string | null;
  itemName: string;
  className?: string;
}) {
  if (catalogItem === "accessory") {
    return <AccessoryQuickViewButton accessoryId={itemId} accessoryName={itemName} className={className} />;
  }
  return <ProductQuickViewButton productId={itemId} productName={itemName} className={className} />;
}

export function ProductQuickViewButton({
  productId,
  productName,
  className = "",
}: {
  productId?: string | null;
  productName: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!productId) return <span className={className}>{productName}</span>;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={quickViewButtonClass(className)} title={productName}>
        {productName}
      </button>
      {open && <ProductQuickViewModal productId={productId} onClose={() => setOpen(false)} />}
    </>
  );
}

type AccessoryQuickViewData = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  price: number;
  old_price?: number | null;
  kind?: string | null;
  is_active?: boolean | null;
  stock_status?: "in_stock" | "out_of_stock" | "on_order" | string;
  stock_quantity?: number | null;
  brands?: { name?: string | null } | null;
  accessory_images?: Array<{ url: string; sort_order?: number | null; is_main?: boolean | null }>;
};

export function AccessoryQuickViewButton({
  accessoryId,
  accessoryName,
  className = "",
}: {
  accessoryId?: string | null;
  accessoryName: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (!accessoryId) return <span className={className}>{accessoryName}</span>;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={quickViewButtonClass(className)} title={accessoryName}>
        {accessoryName}
      </button>
      {open && <AccessoryQuickViewModal accessoryId={accessoryId} onClose={() => setOpen(false)} />}
    </>
  );
}

function accessoryKindLabel(kind: string | null | undefined): string {
  if (kind === "spare_part") return "Резервна част";
  if (kind === "consumable") return "Консуматив";
  return "Аксесоар";
}

export function AccessoryQuickViewModal({ accessoryId, onClose }: { accessoryId: string; onClose: () => void }) {
  const [accessory, setAccessory] = useState<AccessoryQuickViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setImageFailed(false);

    void fetch(`/api/admin/accessories/${accessoryId}`, { credentials: "include" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Грешка при зареждане на аксесоара");
        return json.data as AccessoryQuickViewData;
      })
      .then((data) => {
        if (alive) setAccessory(data);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [accessoryId]);

  const images = [...(accessory?.accessory_images ?? [])].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0),
  );
  const mainImage = images.find((img) => img.is_main)?.url ?? images[0]?.url ?? "";
  const price = Number(accessory?.price ?? 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-h-[93vh] md:max-h-[90vh] overflow-hidden rounded-t-3xl md:rounded-3xl bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.25)] md:shadow-2xl md:w-[720px] md:mx-4">
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200"
          aria-label="Затвори бърз преглед"
        >
          <X className="h-5 w-5" />
        </button>

        {loading ? (
          <div className="flex min-h-[240px] items-center justify-center text-sm font-bold text-slate-500">Зареждане...</div>
        ) : error ? (
          <div className="flex min-h-[240px] items-center justify-center p-8 text-center text-sm font-bold text-red-600">{error}</div>
        ) : accessory ? (
          <div className="flex max-h-[90vh] flex-col overflow-y-auto md:flex-row md:overflow-hidden">
            <div className="relative flex shrink-0 items-center justify-center border-b md:border-b-0 md:border-r border-gray-100 bg-gray-50 p-5 md:p-8 md:w-[300px]">
              <div className="relative w-full">
                <div className="absolute left-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-violet-700 shadow-sm">
                  {accessoryKindLabel(accessory.kind)}
                </div>
                <div className="flex aspect-square items-center justify-center rounded-3xl bg-slate-50 p-6 shadow-sm">
                  {mainImage && !imageFailed ? (
                    <CatalogProductImage
                      src={mainImage}
                      alt={accessory.name}
                      className="max-h-full max-w-full"
                      onError={() => setImageFailed(true)}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_top,#ede9fe_0,#f8fafc_52%,#eef2ff_100%)] p-6 text-center">
                      <div className="text-lg font-black leading-tight text-slate-900">{accessory.name}</div>
                      <div className="mt-2 text-sm font-medium text-slate-500">Няма качена снимка</div>
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="mt-4 flex justify-center gap-2">
                    {images.slice(0, 4).map((image) => (
                      <div key={image.url} className="h-12 w-12 rounded-xl border border-gray-100 bg-white p-1 shadow-sm">
                        <CatalogProductImage src={image.url} alt="" fade="thumb" className="h-full w-full" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
              {accessory.brands?.name ? (
                <p className="mb-1 text-xs font-bold uppercase tracking-wider text-violet-700">
                  {accessory.brands.name}
                </p>
              ) : null}
              <h2 className="mb-2 text-lg md:text-2xl font-black leading-tight text-gray-900">{accessory.name}</h2>
              <p className="mb-4 text-sm text-gray-500">{accessoryKindLabel(accessory.kind)}</p>

              {accessory.description && (
                <p className="mb-5 text-sm leading-relaxed text-gray-600 whitespace-pre-line">{accessory.description}</p>
              )}

              <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 p-4 md:p-5">
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="text-3xl md:text-4xl font-extrabold text-gray-900">€{price.toLocaleString()}</span>
                  {accessory.old_price ? (
                    <span className="text-lg font-bold text-gray-400 line-through">
                      €{Number(accessory.old_price).toLocaleString()}
                    </span>
                  ) : null}
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="mb-3 text-xs font-bold uppercase text-gray-500">Наличност</h4>
                  <div className="flex items-start gap-3">
                    <div className="relative mt-1">
                      <div
                        className={`h-2.5 w-2.5 rounded-full ${accessory.stock_status === "out_of_stock" ? "bg-red-500" : "bg-green-500"}`}
                      />
                      {accessory.stock_status !== "out_of_stock" && (
                        <div className="absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full bg-green-500" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{stockLabel(accessory.stock_status)}</p>
                      <p className="text-xs text-gray-500">Налични: {Number(accessory.stock_quantity ?? 0)} бр.</p>
                      {accessory.is_active === false && (
                        <p className="mt-1 text-xs font-semibold text-amber-700">Скрит от публичния каталог</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type CatalogMountDefaults = { newEur: number; usedEur: number };

export function ProductQuickViewModal({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [product, setProduct] = useState<ProductQuickViewData | null>(null);
  const [mountDefaults, setMountDefaults] = useState<CatalogMountDefaults | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setImageFailed(false);
    setMountDefaults(null);

    void Promise.all([
      fetch(`/api/admin/products/${productId}`, { credentials: "include" }).then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Грешка при зареждане на продукта");
        return json.data as ProductQuickViewData;
      }),
      fetch("/api/admin/products/catalog-settings", { credentials: "include" }).then(async (res) => {
        if (!res.ok) return null;
        const json = (await res.json().catch(() => ({}))) as {
          data?: { defaultMountNewEur?: number | null; defaultMountUsedEur?: number | null };
        };
        const n = json.data?.defaultMountNewEur;
        const u = json.data?.defaultMountUsedEur;
        if (n == null || u == null || !Number.isFinite(n) || !Number.isFinite(u)) return null;
        return { newEur: n, usedEur: u };
      }),
    ])
      .then(([data, defaults]) => {
        if (!alive) return;
        setProduct(data);
        setMountDefaults(defaults);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [productId]);

  const specs = product?.product_specs ?? null;
  const images = [...(product?.product_images ?? [])].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  const mainImage = images.find((img) => img.is_main)?.url ?? images[0]?.url ?? "";
  const price = Number(product?.price ?? 0);
  const storedPriceWithMount = product?.price_with_mount != null ? Number(product.price_with_mount) : null;
  const standardMountFromSettings =
    product && mountDefaults
      ? product.product_condition === "used"
        ? mountDefaults.usedEur
        : mountDefaults.newEur
      : null;
  const standardMount =
    standardMountFromSettings ??
    (storedPriceWithMount != null && storedPriceWithMount >= price ? storedPriceWithMount - price : null);
  const totalWithMount =
    standardMountFromSettings != null
      ? Math.round((price + standardMountFromSettings) * 100) / 100
      : storedPriceWithMount;
  const features = [
    specs?.energy_class_cool && `Охлаждане ${specs.energy_class_cool}`,
    specs?.energy_class_heat && `Отопление ${specs.energy_class_heat}`,
    specs?.seer && `SEER ${specs.seer}`,
    specs?.scop && `SCOP ${specs.scop}`,
    product?.product_condition === "used" ? "Втора употреба" : "Нов продукт",
  ].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      {/* Bottom sheet on mobile, centered panel on desktop */}
      <div className="relative w-full max-h-[93vh] md:max-h-[90vh] overflow-hidden rounded-t-3xl md:rounded-3xl bg-white shadow-[0_-8px_40px_rgba(0,0,0,0.25)] md:shadow-2xl md:w-[900px] md:mx-4">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200"
          aria-label="Затвори бърз преглед"
        >
          <X className="h-5 w-5" />
        </button>

        {loading ? (
          <div className="flex min-h-[280px] items-center justify-center text-sm font-bold text-slate-500">Зареждане на продукта...</div>
        ) : error ? (
          <div className="flex min-h-[280px] items-center justify-center p-8 text-center text-sm font-bold text-red-600">{error}</div>
        ) : product ? (
          <div className="flex max-h-[90vh] flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            <div className="relative flex shrink-0 items-center justify-center border-r border-gray-100 bg-gray-50 p-5 md:p-8 lg:w-[420px]">
              <div className="relative w-full">
                <div className="absolute left-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[#00B4D8] shadow-sm">
                  {product.product_condition === "used" ? "Втора употреба" : "Нов"}
                </div>
                {specs?.energy_class_cool && (
                  <div className="absolute right-4 top-4 z-10 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white shadow-sm">
                    {specs.energy_class_cool}
                  </div>
                )}
                <div className="flex aspect-square items-center justify-center rounded-3xl bg-slate-50 p-6 shadow-sm">
                  {mainImage && !imageFailed ? (
                    <CatalogProductImage
                      src={mainImage}
                      alt={product.name}
                      className="max-h-full max-w-full"
                      onError={() => setImageFailed(true)}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_top,#e0f2fe_0,#f8fafc_52%,#eef2ff_100%)] p-8 text-center">
                      <div className="mb-3 rounded-2xl bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-brand-blue-700 shadow-sm">
                        Smolyan Klima
                      </div>
                      <div className="text-2xl font-black leading-tight text-slate-900">{product.name}</div>
                      <div className="mt-2 text-sm font-medium text-slate-500">Няма качена снимка за този продукт</div>
                    </div>
                  )}
                </div>
                {images.length > 1 && (
                  <div className="mt-4 flex justify-center gap-2">
                    {images.slice(0, 4).map((image) => (
                      <div key={image.url} className="h-14 w-14 rounded-xl border border-gray-100 bg-white p-1 shadow-sm">
                        <CatalogProductImage src={image.url} alt="" fade="thumb" className="h-full w-full" />
                      </div>
                    ))}
                  </div>
                )}
                {product.slug ? (
                  <a
                    href={publicProductPageUrl(product.slug)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#00B4D8]/30 bg-white px-4 py-2.5 text-sm font-bold text-[#0077B6] shadow-sm transition-colors hover:bg-[#EBF5FF]"
                  >
                    <ExternalLink className="h-4 w-4 shrink-0" />
                    Клиентски изглед
                  </a>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#00B4D8]">{product.brands?.name ?? "Климатик"}</p>
              <h2 className="mb-1 text-lg md:text-2xl font-black leading-tight text-gray-900">{product.name}</h2>
              <p className="mb-4 text-sm text-gray-500">
                {[product.product_types?.name, specs?.coverage_m2 ? `${specs.coverage_m2} м²` : null].filter(Boolean).join(" · ")}
              </p>

              <div className="mb-4 flex items-center gap-2">
                <div className="flex text-yellow-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-4 w-4 ${i < Math.round(Number(product.rating ?? 0)) ? "fill-current" : "fill-gray-200 text-gray-200"}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-semibold text-gray-700">{Number(product.rating ?? 0).toFixed(1)}</span>
                <span className="text-sm text-gray-500">({Number(product.reviews_count ?? 0)} отзива)</span>
              </div>

              {product.description && <p className="mb-5 text-sm leading-relaxed text-gray-600">{product.description}</p>}

              <div className="mb-5 rounded-2xl bg-gray-50 p-4">
                <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-500">Технически характеристики</h3>
                <div className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  <Spec icon={<Zap className="h-4 w-4 text-yellow-500" />} label="Охлаждане" value={kw(specs?.cooling_power_kw)} />
                  <Spec icon={<Wind className="h-4 w-4 text-orange-500" />} label="Отопление" value={kw(specs?.heating_power_kw)} />
                  <Spec icon={<Volume2 className="h-4 w-4 text-blue-500" />} label="Шум" value={specs?.noise_db ? `${specs.noise_db} dB` : ""} />
                  <Spec icon={<ShieldCheck className="h-4 w-4 text-teal-500" />} label="Хладагент" value={specs?.refrigerant ?? ""} />
                  <Spec icon={<ShieldCheck className="h-4 w-4 text-green-500" />} label="Гаранция" value={warranty(specs?.warranty_months)} />
                  <Spec icon={<Wifi className={`h-4 w-4 ${specs?.wifi ? "text-[#00B4D8]" : "text-gray-300"}`} />} label="WiFi" value={specs?.wifi ? "Вграден" : "Без WiFi"} />
                </div>
              </div>

              {hasDimsOrWeight(specs) && (
                <div className="mb-5 rounded-2xl bg-gray-50 p-4">
                  <h3 className="mb-3 text-xs font-black uppercase tracking-wider text-gray-500">Размери и тегло</h3>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {(specs?.weight_indoor_kg != null || hasIndoorDims(specs)) && (
                      <UnitBlock
                        title="Вътрешен блок"
                        accent="text-[#0077B6]"
                        weight={specs?.weight_indoor_kg}
                        length={specs?.dim_indoor_length_mm}
                        width={specs?.dim_indoor_width_mm}
                        height={specs?.dim_indoor_height_mm}
                      />
                    )}
                    {(specs?.weight_outdoor_kg != null || hasOutdoorDims(specs)) && (
                      <UnitBlock
                        title="Външен блок"
                        accent="text-[#FF4D00]"
                        weight={specs?.weight_outdoor_kg}
                        length={specs?.dim_outdoor_length_mm}
                        width={specs?.dim_outdoor_width_mm}
                        height={specs?.dim_outdoor_height_mm}
                      />
                    )}
                  </div>
                  <p className="mt-2 text-right text-[10px] text-gray-400">Размери в формат Д × Ш × В (mm)</p>
                </div>
              )}

              <div className="mb-5 flex flex-wrap gap-2">
                {features.map((feature) => (
                  <span key={feature} className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    <Check className="h-3 w-3 text-green-500" strokeWidth={3} />
                    {feature}
                  </span>
                ))}
              </div>

              <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 p-4 md:p-5">
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="text-3xl md:text-4xl font-extrabold text-gray-900">€{price.toLocaleString()}</span>
                  {product.old_price ? <span className="text-lg font-bold text-gray-400 line-through">€{Number(product.old_price).toLocaleString()}</span> : null}
                </div>
                {standardMount != null && standardMount >= 0 && totalWithMount != null && totalWithMount >= price && (
                  <div className="mb-4 space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Цена на уреда:</span>
                      <strong>€{price.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Стандартен монтаж:</span>
                      <strong>€{standardMount.toLocaleString("bg-BG")}</strong>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-base">
                      <span>Общо с монтаж:</span>
                      <strong className="text-gray-900">€{totalWithMount.toLocaleString("bg-BG")}</strong>
                    </div>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="mb-3 text-xs font-bold uppercase text-gray-500">Наличност</h4>
                  <div className="flex items-start gap-3">
                    <div className="relative mt-1">
                      <div className={`h-2.5 w-2.5 rounded-full ${product.stock_status === "out_of_stock" ? "bg-red-500" : "bg-green-500"}`} />
                      {product.stock_status !== "out_of_stock" && <div className="absolute inset-0 h-2.5 w-2.5 animate-ping rounded-full bg-green-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{stockLabel(product.stock_status)}</p>
                      <p className="text-xs text-gray-500">Налични: {Number(product.stock_quantity ?? 0)} бр.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );

}

function Spec({ icon, label, value }: { icon: ReactNode; label: string; value?: string | number | null }) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs text-gray-500">{label}</span>
      <span className="ml-auto text-xs font-bold text-gray-800">{value}</span>
    </div>
  );
}

function kw(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  return `${value} kW`;
}

function warranty(value: unknown) {
  if (value === undefined || value === null || value === "") return "";
  return `${value} месеца`;
}

function stockLabel(value: string | null | undefined) {
  if (value === "out_of_stock") return "Изчерпан";
  if (value === "on_order") return "По поръчка";
  return "В наличност";
}

type SpecLike = ProductQuickViewData["product_specs"];

function isFilled(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.trim() !== "";
  if (typeof v === "number") return Number.isFinite(v);
  return Boolean(v);
}

function hasIndoorDims(specs: SpecLike): boolean {
  return isFilled(specs?.dim_indoor_length_mm) || isFilled(specs?.dim_indoor_width_mm) || isFilled(specs?.dim_indoor_height_mm);
}
function hasOutdoorDims(specs: SpecLike): boolean {
  return isFilled(specs?.dim_outdoor_length_mm) || isFilled(specs?.dim_outdoor_width_mm) || isFilled(specs?.dim_outdoor_height_mm);
}
function hasDimsOrWeight(specs: SpecLike): boolean {
  if (isFilled(specs?.weight_indoor_kg) || isFilled(specs?.weight_outdoor_kg)) return true;
  return hasIndoorDims(specs) || hasOutdoorDims(specs);
}

function formatKgValue(v: unknown): string {
  if (!isFilled(v)) return "—";
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return "—";
  const rounded = Math.round(n * 10) / 10;
  return `${rounded.toLocaleString("bg-BG", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
}

function dimCell(v: unknown): string {
  if (!isFilled(v)) return "—";
  return String(v);
}

function UnitBlock({
  title,
  accent,
  weight,
  length,
  width,
  height,
}: {
  title: string;
  accent: string;
  weight?: number | string | null;
  length?: number | string | null;
  width?: number | string | null;
  height?: number | string | null;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3">
      <div className={`mb-2 text-[10px] font-black uppercase tracking-widest ${accent}`}>{title}</div>
      {isFilled(weight) && (
        <div className="mb-1 flex items-center gap-1.5">
          <Weight className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">Тегло</span>
          <span className="ml-auto text-xs font-bold text-gray-800">{formatKgValue(weight)}</span>
        </div>
      )}
      {(isFilled(length) || isFilled(width) || isFilled(height)) && (
        <div className="flex items-start gap-1.5">
          <Ruler className="mt-0.5 h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">Размери</span>
          <span className="ml-auto text-right text-xs font-bold text-gray-800">
            {`${dimCell(length)} × ${dimCell(width)} × ${dimCell(height)} mm`}
          </span>
        </div>
      )}
    </div>
  );
}
