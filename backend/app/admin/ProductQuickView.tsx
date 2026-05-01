"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Check, ShieldCheck, Star, Volume2, Wifi, Wind, X, Zap } from "lucide-react";

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
  } | null;
  product_images?: Array<{ url: string; sort_order?: number | null; is_main?: boolean | null }>;
};

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`text-left font-bold text-slate-900 underline-offset-4 transition-colors hover:text-sky-700 hover:underline focus:outline-none focus:ring-2 focus:ring-sky-200 rounded ${className}`}
        title="Бърз преглед на продукта"
      >
        {productName}
      </button>
      {open && <ProductQuickViewModal productId={productId} onClose={() => setOpen(false)} />}
    </>
  );
}

function ProductQuickViewModal({ productId, onClose }: { productId: string; onClose: () => void }) {
  const [product, setProduct] = useState<ProductQuickViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    setImageFailed(false);

    fetch(`/api/admin/products/${productId}`, { credentials: "include" })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || "Грешка при зареждане на продукта");
        return json.data as ProductQuickViewData;
      })
      .then((data) => {
        if (alive) setProduct(data);
      })
      .catch((e: any) => {
        if (alive) setError(String(e?.message ?? e));
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
  const priceWithMount = product?.price_with_mount != null ? Number(product.price_with_mount) : null;
  const features = [
    specs?.energy_class_cool && `Охлаждане ${specs.energy_class_cool}`,
    specs?.energy_class_heat && `Отопление ${specs.energy_class_heat}`,
    specs?.seer && `SEER ${specs.seer}`,
    specs?.scop && `SCOP ${specs.scop}`,
    product?.product_condition === "used" ? "Втора употреба" : "Нов продукт",
  ].filter(Boolean) as string[];

  return (
    <div className="fixed inset-0 z-[70]">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-3 overflow-hidden rounded-3xl bg-white shadow-2xl md:inset-8 lg:inset-auto lg:left-1/2 lg:top-1/2 lg:max-h-[90vh] lg:w-[900px] lg:-translate-x-1/2 lg:-translate-y-1/2">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition-colors hover:bg-gray-200"
          aria-label="Затвори бърз преглед"
        >
          <X className="h-5 w-5" />
        </button>

        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center text-sm font-bold text-slate-500">Зареждане на продукта...</div>
        ) : error ? (
          <div className="flex min-h-[420px] items-center justify-center p-8 text-center text-sm font-bold text-red-600">{error}</div>
        ) : product ? (
          <div className="flex max-h-[90vh] flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
            <div className="relative flex shrink-0 items-center justify-center border-r border-gray-100 bg-gray-50 p-8 lg:w-[420px]">
              <div className="relative w-full">
                <div className="absolute left-4 top-4 z-10 rounded-full bg-white/90 px-3 py-1 text-xs font-black text-[#00B4D8] shadow-sm">
                  {product.product_condition === "used" ? "Втора употреба" : "Нов"}
                </div>
                {specs?.energy_class_cool && (
                  <div className="absolute right-4 top-4 z-10 rounded-full bg-emerald-500 px-3 py-1 text-xs font-black text-white shadow-sm">
                    {specs.energy_class_cool}
                  </div>
                )}
                <div className="flex aspect-square items-center justify-center rounded-3xl bg-white p-5 shadow-sm">
                  {mainImage && !imageFailed ? (
                    <img
                      src={mainImage}
                      alt={product.name}
                      className="max-h-full max-w-full object-contain"
                      onError={() => setImageFailed(true)}
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center rounded-2xl bg-[radial-gradient(circle_at_top,#e0f2fe_0,#f8fafc_52%,#eef2ff_100%)] p-8 text-center">
                      <div className="mb-3 rounded-2xl bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-sky-700 shadow-sm">
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
                        <img src={image.url} alt="" className="h-full w-full object-contain" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 lg:p-8">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-[#00B4D8]">{product.brands?.name ?? "Климатик"}</p>
              <h2 className="mb-1 text-2xl font-black leading-tight text-gray-900">{product.name}</h2>
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

              <div className="mb-5 flex flex-wrap gap-2">
                {features.map((feature) => (
                  <span key={feature} className="flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                    <Check className="h-3 w-3 text-green-500" strokeWidth={3} />
                    {feature}
                  </span>
                ))}
              </div>

              <div className="mb-6 rounded-2xl border border-gray-100 bg-gray-50 p-5">
                <div className="mb-4 flex items-baseline gap-3">
                  <span className="text-4xl font-extrabold text-gray-900">€{price.toLocaleString()}</span>
                  {product.old_price ? <span className="text-lg font-bold text-gray-400 line-through">€{Number(product.old_price).toLocaleString()}</span> : null}
                </div>
                {priceWithMount != null && priceWithMount >= price && (
                  <div className="mb-4 space-y-2 text-sm text-gray-600">
                    <div className="flex justify-between">
                      <span>Цена на уреда:</span>
                      <strong>€{price.toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span>Стандартен монтаж:</span>
                      <strong>€{(priceWithMount - price).toLocaleString()}</strong>
                    </div>
                    <div className="flex justify-between border-t border-gray-200 pt-2 text-base">
                      <span>Общо с монтаж:</span>
                      <strong className="text-gray-900">€{priceWithMount.toLocaleString()}</strong>
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
