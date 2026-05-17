"use client";

import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { slugifyBg } from "@/lib/import/slugify";
import { enhancePhotoViaAI, fetchImageAsBlob } from "@/lib/photos/enhancePhoto";
import { BrandCombobox } from "../products/BrandCombobox";
import {
  ProductPhotoUploader,
  MAX_PRODUCT_IMAGES,
  AI_ENHANCE_PRICE_DISPLAY,
} from "../products/ProductPhotoUploader";
import { ImageLightbox } from "../products/ImageLightbox";
import { Button, Input, Select, Textarea } from "../ui";

export type AccessoryImageRow = { url: string; sort_order: number; is_main: boolean };

export type AdminAccessoryForm = {
  slug: string;
  name: string;
  brandId: string;
  kind: "accessory" | "spare_part" | "consumable";
  description: string;
  price: number;
  oldPrice: string;
  stockStatus: "in_stock" | "out_of_stock" | "on_order";
  stockQuantity: number;
  isActive: boolean;
  images: AccessoryImageRow[];
};

export function emptyAccessoryForm(): AdminAccessoryForm {
  return {
    slug: "",
    name: "",
    brandId: "",
    kind: "accessory",
    description: "",
    price: 0,
    oldPrice: "",
    stockStatus: "in_stock",
    stockQuantity: 1,
    isActive: true,
    images: [],
  };
}

function strNum(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function FieldTitle({ label, info }: { label: string; info: string }) {
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">{label}</span>
      <span title={info} className="inline-flex text-brand-blue-600 cursor-help">
        <Info className="w-3.5 h-3.5" />
      </span>
    </div>
  );
}

export function buildAccessoryPostBody(form: AdminAccessoryForm) {
  const slug = form.slug.trim();
  const oldPrice = strNum(form.oldPrice);
  return {
    ...(slug.length >= 2 ? { slug } : {}),
    name: form.name.trim(),
    ...(form.brandId.trim() ? { brandId: form.brandId.trim() } : {}),
    kind: form.kind,
    description: form.description.trim() || undefined,
    price: Number(form.price),
    oldPrice: oldPrice ?? null,
    stockStatus: form.stockStatus,
    stockQuantity: form.stockQuantity,
    isActive: form.isActive,
    images: form.images
      .filter((i) => i.url.trim())
      .slice(0, MAX_PRODUCT_IMAGES)
      .map((i, idx) => ({
        url: i.url.trim(),
        sort_order: i.sort_order ?? idx,
        is_main: i.is_main,
      })),
  };
}

export function buildAccessoryPutBody(form: AdminAccessoryForm) {
  const slug = form.slug.trim();
  const oldPrice = strNum(form.oldPrice);
  return {
    slug: slug.length >= 2 ? slug : null,
    name: form.name.trim(),
    brandId: form.brandId.trim() || null,
    kind: form.kind,
    description: form.description.trim() || null,
    price: Number(form.price),
    oldPrice,
    stockStatus: form.stockStatus,
    stockQuantity: form.stockQuantity,
    isActive: form.isActive,
    images: form.images
      .filter((i) => i.url.trim())
      .slice(0, MAX_PRODUCT_IMAGES)
      .map((i, idx) => ({
        url: i.url.trim(),
        sort_order: i.sort_order ?? idx,
        is_main: i.is_main,
      })),
  };
}

type LoadedAccessory = {
  slug: string;
  name: string;
  brand_id: string | null;
  kind: string;
  description: string | null;
  price: number;
  old_price: number | null;
  stock_status: string;
  stock_quantity: number;
  is_active: boolean;
  accessory_images?: Array<{ url: string; sort_order?: number | null; is_main?: boolean | null }>;
};

export function mapLoadedAccessoryToForm(row: LoadedAccessory): AdminAccessoryForm {
  const images = [...(row.accessory_images ?? [])]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((im, idx) => ({
      url: im.url,
      sort_order: im.sort_order ?? idx,
      is_main: Boolean(im.is_main),
    }));
  return {
    slug: row.slug ?? "",
    name: row.name ?? "",
    brandId: row.brand_id ?? "",
    kind:
      row.kind === "spare_part" || row.kind === "consumable" ? row.kind : "accessory",
    description: row.description ?? "",
    price: Number(row.price) || 0,
    oldPrice: row.old_price != null ? String(row.old_price) : "",
    stockStatus:
      row.stock_status === "out_of_stock" || row.stock_status === "on_order"
        ? row.stock_status
        : "in_stock",
    stockQuantity: row.stock_quantity ?? 0,
    isActive: row.is_active !== false,
    images,
  };
}

type Brand = { id: string; name: string };

type Props = {
  brands: Brand[];
  form: AdminAccessoryForm;
  setForm: React.Dispatch<React.SetStateAction<AdminAccessoryForm>>;
  canEditPrice?: boolean;
  readOnly?: boolean;
  onPendingPhotosChange?: (count: number) => void;
};

export function AccessoryFormFields({
  brands,
  form,
  setForm,
  canEditPrice = true,
  readOnly = false,
  onPendingPhotosChange,
}: Props) {
  const ro = readOnly;
  const [imageLightboxIndex, setImageLightboxIndex] = useState<number | null>(null);
  const [uploadedAiStatus, setUploadedAiStatus] = useState<
    Record<string, { phase: "processing"; startedAt: number } | { phase: "error"; message: string }>
  >({});
  const [aiDialog, setAiDialog] = useState<"missing_name" | "replace_description" | "error" | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  function generateSlugFromName() {
    const next = slugifyBg(form.name || "");
    if (next.length >= 2) setForm((f) => ({ ...f, slug: next }));
  }

  function requestAiDraft() {
    if (!form.name.trim()) {
      setAiDialog("missing_name");
      return;
    }
    if (form.description.trim()) {
      setAiDialog("replace_description");
      return;
    }
    void generateAiDraft();
  }

  async function generateAiDraft() {
    setAiDialog(null);
    setAiError("");
    setAiBusy(true);
    try {
      const brandName = brands.find((b) => b.id === form.brandId)?.name;
      const res = await fetch("/api/admin/ai", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: "accessory_draft",
          input: {
            name: form.name,
            brandName,
            kind: form.kind,
            price: Number(form.price || 0),
            currentDescription: form.description,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error || "AI заявката не успя");
      const draft = (json as { data?: { slug?: string; description?: string } }).data ?? {};
      setForm((prev) => ({
        ...prev,
        slug:
          typeof draft.slug === "string" && draft.slug.length >= 2 ? draft.slug : prev.slug,
        description:
          typeof draft.description === "string" ? draft.description : prev.description,
      }));
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : String(e));
      setAiDialog("error");
    } finally {
      setAiBusy(false);
    }
  }

  async function enhanceUploadedImage(originalUrl: string) {
    if (uploadedAiStatus[originalUrl]?.phase === "processing") return;
    setUploadedAiStatus((prev) => ({
      ...prev,
      [originalUrl]: { phase: "processing", startedAt: Date.now() },
    }));
    try {
      const origBlob = await fetchImageAsBlob(originalUrl);
      const result = await enhancePhotoViaAI(origBlob);
      const brand = brands.find((br) => br.id === form.brandId);
      const brandSlug = brand ? slugifyBg(brand.name) : null;
      const productSlug = form.slug || slugifyBg(form.name || "");
      const folderKey = brandSlug ? `${brandSlug}-${productSlug}` : productSlug;
      const file = new File([result.blob], "enhanced-ai.png", { type: result.mimeType });
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", "accessory");
      fd.append("slug", folderKey);
      const res = await fetch("/api/admin/uploads/image", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { url?: string };
        error?: string;
      };
      if (!res.ok || !json.data?.url) {
        throw new Error(json.error || `Качването в Cloudinary не успя (HTTP ${res.status}).`);
      }
      const newUrl = json.data.url;
      setForm((f) => ({
        ...f,
        images: f.images.map((im) => (im.url === originalUrl ? { ...im, url: newUrl } : im)),
      }));
      setUploadedAiStatus((prev) => {
        const next = { ...prev };
        delete next[originalUrl];
        return next;
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setUploadedAiStatus((prev) => ({
        ...prev,
        [originalUrl]: { phase: "error", message: msg },
      }));
      setTimeout(() => {
        setUploadedAiStatus((prev) => {
          if (prev[originalUrl]?.phase !== "error") return prev;
          const next = { ...prev };
          delete next[originalUrl];
          return next;
        });
      }, 7000);
    }
  }

  const brandSlug = (() => {
    const b = brands.find((br) => br.id === form.brandId);
    return b ? slugifyBg(b.name) : null;
  })();

  return (
    <div className="grid gap-2 md:gap-5 max-md:text-[13px]">
      {ro && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-sm text-slate-700">
          <strong>Само преглед.</strong> За промени обърнете се към офис или главен администратор.
        </div>
      )}

      <fieldset disabled={ro} className="min-w-0 border-0 p-0 m-0 grid gap-2 md:gap-5">
        <div className="grid lg:grid-cols-3 gap-2 md:gap-4">
          <div className="lg:col-span-2 grid gap-2 md:gap-3">
            <label className="block">
              <FieldTitle label="Име" info="Публично име на аксесоара в каталога." />
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Напр. Wi-Fi модул Daikin…"
              />
            </label>

            <div className="grid sm:grid-cols-2 gap-2 md:gap-3">
              <label className="block">
                <FieldTitle label="Марка" info="Не е задължително. Остави празно, ако аксесоарът няма производител/марка." />
                <BrandCombobox
                  brands={brands}
                  value={form.brandId}
                  onChange={(brandId) => setForm({ ...form, brandId })}
                  placeholder="Без марка (по избор)"
                />
              </label>
              <label className="block">
                <FieldTitle label="Вид" info="Аксесоар, резервна част или консуматив." />
                <Select
                  value={form.kind}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      kind: e.target.value as AdminAccessoryForm["kind"],
                    })
                  }
                >
                  <option value="accessory">Аксесоар</option>
                  <option value="spare_part">Резервна част</option>
                  <option value="consumable">Консуматив</option>
                </Select>
              </label>
            </div>

            <label className="block">
              <div className="flex items-center justify-between gap-2">
                <FieldTitle label="Slug (URL)" info="Латински идентификатор за публичната страница." />
                <Button type="button" variant="secondary" size="sm" onClick={generateSlugFromName} className="mb-1">
                  От името
                </Button>
              </div>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="wifi-modul-daikin"
              />
            </label>

            <div className="grid sm:grid-cols-2 gap-2 md:gap-3">
              <label className="block">
                <FieldTitle label="Цена (€)" info="Продажна цена." />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price || ""}
                  onChange={(e) => setForm({ ...form, price: Number(e.target.value) || 0 })}
                  disabled={!canEditPrice}
                />
              </label>
              <label className="block">
                <FieldTitle label="Стара цена (€)" info="По избор — за отстъпка." />
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.oldPrice}
                  onChange={(e) => setForm({ ...form, oldPrice: e.target.value })}
                  disabled={!canEditPrice}
                />
              </label>
            </div>

            <label className="block">
              <div className="flex items-center justify-between gap-3">
                <FieldTitle
                  label="Информационен текст"
                  info="Описание за детайлната страница на аксесоара."
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={requestAiDraft}
                  disabled={aiBusy}
                  className="mb-1 gap-1.5 whitespace-nowrap"
                >
                  <Wand2 className="w-3.5 h-3.5" /> {aiBusy ? "AI..." : "AI чернова"}
                </Button>
              </div>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="max-md:min-h-[5.5rem] md:min-h-[7rem]"
              />
            </label>
          </div>

          <aside className="lg:col-span-1 grid gap-2 md:gap-3 rounded-lg md:rounded-2xl border border-slate-200 bg-slate-50/60 p-2.5 md:p-4 lg:sticky lg:top-4 lg:self-start">
            <div className="text-[11px] md:text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200 pb-1.5">
              Наличност
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">Статус</div>
                <Select
                  value={form.stockStatus}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      stockStatus: e.target.value as AdminAccessoryForm["stockStatus"],
                    })
                  }
                >
                  <option value="in_stock">В наличност</option>
                  <option value="out_of_stock">Изчерпан</option>
                  <option value="on_order">По поръчка</option>
                </Select>
              </label>
              <label className="block">
                <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1">Количество</div>
                <Input
                  type="number"
                  min={0}
                  value={form.stockQuantity}
                  onChange={(e) =>
                    setForm({ ...form, stockQuantity: Math.max(0, parseInt(e.target.value, 10) || 0) })
                  }
                />
              </label>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">Активен в каталога</span>
            </label>
          </aside>
        </div>

        <section className="rounded-lg md:rounded-2xl border border-slate-200 bg-white p-2.5 md:p-4">
          <FieldTitle label="Снимки" info={`До ${MAX_PRODUCT_IMAGES} снимки — качване, AI подобрение и търсене.`} />
          {form.images.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {form.images.map((im, idx) => {
                const ai = uploadedAiStatus[im.url];
                const isProcessing = ai?.phase === "processing";
                return (
                  <div
                    key={`${im.url}-${idx}`}
                    className={`group relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden border-2 bg-white shadow-sm ${
                      isProcessing
                        ? "border-violet-400"
                        : im.is_main
                          ? "border-brand-blue-500 ring-2 ring-brand-blue-200"
                          : "border-slate-200"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setImageLightboxIndex(idx)}
                      className="w-full h-full block cursor-zoom-in"
                    >
                      <img src={im.url} alt="" className="w-full h-full object-cover" />
                    </button>
                    {im.is_main && (
                      <div className="absolute top-0.5 left-0.5 px-1 py-0.5 rounded bg-brand-blue-600 text-white text-[8px] font-bold">
                        ★
                      </div>
                    )}
                    {isProcessing && (
                      <div className="absolute inset-0 flex items-center justify-center bg-violet-900/65 text-white">
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </div>
                    )}
                    {!isProcessing && !ro && (
                      <div className="absolute inset-x-0 bottom-0 flex bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!im.is_main && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setForm({
                                ...form,
                                images: form.images.map((row, i) => ({
                                  ...row,
                                  is_main: i === idx,
                                })),
                              });
                            }}
                            className="flex-1 py-0.5 text-white text-[9px] font-bold"
                          >
                            ★
                          </button>
                        )}
                        <button
                          type="button"
                          title={`AI подобри (~${AI_ENHANCE_PRICE_DISPLAY})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            void enhanceUploadedImage(im.url);
                          }}
                          className="flex-1 py-0.5 text-white text-[9px] font-bold"
                        >
                          ✨
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForm({
                              ...form,
                              images: form.images.filter((_, i) => i !== idx),
                            });
                          }}
                          className="flex-1 py-0.5 text-white text-[9px] font-bold"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {!ro && (
            <div className="mt-3">
              <ProductPhotoUploader
                brandSlug={brandSlug}
                brandName={brands.find((br) => br.id === form.brandId)?.name ?? null}
                modelCode={form.slug || slugifyBg(form.name || "")}
                productSlug={form.slug || slugifyBg(form.name || "")}
                cloudinaryKind="accessory"
                remainingSlots={Math.max(0, MAX_PRODUCT_IMAGES - form.images.length)}
                onUploaded={(urls) =>
                  setForm((f) => {
                    const baseLen = f.images.length;
                    const next: AccessoryImageRow[] = urls.map((url, i) => ({
                      url,
                      sort_order: baseLen + i,
                      is_main: baseLen === 0 && i === 0,
                    }));
                    return { ...f, images: [...f.images, ...next] };
                  })
                }
                onPendingChange={onPendingPhotosChange ?? (() => {})}
              />
            </div>
          )}
        </section>
      </fieldset>

      <ImageLightbox
        images={form.images.map((i) => i.url)}
        index={imageLightboxIndex}
        onClose={() => setImageLightboxIndex(null)}
        onIndexChange={setImageLightboxIndex}
      />

      {aiDialog && (
        <div
          className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 bg-slate-950/55 backdrop-blur-md"
          onClick={() => !aiBusy && setAiDialog(null)}
        >
          <div
            className="w-full md:max-w-xl overflow-hidden rounded-t-3xl md:rounded-3xl border border-white/70 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative border-b border-slate-100 bg-gradient-to-br from-brand-blue-50 to-white px-6 py-5">
              <button
                type="button"
                onClick={() => setAiDialog(null)}
                disabled={aiBusy}
                className="absolute right-4 top-4 h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-500"
                aria-label="Затвори"
              >
                <X className="h-4 w-4 mx-auto" />
              </button>
              <div className="flex items-center gap-3 pr-10">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl text-white ${
                    aiDialog === "error" ? "bg-red-600" : "bg-brand-blue-500"
                  }`}
                >
                  {aiDialog === "error" ? (
                    <AlertCircle className="h-5 w-5" />
                  ) : (
                    <Sparkles className="h-5 w-5" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold uppercase tracking-wider text-brand-blue-700">
                    Gemini чернова
                  </div>
                  <div className="mt-1 text-xl font-black text-slate-950">
                    {aiDialog === "missing_name"
                      ? "Нужно е име"
                      : aiDialog === "replace_description"
                        ? "Да заменя описанието?"
                        : "AI заявката не успя"}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 text-sm text-slate-700">
              {aiDialog === "missing_name" && (
                <p>Попълни първо името. AI използва името, марката, вида и цената.</p>
              )}
              {aiDialog === "replace_description" && (
                <div className="space-y-3">
                  <div className="rounded-xl border border-slate-200 p-3 max-h-32 overflow-y-auto whitespace-pre-wrap text-sm">
                    {form.description}
                  </div>
                  <p className="font-medium">AI ще замени текущото описание.</p>
                </div>
              )}
              {aiDialog === "error" && (
                <p className="text-red-800">{aiError || "Неочаквана грешка."}</p>
              )}
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 border-t bg-slate-50 px-6 py-4">
              <Button variant="secondary" onClick={() => setAiDialog(null)} disabled={aiBusy}>
                {aiDialog === "replace_description" ? "Отказ" : "Разбрах"}
              </Button>
              {aiDialog === "replace_description" && (
                <Button onClick={() => void generateAiDraft()} disabled={aiBusy} className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {aiBusy ? "Генериране..." : "Замени с AI чернова"}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
